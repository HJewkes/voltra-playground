# Android Development Guide

This guide covers setting up and running the Voltra app on Android devices.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Understanding Build Types](#understanding-build-types)
- [One-Time Setup](#one-time-setup)
- [Running on Physical Device](#running-on-physical-device)
- [Viewing Console Logs](#viewing-console-logs)
- [Bluetooth Permissions](#bluetooth-permissions)
- [Troubleshooting](#troubleshooting)
- [Useful Commands](#useful-commands)

## Prerequisites

### Required Software

1. **macOS** with Homebrew installed
2. **Node.js** - v18 or later recommended
3. **Android Studio** - For SDK and build tools
4. **Java JDK 17** - Required for Gradle builds

### Physical Device Required

Unlike iOS, Android emulators **do not support Bluetooth**. You need a physical Android device to test BLE functionality with Voltra devices.

## Understanding Build Types

| Build Type | BLE Support | Use Case |
|------------|-------------|----------|
| **Expo Go** | ❌ No | UI development only |
| **Emulator** | ❌ No | UI development, no real Bluetooth hardware |
| **Dev Build on Device** | ✅ Yes | Full testing with real Voltra devices |

### Expo Go (Limited)
- Pre-built app from Play Store
- **Cannot use native BLE** - the `react-native-ble-plx` module isn't included
- Good for UI development only
- Run with: `npx expo start`, scan QR code with Expo Go app

### Development Build (Full Features)
- Custom-built app with all native modules
- **Full BLE support** for connecting to Voltra devices
- Required for testing actual device connectivity
- Run with: `npx expo run:android`

## One-Time Setup

### Step 1: Install Android Studio

```bash
brew install --cask android-studio
```

After installation, open Android Studio and complete the setup wizard:

1. Click **"Next"** on the welcome screen
2. Choose **"Standard"** installation type (installs SDK, emulator, platform tools)
3. Accept the licenses and click **"Finish"**
4. Wait for the SDK download to complete (~1GB)

### Step 2: Install Java JDK 17

```bash
brew install openjdk@17
```

### Step 3: Configure Environment Variables

Add the following to your shell configuration (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
# Java JDK 17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Reload your shell configuration:

```bash
source ~/.zshrc
```

### Step 4: Verify Installation

```bash
java -version   # Should show OpenJDK 17.x.x
adb --version   # Should show Android Debug Bridge version
```

## Running on Physical Device

### Step 1: Enable Developer Options on Phone

1. Go to **Settings → About Phone**
2. Tap **"Build number"** 7 times
3. You'll see "You are now a developer!"

### Step 2: Enable USB Debugging

1. Go to **Settings → Developer options**
2. Enable **"USB debugging"**

### Step 3: Connect Device

1. Connect your Android phone to your Mac via **USB cable**
2. **Unlock your phone**
3. When prompted, tap **"Allow"** for USB debugging
   - Check "Always allow from this computer" for convenience

### Step 4: Verify Connection

```bash
adb devices
```

You should see your device listed with `device` status:

```
List of devices attached
XXXXXXXXX    device
```

If it shows `unauthorized`:
1. Check your phone for the USB debugging prompt and tap "Allow"
2. If no prompt, go to **Settings → Developer options → Revoke USB debugging authorizations**
3. Unplug and replug the USB cable
4. Accept the prompt when it appears

### Step 5: Build and Run

```bash
cd mobile
npm install        # If not already done
npx expo run:android
```

The first build takes several minutes (downloads Gradle, builds native code). Subsequent builds are much faster.

The app will automatically install and launch on your connected device.

## Viewing Console Logs

### Option 1: Metro Bundler (Recommended)

The terminal running Metro shows all `console.log` output:

```bash
npx expo start
```

Press `a` to open on Android. All logs appear in this terminal:

```
[NativeBLE] Starting scan...
[NativeBLE] Bluetooth state: PoweredOn
[NativeBLE] Found device: VTR-XXXXX (...)
```

### Option 2: ADB Logcat

For native-level logs and crash details:

```bash
# All logs (verbose)
adb logcat

# Filter to app logs only
adb logcat | grep -E "(ReactNativeJS|NativeBLE|BluetoothGatt)"

# Clear logs and start fresh
adb logcat -c && adb logcat
```

### Option 3: Chrome DevTools

For full JavaScript debugging:

1. Run the app on your device
2. Shake device or run `adb shell input keyevent 82` to open dev menu
3. Tap **"Debug"**
4. Chrome opens at `chrome://inspect`
5. Click **"Inspect"** on your device

## Bluetooth Permissions

Android requires runtime permissions for Bluetooth. The app requests these automatically, but users must grant them.

### Required Permissions

| Permission | Android Version | Purpose |
|------------|-----------------|---------|
| `BLUETOOTH_SCAN` | 12+ (API 31+) | Find nearby devices |
| `BLUETOOTH_CONNECT` | 12+ (API 31+) | Connect to devices |
| `ACCESS_FINE_LOCATION` | All | Required for BLE scanning (Android policy) |

When first scanning for devices, accept **all permission prompts**:
- "Allow Voltra to find, connect to, and determine the relative position of nearby devices?"
- "Allow Voltra to access this device's location?"

### Checking Permissions

If Bluetooth isn't working:

1. Go to **Settings → Apps → Voltra → Permissions**
2. Ensure these are enabled:
   - **Nearby devices** (for Bluetooth)
   - **Location** (required for BLE scanning)

## Troubleshooting

### "Device is not authorized to use native ble"

Bluetooth permissions weren't granted:

1. The permission prompts may have been denied
2. Go to **Settings → Apps → Voltra → Permissions**
3. Enable **Nearby devices** and **Location**

Or uninstall and reinstall the app to re-trigger permission prompts.

### Device Disconnects After a Few Seconds

The Voltra device requires authentication within a tight time window. This is handled automatically in the current codebase with immediate authentication writes after connection. If you're seeing disconnects:

1. Check you're on the latest code
2. Ensure patches are applied: `npx patch-package`
3. Rebuild: `npx expo run:android`

### Build Fails: "Unable to locate a Java Runtime"

Java isn't installed or `JAVA_HOME` isn't set:

```bash
# Check Java
java -version
echo $JAVA_HOME

# If not working, reinstall and check shell config
brew install openjdk@17
source ~/.zshrc
```

### Build Fails: Gradle Errors

```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo run:android
```

### "adb devices" Shows Nothing

1. **Check USB cable** - Some cables are charge-only. Try a different cable that supports data transfer.
2. **Ensure USB debugging is enabled** - Settings → Developer options → USB debugging
3. **Check USB mode** - Pull down notification shade after plugging in, ensure it's set to "File transfer" (MTP), not "Charging only"
4. **Unlock your phone** - The authorization prompt only appears when the phone is unlocked
5. **Revoke and re-authorize** - This often fixes stale authorization issues:
   - Go to **Settings → Developer options → Revoke USB debugging authorizations**
   - Unplug the USB cable
   - Plug it back in
   - Accept the "Allow USB debugging?" prompt on your phone
6. **Restart adb server:**
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
7. **Try different USB ports** - Some ports may not work properly

### App Crashes on Bluetooth Disconnect

The app includes a patch for `react-native-ble-plx` that fixes a crash when devices disconnect. Ensure patches are applied:

```bash
npx patch-package
npx expo run:android
```

### Metro Not Showing Logs

1. Shake device to open dev menu
2. Tap **"Reload"** to reconnect to Metro bundler

Or restart Metro:

```bash
npx expo start --clear
```

## Useful Commands

```bash
# Install dependencies
npm install

# Build and run on physical USB device (recommended)
make android-device
# Or: npx expo run:android --device

# Build and run (emulator or device picker)
make android
# Or: npx expo run:android

# Start Metro bundler only (for hot reload & logs)
npx expo start

# Check connected devices
adb devices

# View device logs
adb logcat | grep ReactNativeJS

# Clear logs
adb logcat -c

# Open dev menu on device
adb shell input keyevent 82

# Trigger reload
adb shell input text "r"

# Install APK manually
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Uninstall app
adb uninstall com.anonymous.voltra

# Re-apply patches after npm install
npx patch-package
```

## Project Structure

```
mobile/
├── android/                  # Native Android project (auto-generated by prebuild)
│   ├── app/
│   │   └── build/outputs/    # Built APKs
│   └── gradlew               # Gradle wrapper
├── patches/                  # Patches for native dependencies
│   └── react-native-ble-plx+3.5.0.patch
├── src/
│   └── domain/
│       └── bluetooth/
│           ├── adapters/
│           │   ├── native.ts   # Native BLE (react-native-ble-plx)
│           │   ├── web.ts      # Web Bluetooth API (browser)
│           │   └── node.ts     # Node.js (webbluetooth)
│           └── models/
│               └── environment.ts  # Platform detection
└── app.json                  # Expo config with Android permissions
```

## Comparison: Android vs iOS Development

| Aspect | Android | iOS |
|--------|---------|-----|
| IDE Setup | Android Studio + JDK | Xcode |
| Build Tool | Gradle | Xcode Build |
| Code Signing | Not required for debug | Apple ID required |
| First Build Time | ~5-10 minutes | ~5-10 minutes |
| BLE Permissions | Runtime prompts | Runtime prompts |
| Emulator BLE | ❌ Not supported | ❌ Not supported |

## Next Steps

- For iOS device development, see [iOS-DEVELOPMENT.md](./iOS-DEVELOPMENT.md)
- For the main project overview, see the root [README.md](../../README.md)
