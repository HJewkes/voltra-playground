# Voltra

A React Native app for controlling Beyond Power Voltra resistance training devices with velocity-based training analytics.

## Features

- **Device Control**: Connect via Bluetooth, set resistance (5-200 lbs)
- **Real-time Telemetry**: Live force, velocity, and position data
- **Velocity-Based Training**: Automatic RPE/RIR estimation from velocity loss
- **Weight Discovery**: Guided flow to find optimal working weight for new exercises
- **Workout History**: Track performance, view trends, detect PRs

## Quick Start

### Prerequisites

- Node.js 18+
- Xcode (for iOS)
- Android Studio + JDK 17 (for Android)

### Setup

```bash
make setup
```

### Development Options

#### Option 1: Android Device (Recommended)

Build and run on your Android phone with native Bluetooth:

```bash
make android-device
```

Requires Android Studio and JDK setup. See [Android Development Guide](mobile/docs/ANDROID-DEVELOPMENT.md).

#### Option 2: iOS Device

Build and run on your iPhone with native Bluetooth:

```bash
make ios-device
```

Requires one-time Xcode setup. See [iOS Development Guide](mobile/docs/iOS-DEVELOPMENT.md).

#### Option 3: Web Browser

Uses the Web Bluetooth API to connect from Chrome or Edge:

```bash
make dev
```

Opens http://localhost:8081. Requires Chrome, Edge, or Opera (Safari/Firefox don't support Web Bluetooth).

#### Option 4: iOS Simulator (UI Only)

For UI development without Bluetooth:

```bash
make ios-sim
```

## Make Commands

```bash
make help              # Show all commands

# Setup
make setup             # Install all dependencies

# Mac Development
make dev               # Start web app

# iOS Development  
make ios-device        # Build & run on physical iPhone
make ios-sim           # Build & run on Simulator

# Android Development
make android-device    # Build & run on physical Android device (USB)

# Testing
make test              # Run all tests
make test-watch        # Run tests in watch mode

# Utilities
make typecheck         # Run TypeScript checks
make clean             # Remove build artifacts
```

## Project Structure

```
voltras/
├── mobile/                  # React Native app (Expo)
│   ├── app/                 # Expo Router screens
│   ├── src/
│   │   ├── domain/          # Business logic (see below)
│   │   ├── stores/          # Zustand state management
│   │   ├── components/      # React components
│   │   ├── data/            # Persistence layer
│   │   └── theme/           # Colors, spacing, typography
│   └── docs/
│       ├── ANDROID-DEVELOPMENT.md
│       └── iOS-DEVELOPMENT.md
├── Makefile
└── README.md
```

## Architecture

### Domain Modules

```
domain/
├── bluetooth/     # Generic BLE infrastructure
├── exercise/      # Exercise definitions (metadata only)
├── planning/      # Unified planning system (TrainingGoal enum lives here)
├── vbt/           # VBT constants, load-velocity profiles
├── voltra/        # Voltra device protocol and telemetry
├── workout/       # Sessions, plans, rep detection, metrics
└── history/       # Velocity baselines, PRs, trends
```

### BLE Abstraction Layer

The app automatically detects the environment and uses the appropriate BLE adapter:

| Environment | BLE Adapter |
|-------------|-------------|
| Web browser (Chrome/Edge) | Web Bluetooth API |
| iOS device | Native (react-native-ble-plx) |
| Android device | Native (react-native-ble-plx) |
| Node.js | webbluetooth npm package |
| iOS Simulator | None (shows warning) |
| Android Emulator | None (no BLE support) |
| Expo Go | None (shows warning) |

### Tech Stack

- **Expo** with Expo Router
- **Zustand** for state management
- **NativeWind** (Tailwind CSS) for styling
- **react-native-ble-plx** for native Bluetooth
- **Vitest** for unit testing

## Documentation

- [iOS Development Guide](mobile/docs/iOS-DEVELOPMENT.md) - Building for iPhone
- [Android Development Guide](mobile/docs/ANDROID-DEVELOPMENT.md) - Building for Android

## Velocity-Based Training

The app uses velocity loss to estimate fatigue:

| Velocity Loss | Est. RIR | RPE |
|--------------|----------|-----|
| 10% | 5+ | 5 |
| 20% | 3 | 7 |
| 30% | 2 | 8 |
| 40% | 1 | 9 |
| 50%+ | 0 | 10 |

## Limitations

- Weight range: 5-200 lbs in 5 lb increments
- Single device only (no twin/dual mode)

## Credits

- **Beyond Power** for creating the Voltra - an incredible piece of hardware
- **[annondeus](https://www.reddit.com/user/annondeus/)** for reverse-engineering the BLE protocol and creating [OverVolt](https://github.com/anktyre/OverVolt), which made this project possible

## License

MIT License

## Disclaimer

Unofficial app. Not affiliated with Beyond Power. Use at your own risk.
