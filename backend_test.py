#!/usr/bin/env python3
import unittest
import requests
import json
import os
import sqlite3
import tempfile
import hashlib
import re
from datetime import datetime

# Get backend URL from frontend .env file
with open('/app/frontend/.env', 'r') as f:
    env_content = f.read()
    backend_url_match = re.search(r'REACT_APP_BACKEND_URL=(.+)', env_content)
    if backend_url_match:
        BACKEND_URL = backend_url_match.group(1).strip()
    else:
        BACKEND_URL = "http://localhost:8001"

API_URL = f"{BACKEND_URL}/api"

class TestCyberForensicsBackend(unittest.TestCase):
    """Test suite for CyberForensics Data Extraction Tool backend API"""

    def setUp(self):
        """Set up test environment"""
        self.case_id = None
        self.evidence_id = None
        self.export_id = None
        
        # Create a mock SQLite database for testing
        self.db_file = self.create_mock_sqlite_db()

    def tearDown(self):
        """Clean up after tests"""
        if os.path.exists(self.db_file):
            os.remove(self.db_file)

    def create_mock_sqlite_db(self):
        """Create a mock SQLite database with test data"""
        db_file = tempfile.gettempdir() + "/test_forensics.db"
        
        # Create a new SQLite database
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Create messages table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sms (
            id INTEGER PRIMARY KEY,
            address TEXT,
            body TEXT,
            date INTEGER,
            type INTEGER
        )
        ''')
        
        # Insert test messages
        cursor.execute('''
        INSERT INTO sms (address, body, date, type) VALUES 
        ('+1234567890', 'Test message 1', 1625097600000, 1),
        ('+9876543210', 'Test message 2', 1625184000000, 2),
        ('+5551234567', 'Evidence message with important data', 1625270400000, 1)
        ''')
        
        # Create contacts table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY,
            name TEXT,
            phone TEXT,
            email TEXT
        )
        ''')
        
        # Insert test contacts
        cursor.execute('''
        INSERT INTO contacts (name, phone, email) VALUES 
        ('John Doe', '+1234567890', 'john@example.com'),
        ('Jane Smith', '+9876543210', 'jane@example.com'),
        ('Suspect Person', '+5551234567', 'suspect@example.com')
        ''')
        
        # Create call logs table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY,
            number TEXT,
            date INTEGER,
            duration INTEGER,
            type INTEGER
        )
        ''')
        
        # Insert test call logs
        cursor.execute('''
        INSERT INTO calls (number, date, duration, type) VALUES 
        ('+1234567890', 1625097600000, 120, 1),
        ('+9876543210', 1625184000000, 45, 2),
        ('+5551234567', 1625270400000, 300, 1)
        ''')
        
        conn.commit()
        conn.close()
        
        return db_file

    def calculate_hash(self, file_path):
        """Calculate SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def test_01_health_check(self):
        """Test health check endpoint"""
        print("\n--- Testing Health Check API ---")
        response = requests.get(f"{API_URL}/health")
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Health check should return 200 OK")
        data = response.json()
        self.assertEqual(data["status"], "healthy", "Health status should be 'healthy'")
        self.assertTrue("timestamp" in data, "Response should include a timestamp")
        
        # Verify timestamp format (ISO 8601 with Z suffix)
        timestamp = data["timestamp"]
        self.assertTrue(timestamp.endswith("Z"), "Timestamp should end with 'Z' for UTC")
        
        # Try to parse the timestamp
        try:
            # Remove the Z and parse
            datetime.fromisoformat(timestamp[:-1])
            is_valid_timestamp = True
        except ValueError:
            is_valid_timestamp = False
        
        self.assertTrue(is_valid_timestamp, f"Timestamp '{timestamp}' should be in ISO format")
        print(f"✅ Health check API working correctly: {data}")

    def test_02_create_case(self):
        """Test case creation endpoint"""
        print("\n--- Testing Case Management API (Create) ---")
        case_data = {
            "case_name": "Test Forensics Case",
            "investigator": "John Investigator",
            "description": "Test case for API validation"
        }
        
        response = requests.post(f"{API_URL}/cases", json=case_data)
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Case creation should return 200 OK")
        data = response.json()
        self.assertTrue(data["success"], "Response should indicate success")
        self.assertTrue("case" in data, "Response should include case data")
        
        # Store case_id for later tests
        self.case_id = data["case"]["case_id"]
        
        # Verify case data
        case = data["case"]
        self.assertEqual(case["case_name"], case_data["case_name"], "Case name should match")
        self.assertEqual(case["investigator"], case_data["investigator"], "Investigator should match")
        self.assertEqual(case["description"], case_data["description"], "Description should match")
        self.assertTrue("created_at" in case, "Case should have creation timestamp")
        self.assertEqual(case["status"], "active", "Case status should be active")
        
        print(f"✅ Case created successfully with ID: {self.case_id}")

    def test_03_list_cases(self):
        """Test case listing endpoint"""
        print("\n--- Testing Case Management API (List) ---")
        response = requests.get(f"{API_URL}/cases")
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Case listing should return 200 OK")
        data = response.json()
        self.assertTrue("cases" in data, "Response should include cases list")
        
        # Verify our test case is in the list
        cases = data["cases"]
        self.assertTrue(len(cases) > 0, "There should be at least one case")
        
        # Find our test case
        test_case = None
        for case in cases:
            if case["case_id"] == self.case_id:
                test_case = case
                break
        
        self.assertIsNotNone(test_case, f"Our test case with ID {self.case_id} should be in the list")
        print(f"✅ Case listing API working correctly, found {len(cases)} cases")

    def test_04_upload_evidence(self):
        """Test evidence upload endpoint"""
        print("\n--- Testing Evidence Upload API ---")
        
        # Ensure we have a case_id
        if not self.case_id:
            self.test_02_create_case()
        
        # Calculate file hash for verification
        expected_hash = self.calculate_hash(self.db_file)
        
        # Upload the SQLite database
        with open(self.db_file, 'rb') as f:
            files = {'file': ('test_forensics.db', f, 'application/octet-stream')}
            response = requests.post(
                f"{API_URL}/cases/{self.case_id}/upload",
                files=files
            )
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Evidence upload should return 200 OK")
        data = response.json()
        self.assertTrue(data["success"], "Response should indicate success")
        self.assertTrue("evidence_id" in data, "Response should include evidence ID")
        self.assertTrue("file_hash" in data, "Response should include file hash")
        self.assertTrue("summary" in data, "Response should include data summary")
        
        # Store evidence_id for later tests
        self.evidence_id = data["evidence_id"]
        
        # Verify file hash
        self.assertEqual(data["file_hash"], expected_hash, "File hash should match calculated hash")
        
        # Verify data extraction
        summary = data["summary"]
        self.assertEqual(summary["messages_count"], 3, "Should extract 3 messages")
        self.assertEqual(summary["contacts_count"], 3, "Should extract 3 contacts")
        self.assertEqual(summary["call_logs_count"], 3, "Should extract 3 call logs")
        
        print(f"✅ Evidence uploaded successfully with ID: {self.evidence_id}")
        print(f"✅ SHA-256 hash verified: {data['file_hash']}")
        print(f"✅ Extracted: {summary['messages_count']} messages, {summary['contacts_count']} contacts, {summary['call_logs_count']} call logs")

    def test_05_get_evidence(self):
        """Test evidence retrieval endpoint"""
        print("\n--- Testing Evidence Retrieval API ---")
        
        # Ensure we have uploaded evidence
        if not self.evidence_id:
            self.test_04_upload_evidence()
        
        response = requests.get(f"{API_URL}/cases/{self.case_id}/evidence")
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Evidence retrieval should return 200 OK")
        data = response.json()
        self.assertTrue("evidence" in data, "Response should include evidence list")
        
        # Verify our test evidence is in the list
        evidence_list = data["evidence"]
        self.assertTrue(len(evidence_list) > 0, "There should be at least one evidence item")
        
        # Find our test evidence
        test_evidence = None
        for evidence in evidence_list:
            if evidence["evidence_id"] == self.evidence_id:
                test_evidence = evidence
                break
        
        self.assertIsNotNone(test_evidence, f"Our test evidence with ID {self.evidence_id} should be in the list")
        
        # Verify evidence data
        self.assertEqual(test_evidence["case_id"], self.case_id, "Case ID should match")
        self.assertTrue("file_hash" in test_evidence, "Evidence should include file hash")
        self.assertTrue("summary" in test_evidence, "Evidence should include summary")
        self.assertTrue("uploaded_at" in test_evidence, "Evidence should include upload timestamp")
        
        # Verify summary counts
        summary = test_evidence["summary"]
        self.assertEqual(summary["messages_count"], 3, "Should have 3 messages")
        self.assertEqual(summary["contacts_count"], 3, "Should have 3 contacts")
        self.assertEqual(summary["call_logs_count"], 3, "Should have 3 call logs")
        
        print(f"✅ Evidence retrieval API working correctly")
        print(f"✅ Evidence summary verified: {summary}")

    def test_06_export_json(self):
        """Test JSON export endpoint"""
        print("\n--- Testing Data Export API (JSON) ---")
        
        # Ensure we have uploaded evidence
        if not self.evidence_id:
            self.test_04_upload_evidence()
        
        export_data = {
            "case_id": self.case_id,
            "data_types": ["messages", "contacts", "call_logs"],
            "export_format": "json"
        }
        
        response = requests.post(f"{API_URL}/export", json=export_data)
        
        # Verify response
        self.assertEqual(response.status_code, 200, "JSON export should return 200 OK")
        self.assertEqual(response.headers["Content-Type"], "application/json", "Content type should be JSON")
        self.assertTrue("X-Export-Hash" in response.headers, "Response should include export hash header")
        self.assertTrue("Content-Disposition" in response.headers, "Response should include content disposition header")
        
        # Verify export hash
        export_hash = response.headers["X-Export-Hash"]
        calculated_hash = hashlib.sha256(response.content).hexdigest()
        self.assertEqual(export_hash, calculated_hash, "Export hash should match calculated hash")
        
        # Verify export data
        export_data = response.json()
        self.assertTrue("export_metadata" in export_data, "Export should include metadata")
        self.assertTrue("data" in export_data, "Export should include data")
        
        # Verify metadata
        metadata = export_data["export_metadata"]
        self.assertEqual(metadata["case_id"], self.case_id, "Case ID should match")
        self.assertEqual(metadata["format"], "json", "Format should be JSON")
        self.assertTrue("export_id" in metadata, "Metadata should include export ID")
        self.assertTrue("exported_at" in metadata, "Metadata should include export timestamp")
        
        # Store export_id for later tests
        self.export_id = metadata["export_id"]
        
        # Verify data
        data = export_data["data"]
        self.assertTrue("messages" in data, "Data should include messages")
        self.assertTrue("contacts" in data, "Data should include contacts")
        self.assertTrue("call_logs" in data, "Data should include call logs")
        self.assertEqual(len(data["messages"]), 3, "Should export 3 messages")
        self.assertEqual(len(data["contacts"]), 3, "Should export 3 contacts")
        self.assertEqual(len(data["call_logs"]), 3, "Should export 3 call logs")
        
        print(f"✅ JSON export successful with ID: {self.export_id}")
        print(f"✅ SHA-256 hash verified: {export_hash}")
        print(f"✅ Exported: {len(data['messages'])} messages, {len(data['contacts'])} contacts, {len(data['call_logs'])} call logs")

    def test_07_export_csv(self):
        """Test CSV export endpoint"""
        print("\n--- Testing Data Export API (CSV) ---")
        
        # Ensure we have uploaded evidence
        if not self.evidence_id:
            self.test_04_upload_evidence()
        
        export_data = {
            "case_id": self.case_id,
            "data_types": ["messages"],  # Just export messages for simplicity
            "export_format": "csv"
        }
        
        response = requests.post(f"{API_URL}/export", json=export_data)
        
        # Verify response
        self.assertEqual(response.status_code, 200, "CSV export should return 200 OK")
        self.assertEqual(response.headers["Content-Type"], "text/csv", "Content type should be CSV")
        self.assertTrue("X-Export-Hash" in response.headers, "Response should include export hash header")
        self.assertTrue("Content-Disposition" in response.headers, "Response should include content disposition header")
        
        # Verify export hash
        export_hash = response.headers["X-Export-Hash"]
        calculated_hash = hashlib.sha256(response.content).hexdigest()
        self.assertEqual(export_hash, calculated_hash, "Export hash should match calculated hash")
        
        # Verify CSV content
        csv_content = response.content.decode('utf-8')
        self.assertTrue(len(csv_content) > 0, "CSV content should not be empty")
        self.assertTrue("address" in csv_content, "CSV should include message address field")
        self.assertTrue("body" in csv_content, "CSV should include message body field")
        
        # Count rows (header + 3 data rows)
        rows = csv_content.strip().split('\n')
        self.assertEqual(len(rows), 4, "CSV should have 4 rows (header + 3 data rows)")
        
        print(f"✅ CSV export successful")
        print(f"✅ SHA-256 hash verified: {export_hash}")
        print(f"✅ CSV format verified with {len(rows)-1} data rows")

    def test_08_export_history(self):
        """Test export history endpoint"""
        print("\n--- Testing Export History API ---")
        
        # Ensure we have created exports
        if not self.export_id:
            self.test_06_export_json()
            self.test_07_export_csv()
        
        response = requests.get(f"{API_URL}/exports/{self.case_id}")
        
        # Verify response
        self.assertEqual(response.status_code, 200, "Export history should return 200 OK")
        data = response.json()
        self.assertTrue("exports" in data, "Response should include exports list")
        
        # Verify exports list
        exports = data["exports"]
        self.assertTrue(len(exports) >= 2, "There should be at least 2 exports (JSON and CSV)")
        
        # Find our test exports
        json_export = None
        csv_export = None
        for export in exports:
            if export["format"] == "json":
                json_export = export
            elif export["format"] == "csv":
                csv_export = export
        
        self.assertIsNotNone(json_export, "JSON export should be in history")
        self.assertIsNotNone(csv_export, "CSV export should be in history")
        
        # Verify export data
        self.assertEqual(json_export["case_id"], self.case_id, "Case ID should match")
        self.assertTrue("exported_at" in json_export, "Export should include timestamp")
        self.assertTrue("file_hash" in json_export, "Export should include file hash")
        
        print(f"✅ Export history API working correctly")
        print(f"✅ Found {len(exports)} exports in history")

    def test_09_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n--- Testing Error Handling ---")
        
        # Test invalid case ID
        invalid_case_id = "invalid-case-id"
        response = requests.get(f"{API_URL}/cases/{invalid_case_id}/evidence")
        self.assertEqual(response.status_code, 404, "Invalid case ID should return 404")
        
        # Test invalid export format
        if not self.case_id:
            self.test_02_create_case()
            
        export_data = {
            "case_id": self.case_id,
            "data_types": ["messages"],
            "export_format": "invalid-format"
        }
        response = requests.post(f"{API_URL}/export", json=export_data)
        self.assertEqual(response.status_code, 400, "Invalid export format should return 400")
        
        print(f"✅ Error handling working correctly")

def run_tests():
    """Run all tests"""
    # Create test suite
    suite = unittest.TestSuite()
    suite.addTest(TestCyberForensicsBackend('test_01_health_check'))
    suite.addTest(TestCyberForensicsBackend('test_02_create_case'))
    suite.addTest(TestCyberForensicsBackend('test_03_list_cases'))
    suite.addTest(TestCyberForensicsBackend('test_04_upload_evidence'))
    suite.addTest(TestCyberForensicsBackend('test_05_get_evidence'))
    suite.addTest(TestCyberForensicsBackend('test_06_export_json'))
    suite.addTest(TestCyberForensicsBackend('test_07_export_csv'))
    suite.addTest(TestCyberForensicsBackend('test_08_export_history'))
    suite.addTest(TestCyberForensicsBackend('test_09_error_handling'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)

if __name__ == "__main__":
    print("Starting CyberForensics Data Extraction Tool Backend API Tests")
    print(f"Backend API URL: {API_URL}")
    run_tests()