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
- Python 3.9+ (for Mac development)
- Xcode (for iOS)

### Setup

```bash
make setup
```

### Development Options

#### Option 1: Mac + Web Browser (Easiest)

Uses a Python BLE relay to connect to your Voltra from a web browser:

```bash
make dev
```

Opens http://localhost:8081 with full BLE support via relay.

See [Mac Development Guide](mobile/docs/MAC-DEVELOPMENT.md) for details.

#### Option 2: iOS Device (Full Native)

Build and run directly on your iPhone with native Bluetooth:

```bash
make ios-device
```

Requires one-time Xcode setup. See [iOS Development Guide](mobile/docs/iOS-DEVELOPMENT.md).

#### Option 3: iOS Simulator (UI Only)

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
make dev               # Start relay + web app together
make web               # Start web app only
make relay             # Start BLE relay (foreground)

# iOS Development  
make ios-device        # Build & run on physical iPhone
make ios-sim           # Build & run on Simulator

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
│   │   ├── ble/             # BLE abstraction (native + proxy)
│   │   ├── stores/          # Zustand state management
│   │   ├── protocol/        # Voltra device protocol
│   │   └── ...
│   └── docs/
│       ├── iOS-DEVELOPMENT.md
│       └── MAC-DEVELOPMENT.md
├── relay/                   # Python BLE relay (Mac dev)
│   └── main.py
├── Makefile
└── README.md
```

## Architecture

### BLE Abstraction Layer

The app automatically detects the environment and uses the appropriate BLE method:

| Environment | BLE Method |
|-------------|------------|
| Web browser | WebSocket → Python relay |
| iOS device | Native (react-native-ble-plx) |
| iOS Simulator | None (shows warning) |
| Expo Go | None (shows warning) |

### Tech Stack

- **Expo** with Expo Router
- **Zustand** for state management
- **NativeWind** (Tailwind CSS) for styling
- **react-native-ble-plx** for native Bluetooth

## Documentation

- [Mac Development Guide](mobile/docs/MAC-DEVELOPMENT.md) - Web development with BLE relay
- [iOS Development Guide](mobile/docs/iOS-DEVELOPMENT.md) - Building for iPhone

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
