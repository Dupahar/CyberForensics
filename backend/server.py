from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pymongo import MongoClient
import os
import hashlib
import json
import csv
import sqlite3
import pandas as pd
from datetime import datetime
from pathlib import Path
import zipfile
import plistlib
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import io
import uuid

# Initialize FastAPI app
app = FastAPI(title="CyberForensics Data Extraction Tool", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/cyberforensics_db')
client = MongoClient(MONGO_URL)
db = client.get_default_database()

# Collections
cases_collection = db.cases
evidence_collection = db.evidence
exports_collection = db.exports

# Models
class CaseCreate(BaseModel):
    case_name: str
    investigator: str
    description: Optional[str] = ""

class ExportRequest(BaseModel):
    case_id: str
    data_types: List[str]  # ['messages', 'contacts', 'call_logs']
    export_format: str  # 'json' or 'csv'

# Utility functions
def calculate_hash(data: bytes) -> str:
    """Calculate SHA-256 hash of data"""
    return hashlib.sha256(data).hexdigest()

def create_evidence_timestamp() -> str:
    """Create forensics-grade timestamp"""
    return datetime.utcnow().isoformat() + "Z"

def parse_android_db(file_path: str) -> Dict[str, List[Dict]]:
    """Parse Android SQLite databases"""
    data = {"messages": [], "contacts": [], "call_logs": []}
    
    try:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Parse messages (common Android SMS/MMS tables)
        for table in ['sms', 'messages', 'message']:
            if table in tables:
                try:
                    cursor.execute(f"SELECT * FROM {table}")
                    columns = [description[0] for description in cursor.description]
                    rows = cursor.fetchall()
                    for row in rows:
                        message_data = dict(zip(columns, row))
                        message_data['source'] = 'android_db'
                        message_data['table'] = table
                        data["messages"].append(message_data)
                except Exception as e:
                    print(f"Error parsing {table}: {e}")
        
        # Parse contacts
        for table in ['contacts', 'contact', 'phone_book']:
            if table in tables:
                try:
                    cursor.execute(f"SELECT * FROM {table}")
                    columns = [description[0] for description in cursor.description]
                    rows = cursor.fetchall()
                    for row in rows:
                        contact_data = dict(zip(columns, row))
                        contact_data['source'] = 'android_db'
                        contact_data['table'] = table
                        data["contacts"].append(contact_data)
                except Exception as e:
                    print(f"Error parsing {table}: {e}")
        
        # Parse call logs
        for table in ['calls', 'call_log', 'call_history']:
            if table in tables:
                try:
                    cursor.execute(f"SELECT * FROM {table}")
                    columns = [description[0] for description in cursor.description]
                    rows = cursor.fetchall()
                    for row in rows:
                        call_data = dict(zip(columns, row))
                        call_data['source'] = 'android_db'
                        call_data['table'] = table
                        data["call_logs"].append(call_data)
                except Exception as e:
                    print(f"Error parsing {table}: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error parsing Android database: {e}")
    
    return data

def parse_ios_backup(backup_path: str) -> Dict[str, List[Dict]]:
    """Parse iOS backup files"""
    data = {"messages": [], "contacts": [], "call_logs": []}
    
    try:
        # iOS backups typically contain SQLite databases and plist files
        backup_dir = Path(backup_path)
        
        # Look for common iOS database files
        for file_path in backup_dir.rglob("*.db"):
            if file_path.is_file():
                try:
                    ios_data = parse_android_db(str(file_path))  # SQLite parsing works for iOS too
                    for key in data.keys():
                        data[key].extend(ios_data[key])
                except Exception as e:
                    print(f"Error parsing iOS DB {file_path}: {e}")
        
        # Look for plist files
        for file_path in backup_dir.rglob("*.plist"):
            if file_path.is_file():
                try:
                    with open(file_path, 'rb') as f:
                        plist_data = plistlib.load(f)
                        # Add plist data with source information
                        plist_entry = {
                            'source': 'ios_plist',
                            'file': str(file_path.name),
                            'data': plist_data
                        }
                        data["contacts"].append(plist_entry)  # Most plist files are contact-related
                except Exception as e:
                    print(f"Error parsing plist {file_path}: {e}")
    
    except Exception as e:
        print(f"Error parsing iOS backup: {e}")
    
    return data

# API Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": create_evidence_timestamp()}

@app.post("/api/cases")
async def create_case(case: CaseCreate):
    """Create a new forensics case"""
    case_data = {
        "case_id": str(uuid.uuid4()),
        "case_name": case.case_name,
        "investigator": case.investigator,
        "description": case.description,
        "created_at": create_evidence_timestamp(),
        "status": "active"
    }
    
    result = cases_collection.insert_one(case_data)
    case_data["_id"] = str(result.inserted_id)
    
    return {"success": True, "case": case_data}

@app.get("/api/cases")
async def get_cases():
    """Get all forensics cases"""
    cases = list(cases_collection.find())
    for case in cases:
        case["_id"] = str(case["_id"])
    
    return {"cases": cases}

@app.post("/api/cases/{case_id}/upload")
async def upload_evidence(case_id: str, file: UploadFile = File(...)):
    """Upload evidence file for processing"""
    
    # Verify case exists
    case = cases_collection.find_one({"case_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read and hash file
    file_content = await file.read()
    file_hash = calculate_hash(file_content)
    
    # Save file temporarily for processing
    temp_path = f"/tmp/{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(file_content)
    
    # Parse data based on file type
    parsed_data = {"messages": [], "contacts": [], "call_logs": []}
    
    try:
        if file.filename.lower().endswith(('.db', '.sqlite', '.sqlite3')):
            # Android/iOS SQLite database
            parsed_data = parse_android_db(temp_path)
        elif file.filename.lower().endswith('.zip'):
            # iOS backup or Android backup archive
            with zipfile.ZipFile(temp_path, 'r') as zip_ref:
                extract_path = f"/tmp/extracted_{case_id}"
                zip_ref.extractall(extract_path)
                parsed_data = parse_ios_backup(extract_path)
        else:
            # Try to parse as SQLite database anyway
            parsed_data = parse_android_db(temp_path)
    
    except Exception as e:
        print(f"Error parsing file: {e}")
    
    # Store evidence in database
    evidence_data = {
        "evidence_id": str(uuid.uuid4()),
        "case_id": case_id,
        "filename": file.filename,
        "file_size": len(file_content),
        "file_hash": file_hash,
        "uploaded_at": create_evidence_timestamp(),
        "data": parsed_data,
        "processed": True
    }
    
    evidence_collection.insert_one(evidence_data)
    
    # Clean up temp files
    try:
        os.remove(temp_path)
        if file.filename.lower().endswith('.zip'):
            import shutil
            shutil.rmtree(f"/tmp/extracted_{case_id}", ignore_errors=True)
    except:
        pass
    
    # Return summary
    summary = {
        "messages_count": len(parsed_data["messages"]),
        "contacts_count": len(parsed_data["contacts"]),
        "call_logs_count": len(parsed_data["call_logs"])
    }
    
    return {
        "success": True,
        "evidence_id": evidence_data["evidence_id"],
        "file_hash": file_hash,
        "summary": summary
    }

@app.get("/api/cases/{case_id}/evidence")
async def get_case_evidence(case_id: str):
    """Get all evidence for a case"""
    evidence_list = list(evidence_collection.find({"case_id": case_id}))
    
    for evidence in evidence_list:
        evidence["_id"] = str(evidence["_id"])
        # Don't include raw data in list view
        if "data" in evidence:
            summary = {
                "messages_count": len(evidence["data"].get("messages", [])),
                "contacts_count": len(evidence["data"].get("contacts", [])),
                "call_logs_count": len(evidence["data"].get("call_logs", []))
            }
            evidence["summary"] = summary
            del evidence["data"]
    
    return {"evidence": evidence_list}

@app.post("/api/export")
async def export_data(request: ExportRequest):
    """Export forensics data in specified format"""
    
    # Get all evidence for the case
    evidence_list = list(evidence_collection.find({"case_id": request.case_id}))
    if not evidence_list:
        raise HTTPException(status_code=404, detail="No evidence found for case")
    
    # Aggregate data
    aggregated_data = {"messages": [], "contacts": [], "call_logs": []}
    
    for evidence in evidence_list:
        for data_type in request.data_types:
            if data_type in evidence.get("data", {}):
                aggregated_data[data_type].extend(evidence["data"][data_type])
    
    # Create export record
    export_id = str(uuid.uuid4())
    export_timestamp = create_evidence_timestamp()
    
    # Generate export based on format
    if request.export_format.lower() == "json":
        # JSON export
        export_data = {
            "export_metadata": {
                "export_id": export_id,
                "case_id": request.case_id,
                "exported_at": export_timestamp,
                "data_types": request.data_types,
                "format": "json"
            },
            "data": aggregated_data
        }
        
        json_content = json.dumps(export_data, indent=2, default=str)
        export_hash = calculate_hash(json_content.encode())
        
        # Store export record
        exports_collection.insert_one({
            "export_id": export_id,
            "case_id": request.case_id,
            "exported_at": export_timestamp,
            "format": "json",
            "data_types": request.data_types,
            "file_hash": export_hash
        })
        
        # Return as streaming response
        return StreamingResponse(
            io.StringIO(json_content),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=forensics_export_{export_id}.json",
                "X-Export-Hash": export_hash
            }
        )
    
    elif request.export_format.lower() == "csv":
        # CSV export - create separate files for each data type
        csv_files = {}
        
        for data_type in request.data_types:
            if aggregated_data[data_type]:
                # Convert to DataFrame
                df = pd.DataFrame(aggregated_data[data_type])
                csv_content = df.to_csv(index=False)
                csv_files[data_type] = csv_content
        
        # For CSV, we'll return the first available data type
        # In a real implementation, you might want to create a ZIP file
        if csv_files:
            first_type = list(csv_files.keys())[0]
            csv_content = csv_files[first_type]
            export_hash = calculate_hash(csv_content.encode())
            
            # Store export record
            exports_collection.insert_one({
                "export_id": export_id,
                "case_id": request.case_id,
                "exported_at": export_timestamp,
                "format": "csv",
                "data_types": request.data_types,
                "file_hash": export_hash
            })
            
            return StreamingResponse(
                io.StringIO(csv_content),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=forensics_export_{first_type}_{export_id}.csv",
                    "X-Export-Hash": export_hash
                }
            )
    
    raise HTTPException(status_code=400, detail="Invalid export format or no data to export")

@app.get("/api/exports/{case_id}")
async def get_exports(case_id: str):
    """Get export history for a case"""
    exports = list(exports_collection.find({"case_id": case_id}))
    
    for export in exports:
        export["_id"] = str(export["_id"])
    
    return {"exports": exports}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)