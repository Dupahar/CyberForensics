# CyberForensics Data Extraction Tool

A professional-grade forensics tool for extracting and exporting digital evidence from mobile devices.

## Features

- **Export Messages**: Extract text messages, WhatsApp, Telegram conversations
- **Export Contacts**: Extract contact information and address books  
- **Export Call Logs**: Extract call history with metadata
- **Data Integrity**: SHA-256 hashing for evidence verification
- **Evidence Timestamps**: Forensics-grade timestamping
- **Multiple Formats**: JSON and CSV export options

## Supported Sources

- Android device backups and databases
- iOS device backups  
- Local database files (SQLite, etc.)

## Technology Stack

- Frontend: React with Tailwind CSS
- Backend: FastAPI with Python
- Database: MongoDB
- Security: SHA-256 hashing, evidence logging

## Usage

1. Upload device backup or database files
2. Select data types to extract (messages, contacts, call logs)
3. Export in preferred format (JSON/CSV)
4. Verify data integrity with provided hashes

Built for cybersecurity professionals and digital forensics investigators.