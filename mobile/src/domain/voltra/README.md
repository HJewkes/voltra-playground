# domain/voltra

Voltra device-specific BLE protocol, telemetry decoding, and recording control.

## Overview

This module handles everything specific to the Voltra cable machine:

- BLE protocol encoding/decoding
- Telemetry frame parsing
- Device state management
- Weight/chains/eccentric commands
- Recording lifecycle (start/stop)

## Terminology

- **Recording**: A period when the Voltra device is actively streaming telemetry data, typically corresponding to a single set. This is distinct from "Workout" which refers to the full training session containing multiple sets/exercises.

## Architecture

The Voltra domain is responsible for **device communication only**. Analytics computation has been moved to the `recording-store` which uses `domain/workout` aggregators.

### Responsibilities

**IN this domain:**

- Connect to device (via bluetooth domain)
- Send commands (weight, chains, eccentric, recording start/stop)
- Decode BLE notifications to TelemetryFrames
- Emit raw frame events
- Provide SampleAdapter to convert TelemetryFrame → WorkoutSample

**NOT in this domain (moved to recording-store + workout domain):**

- Rep detection (now in `domain/workout/detectors/RepDetector`)
- Analytics computation (now in `recording-store` using workout aggregators)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              domain/voltra                                   │
│                                                                             │
│  BLE Notification → Decoder → TelemetryFrame → voltra-store (raw frames)   │
│                                                      │                      │
│                               SampleAdapter ←────────┘                      │
│                                    │                                        │
└────────────────────────────────────│────────────────────────────────────────┘
                                     ↓
┌────────────────────────────────────│────────────────────────────────────────┐
│                           recording-store                                   │
│                                    │                                        │
│                            WorkoutSample                                    │
│                                    │                                        │
│                             RepDetector                                     │
│                                    │                                        │
│                             Aggregators                                     │
│                                    │                                        │
│                          Rep → SetMetrics                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Adapter Pattern

### SampleAdapter (adapters/sample-adapter.ts)

Thin conversion layer that:

- Normalizes position (Voltra 0-600 → 0-1)
- Maps phase enums (Voltra MovementPhase → Workout MovementPhase)
- Extracts absolute force value

**No metric computation** - that's all in `domain/workout/aggregators`.

### TelemetryController

The TelemetryController now has a focused role:

1. Receives BLE notifications
2. Decodes to TelemetryFrame (Voltra-specific)
3. Emits raw frame events
4. Tracks recent frames for UI display

Events emitted:

- `frame` - Raw TelemetryFrame
- `recordingStarted` - Recording has begun
- `recordingEnded` - Recording has ended (with duration)

## Key Types

| Type | Purpose |
|------|---------|
| `TelemetryFrame` | Raw BLE data point from Voltra |
| `TelemetryState` | Current frame and recent frames (for UI) |
| `VoltraDevice` | Device state and settings |

## Protocol

The `protocol/` subdirectory contains:

- BLE constants and UUIDs
- Command builders for weight/chains/eccentric
- Telemetry decoder for BLE notifications
- Protocol data in JSON format

## Stores

### voltra-store

Device-level state:

- Device identity and settings
- Connection state
- Recording lifecycle
- Raw frames (currentFrame, recentFrames)

### recording-store (separate)

Analytics state (uses voltra-store frames):

- reps, lastRep
- setMetrics
- velocityLoss, rpe, rir

## Adding Support for New Devices

If you need to support a different device:

1. Create a new domain module (e.g., `domain/barbell/`)
2. Implement a SampleAdapter that converts your device's data to `WorkoutSample`
3. The workout aggregators and RepDetector handle all metric computation automatically
