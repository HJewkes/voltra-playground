# iOS Development Guide

This guide covers setting up and running the Voltra app on iOS devices.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Understanding Build Types](#understanding-build-types)
- [Quick Start: Simulator](#quick-start-simulator)
- [Running on Physical iPhone](#running-on-physical-iphone)
- [Viewing Console Logs](#viewing-console-logs)
- [Bluetooth Permissions](#bluetooth-permissions)
- [Troubleshooting](#troubleshooting)
- [Useful Commands](#useful-commands)

## Prerequisites

### Required Software

1. **macOS** - iOS development requires a Mac
2. **Xcode** - Install from the App Store (free)
   - After installing, open Xcode once to accept the license and install additional components
3. **Node.js** - v18 or later recommended
4. **CocoaPods** - Will be installed automatically on first build, or install manually:
   ```bash
   brew install cocoapods
   ```

### Apple Account

You need an Apple ID for code signing. A **free Apple ID** works for development on your own devices. You don't need a paid Apple Developer Program membership ($99/year) unless you want to:
- Distribute on the App Store
- Use certain capabilities (Push Notifications, etc.)
- Install on more than ~3 devices

## Understanding Build Types

| Build Type | BLE Support | Use Case |
|------------|-------------|----------|
| **Expo Go** | ❌ No | UI development only |
| **Simulator** | ❌ No | UI development, no real Bluetooth hardware |
| **Dev Build on Device** | ✅ Yes | Full testing with real Voltra devices |

### Expo Go (Limited)
- Pre-built app from App Store
- **Cannot use native BLE** - the `react-native-ble-plx` module isn't included
- Good for UI development only
- Run with: `npx expo start`, scan QR code with Expo Go app

### Development Build (Full Features)
- Custom-built app with all native modules
- **Full BLE support** for connecting to Voltra devices
- Required for testing actual device connectivity
- Run with: `npx expo run:ios` (simulator) or `npx expo run:ios --device` (physical device)

## Quick Start: Simulator

The simulator is great for UI development but **cannot scan for Bluetooth devices**.

```bash
cd mobile
npx expo run:ios
```

First build takes 5-10 minutes. Subsequent builds are faster.

The app will show a "Simulator Detected" warning explaining that BLE isn't available.

## Running on Physical iPhone

Required for testing Bluetooth/BLE functionality. Follow these steps in order:

### Step 1: Enable Developer Mode on iPhone

**On your iPhone:**
1. Go to **Settings → Privacy & Security**
2. Scroll down to find **Developer Mode**
3. Toggle it **ON**
4. Tap **Restart** when prompted
5. After restart, confirm enabling Developer Mode

> ⚠️ This setting only appears after you've connected your iPhone to a Mac with Xcode installed.

### Step 2: Set Up Code Signing in Xcode

1. Open the Xcode project:
   ```bash
   open mobile/ios/Voltra.xcworkspace
   ```

2. In Xcode:
   - Select **Voltra** project in the left sidebar (blue icon)
   - Select **Voltra** target under "TARGETS" (not the project)
   - Go to **Signing & Capabilities** tab
   - Check ✅ **"Automatically manage signing"**
   - Click **Team** dropdown → **Add an Account...**
   - Sign in with your Apple ID
   - Select your **Personal Team** (shows as "Your Name (Personal Team)")

3. Close Xcode (optional, but avoids conflicts)

### Step 3: Connect iPhone

1. Connect your iPhone to your Mac via **USB cable**
2. **Unlock your iPhone**
3. If prompted on iPhone, tap **Trust** to trust your computer
4. Enter your passcode if asked

### Step 4: Build and Install

```bash
cd mobile
npx expo run:ios --device
```

When prompted, select your iPhone from the device list.

The first build takes 5-10 minutes. Subsequent builds are much faster.

### Step 5: Trust the Developer App

After the app installs, you'll likely see an error about "untrusted developer". 

**On your iPhone:**
1. Go to **Settings → General → VPN & Device Management**
2. Under "Developer App", tap your **Apple ID / email**
3. Tap **"Trust [your email]"**
4. Tap **Trust** to confirm

### Step 6: Launch the App

Now you can:
- Open **Voltra** from your home screen, or
- Run `npx expo run:ios --device` again to launch automatically

The app should now be able to scan for and connect to your Voltra device!

## Viewing Console Logs

### Option 1: Metro Bundler (Recommended)

The terminal running Metro shows all `console.log` output:

```bash
cd mobile
npx expo start
```

Then in the app, shake your device → tap **"Reload"** to connect to Metro.

All BLE scanning logs will appear here:
```
[NativeBLE] Starting scan...
[NativeBLE] Bluetooth state: PoweredOn
[NativeBLE] Found device: VTR-XXXXX (...)
```

### Option 2: Xcode Console

For native-level logs:

1. Open `ios/Voltra.xcworkspace` in Xcode
2. Run the app from Xcode (Product → Run or ⌘R)
3. View logs in the bottom Debug area

### Option 3: Safari Web Inspector

For full JavaScript debugging:

1. **On iPhone:** Settings → Safari → Advanced → Enable "Web Inspector"
2. **On Mac:** Safari → Settings → Advanced → "Show Develop menu"
3. Connect iPhone via USB
4. Safari → Develop → [Your iPhone] → JSContext

## Bluetooth Permissions

The app requests Bluetooth permission on first scan. If denied:

1. Go to **Settings → Voltra**
2. Enable **Bluetooth** permission

The app also needs Location permission for BLE scanning (iOS requirement):
- Settings → Voltra → Location → "While Using the App"

## Troubleshooting

### "No code signing certificates available"

You haven't set up signing in Xcode. See [Step 2: Set Up Code Signing](#step-2-set-up-code-signing-in-xcode).

### "Developer Mode disabled" error

Enable Developer Mode on your iPhone. See [Step 1: Enable Developer Mode](#step-1-enable-developer-mode-on-iphone).

### "Untrusted Developer" / App won't launch

Trust the developer certificate on your iPhone. See [Step 5: Trust the Developer App](#step-5-trust-the-developer-app).

### "Input is required" / Can't select device

The `--device` flag requires interactive terminal input. Run the command directly in your terminal (not through an automated script):

```bash
cd mobile && npx expo run:ios --device
```

### Build fails with CocoaPods errors

```bash
cd mobile/ios
pod install --repo-update
cd ..
npx expo run:ios --device
```

### Bluetooth scan finds nothing

1. ✅ Ensure **Bluetooth is enabled** on your iPhone (Settings → Bluetooth)
2. ✅ Ensure the **Voltra device is powered on**
3. ✅ Check app permissions (Settings → Voltra → Bluetooth & Location)
4. ✅ Make sure you're running a **development build**, not Expo Go
5. ✅ Check Metro logs for scan activity

### App shows "Simulator Detected" or "Expo Go Detected"

You're not running the development build on a physical device:
- **Simulator:** BLE doesn't work. Use a physical device.
- **Expo Go:** Doesn't include BLE module. Run `npx expo run:ios --device`.

### Metro not showing logs

Shake device → tap **"Reload"** to reconnect to Metro bundler.

### "Unexpected devicectl JSON version" warning

This warning can usually be ignored. It's a compatibility message between Xcode tooling versions and doesn't affect functionality.

## Useful Commands

```bash
# Start Metro bundler (for hot reload & logs)
npx expo start

# Build and run on simulator
npx expo run:ios

# Build and run on physical device (interactive)
npx expo run:ios --device

# Clean build (if having issues)
cd ios && rm -rf Pods Podfile.lock build && pod install && cd ..
npx expo run:ios --device

# Open in Xcode (for signing setup or debugging)
open ios/Voltra.xcworkspace

# Check connected devices
xcrun devicectl list devices
```

## Project Structure

```
mobile/
├── ios/                    # Native iOS project (auto-generated)
│   ├── Voltra.xcworkspace  # Open this in Xcode
│   ├── Voltra/             # App source
│   └── Pods/               # CocoaPods dependencies
├── src/
│   └── domain/bluetooth/adapters/
│       ├── native.ts       # Native BLE (react-native-ble-plx)
│       ├── web.ts          # Web Bluetooth API
│       └── node.ts         # Node.js (webbluetooth)
└── app.json                # Expo config with iOS permissions
```

## EAS Build (Cloud Alternative)

If local builds aren't working, you can use Expo's cloud build service:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create development build
eas build --profile development --platform ios
```

This builds in the cloud and provides a download link. The free tier includes 30 iOS builds/month.

---

## Summary: First-Time Setup Checklist

- [ ] Install Xcode from App Store
- [ ] Enable Developer Mode on iPhone (Settings → Privacy & Security)
- [ ] Set up code signing in Xcode (open `.xcworkspace`, add Apple ID, select Personal Team)
- [ ] Connect iPhone via USB, trust the computer
- [ ] Run `npx expo run:ios --device`
- [ ] Trust developer certificate on iPhone (Settings → General → VPN & Device Management)
- [ ] Open Voltra app and test BLE scanning!
