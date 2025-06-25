# Building CyberForensics Mobile APK

Complete instructions for building and deploying the CyberForensics mobile app.

## Prerequisites

1. **Node.js** (v16 or later)
2. **Expo CLI** and **EAS CLI**
3. **Expo Account** (free)
4. **Android Studio** (optional, for local builds)

## Quick Setup

### 1. Install Required Tools
```bash
# Install Expo CLI and EAS CLI globally
npm install -g @expo/eas-cli expo-cli

# Navigate to mobile project
cd /app/forensics-mobile

# Install dependencies
npm install
```

### 2. Configure Expo Account
```bash
# Login to Expo (create free account if needed)
eas login

# Initialize EAS build configuration
eas build:configure
```

### 3. Update Backend URL
Edit `/app/forensics-mobile/App.js`:
```javascript
// Change this to your computer's IP address
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:8001';
// Example: 'http://192.168.1.100:8001'
```

**To find your IP address:**
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr show`

### 4. Build APK
```bash
# Build APK for distribution
eas build --platform android --profile preview

# Monitor build progress
# Download APK when build completes
```

## Detailed Build Process

### Option 1: Cloud Build (Recommended)
```bash
# Navigate to project
cd /app/forensics-mobile

# Start build process
eas build --platform android --profile preview

# Wait for build to complete (5-15 minutes)
# Download APK from provided URL
```

### Option 2: Local Build (Advanced)
```bash
# Requires Android SDK and NDK
# Setup local build environment
eas build --platform android --local

# Build locally
npx expo run:android --variant release
```

## Distribution Options

### 1. Direct APK Installation
- Download APK from EAS build
- Transfer to Android device
- Enable "Install from unknown sources"
- Install APK file

### 2. Internal Distribution
```bash
# Create internal distribution build
eas build --platform android --profile preview

# Share download link with team
```

### 3. Google Play Store (Production)
```bash
# Build production app bundle
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

## Testing the Mobile App

### 1. Backend Setup
```bash
# Start backend server (from main project)
cd /app
sudo supervisorctl restart backend

# Verify backend is accessible
curl http://YOUR_IP:8001/api/health
```

### 2. Mobile App Testing
1. Install APK on Android device
2. Open CyberForensics Mobile app
3. Create a test case
4. Upload a database file
5. Verify data extraction
6. Test export functionality

### 3. Network Configuration
- Ensure mobile device and server are on same network
- Check firewall settings allow port 8001
- Test backend connectivity from mobile browser first

## APK Signing

### Development Builds
```bash
# Development builds are automatically signed by Expo
eas build --platform android --profile preview
```

### Production Builds
```bash
# Generate keystore (one-time setup)
eas credentials:configure

# Build signed production APK
eas build --platform android --profile production
```

## File Structure
```
forensics-mobile/
├── App.js                 # Main application code
├── app.json              # App configuration
├── eas.json              # EAS build configuration
├── package.json          # Dependencies
├── assets/               # Icons and images
├── node_modules/         # Installed packages
└── README.md            # Documentation
```

## Common Build Issues

### 1. Build Fails
```bash
# Clear cache and retry
expo r -c
npm install
eas build --platform android --profile preview --clear-cache
```

### 2. Network Issues
- Update `API_BASE_URL` with correct IP
- Check backend server is running
- Test connectivity with mobile browser

### 3. File Upload Problems
- Verify file permissions in app.json
- Check Android storage permissions
- Test with smaller files first

## Environment Variables

Create `.env` file in `/app/forensics-mobile/`:
```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:8001
```

Update App.js to use environment variable:
```javascript
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.100:8001';
```

## Final Checklist

Before building APK:
- [ ] Backend server is running and accessible
- [ ] Correct IP address in `API_BASE_URL`
- [ ] All dependencies installed
- [ ] EAS configured and logged in
- [ ] Android permissions configured in app.json
- [ ] Test basic functionality with `expo start`

## Build Command Summary
```bash
# Quick build command
cd /app/forensics-mobile && eas build --platform android --profile preview

# Monitor build
eas build:list

# Download APK when ready
```

The APK will be available for download once the build completes. Share the download link or transfer the APK file to Android devices for installation.