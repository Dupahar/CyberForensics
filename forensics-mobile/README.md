# CyberForensics Mobile App

A mobile Android application for digital forensics data extraction and export.

## Features

- **Mobile Forensics**: Extract data directly on Android devices
- **Case Management**: Create and manage forensics cases
- **Evidence Upload**: Process SQLite databases and backup files
- **Data Export**: Export messages, contacts, and call logs
- **SHA-512 Integrity**: Evidence verification with SHA-512 hashing
- **Offline Capable**: Works with local database files

## Installation

### Option 1: Direct APK Installation (Recommended)
1. Download the APK from releases
2. Enable "Install from unknown sources" in Android settings
3. Install the APK file
4. Open CyberForensics Mobile app

### Option 2: Build from Source
```bash
# Install dependencies
npm install

# Install EAS CLI
npm install -g @expo/eas-cli

# Build APK
eas build --platform android --profile preview
```

## Setup

1. **Configure Backend URL**: 
   - Open `App.js`
   - Change `API_BASE_URL` to your server's IP address
   - Example: `http://192.168.1.100:8001`

2. **Start Backend Server**:
   - Ensure your CyberForensics backend is running
   - Backend should be accessible from mobile device's network

## Usage

### Basic Workflow
1. **Create Case**: Add investigator details and case information
2. **Upload Evidence**: Select database files (.db, .sqlite, .zip)
3. **Review Data**: View extracted messages, contacts, call logs
4. **Export Data**: Download forensics reports in JSON format

### Supported File Types
- Android SQLite databases (.db, .sqlite, .sqlite3)
- iOS backup archives (.zip)
- WhatsApp databases
- SMS/MMS databases
- Contact databases

## Security Features

- **SHA-512 Hashing**: All evidence files are hashed for integrity
- **Forensics Timestamps**: UTC timestamps for legal admissibility
- **Offline Processing**: Data processed locally on device
- **No Cloud Storage**: All data remains on device

## Network Requirements

- Backend server must be accessible from mobile device
- Same WiFi network recommended for best performance
- Internet connection required for initial setup only

## Permissions

The app requires the following Android permissions:
- `READ_EXTERNAL_STORAGE`: Access uploaded files
- `WRITE_EXTERNAL_STORAGE`: Save exported data
- `INTERNET`: Connect to backend server
- `ACCESS_NETWORK_STATE`: Check network connectivity

## Troubleshooting

### Cannot Connect to Backend
1. Verify backend server is running on port 8001
2. Check IP address in `API_BASE_URL`
3. Ensure mobile device is on same network
4. Test backend URL in mobile browser first

### File Upload Fails
1. Check file permissions
2. Verify file format (.db, .sqlite, .zip)
3. Ensure file is not corrupted
4. Try smaller files first

### Export Not Working
1. Check device storage space
2. Verify write permissions
3. Try different export format
4. Check network connection

## Development

### Running in Development
```bash
# Start Expo development server
npm start

# Run on Android device/emulator
npm run android
```

### Building APK
```bash
# Configure EAS
eas login
eas build:configure

# Build preview APK
eas build --platform android --profile preview

# Download APK when build completes
```

## Technical Details

- **Framework**: React Native with Expo
- **UI Components**: React Native Paper + Material Icons
- **File Handling**: Expo Document Picker + File System
- **Network**: Fetch API with FormData for uploads
- **Security**: SHA-512 hashing, secure file handling

## Legal Notice

This tool is designed for legitimate digital forensics and cybersecurity purposes only. Users are responsible for complying with all applicable laws and regulations regarding data access and privacy.