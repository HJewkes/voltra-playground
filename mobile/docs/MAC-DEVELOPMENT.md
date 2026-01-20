# Mac Development Guide

This guide covers developing and testing the Voltra app on macOS using the web browser and Python BLE relay.

## Overview

Since web browsers don't have direct Bluetooth access, we use a **Python BLE relay** that:
1. Runs on your Mac and connects to the Voltra device via Bluetooth
2. Exposes a WebSocket server that the web app connects to
3. Proxies BLE commands and telemetry between the web app and device

```
┌─────────────┐     WebSocket      ┌─────────────┐     Bluetooth     ┌────────────┐
│   Web App   │ ◄──────────────────►│  Python     │ ◄─────────────────►│   Voltra   │
│  (Browser)  │   localhost:8765   │   Relay     │                    │   Device   │
└─────────────┘                    └─────────────┘                    └────────────┘
```

## Prerequisites

- **macOS** with Bluetooth
- **Python 3.9+**
- **Node.js 18+**

## Quick Start

### One-Time Setup

```bash
# Install all dependencies
make setup
```

This installs:
- Mobile app dependencies (`npm install`)
- Python virtual environment with relay dependencies

### Daily Development

```bash
# Start everything (relay + web app)
make dev
```

This will:
1. Start the BLE relay in the background
2. Open the web app at http://localhost:8081

Or run them separately:

```bash
# Terminal 1: Start the relay
make relay

# Terminal 2: Start the web app
make web
```

## How It Works

### The BLE Relay (`relay/main.py`)

The relay is a FastAPI WebSocket server that:

1. **Scans** for Voltra devices when requested
2. **Connects** to a device and handles authentication
3. **Proxies** commands (set weight, start/stop workout)
4. **Streams** telemetry data back to the web app

The relay uses the `bleak` library for cross-platform BLE on macOS.

### Web App BLE Detection

The app automatically detects the environment:

| Environment | BLE Method | Auto-detected |
|-------------|------------|---------------|
| Web browser | Relay (WebSocket) | ✅ Yes |
| iOS device | Native BLE | ✅ Yes |
| iOS Simulator | None (shows warning) | ✅ Yes |
| Expo Go | None (shows warning) | ✅ Yes |

The detection logic is in `src/domain/bluetooth/models/environment.ts` and exposed via `connection-store`.

### Configuration

BLE relay settings are centralized in `src/config/index.ts`:

```typescript
export const RELAY_PORT = 8765;
export const RELAY_HOST = 'localhost';
export const RELAY_WS_URL = `ws://${RELAY_HOST}:${RELAY_PORT}/ws`;
export const RELAY_HTTP_URL = `http://${RELAY_HOST}:${RELAY_PORT}`;
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start relay (background) + web app |
| `make web` | Start web app only |
| `make relay` | Start relay in foreground (see logs) |
| `make relay-bg` | Start relay in background |
| `make relay-stop` | Stop background relay |

## Relay Service Details

### Starting the Relay

```bash
# Foreground (see all logs)
make relay

# Background (logs to file)
make relay-bg
```

### Checking Relay Status

The web app shows relay status in Settings:
- ✅ **Connected** - Relay is running and accessible
- ⏳ **Checking...** - Attempting to connect
- ❌ **Disconnected** - Relay not running

You can also check manually:

```bash
# Check if relay is responding
curl http://localhost:8765/

# View background relay logs
tail -f /tmp/voltra-relay.log
```

### Stopping the Relay

```bash
make relay-stop
```

## Troubleshooting

### "BLE relay not running" error

The relay service isn't running or isn't accessible:

```bash
# Start the relay
make relay

# Or check if it's already running
ps aux | grep "relay/main.py"
```

### Relay starts but can't find Voltra

1. Make sure the Voltra device is **powered on**
2. Check that **Bluetooth is enabled** on your Mac
3. Check the relay logs for scan results:
   ```bash
   make relay  # Run in foreground to see logs
   ```

### WebSocket connection errors

If the web app can't connect to the relay:

1. Check the relay is running on the correct port (8765)
2. Check for firewall issues
3. Try restarting the relay:
   ```bash
   make relay-stop
   make relay-bg
   ```

### "Address already in use" error

Another process is using port 8765:

```bash
# Find and kill the process
lsof -i :8765
kill <PID>

# Or use a different port by editing relay/main.py
```

## Architecture Notes

### Why a Relay?

Web browsers have limited Bluetooth support:
- **Web Bluetooth API** exists but has restrictions
- Not supported in all browsers
- Requires HTTPS and user gestures
- Can't run in background

The relay approach:
- Works in any browser
- Full BLE feature support
- Consistent with how native app works
- Easy to debug (can log all BLE traffic)

### Relay Protocol

The relay uses JSON messages over WebSocket:

```json
// Scan request
{"type": "scan", "timeout": 5}

// Connect request  
{"type": "connect", "device_id": "..."}

// Write command
{"type": "write", "data": "base64..."}

// Telemetry notification
{"type": "notification", "data": "base64..."}
```

### File Structure

```
relay/
├── main.py           # FastAPI WebSocket server
└── requirements.txt  # Python dependencies (bleak, fastapi, etc.)

mobile/src/
├── domain/
│   └── bluetooth/
│       ├── adapters/
│       │   ├── index.ts      # createBLEAdapter factory
│       │   ├── native.ts     # Native BLE (react-native-ble-plx)
│       │   ├── proxy.ts      # WebSocket proxy to relay
│       │   └── types.ts      # Shared interfaces
│       └── models/
│           └── environment.ts  # BLE environment detection
├── stores/
│   └── connection-store.ts   # Device connection, exposes bleEnvironment
└── config/
    └── index.ts              # Relay URL configuration
```

## Comparison: Web vs iOS Development

| Aspect | Web (Mac) | iOS Device |
|--------|-----------|------------|
| BLE Method | Python relay | Native |
| Setup | `make setup` | Xcode signing required |
| Start | `make dev` | `make ios-device` |
| Hot Reload | ✅ Yes | ✅ Yes |
| Real BLE | ✅ Via relay | ✅ Native |
| Best For | Quick iteration | Final testing |

## Next Steps

- For iOS device development, see [iOS-DEVELOPMENT.md](./iOS-DEVELOPMENT.md)
- For the main project overview, see the root [README.md](../../README.md)
