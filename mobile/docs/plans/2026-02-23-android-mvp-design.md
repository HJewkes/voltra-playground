# Android MVP Design — "All Modes, Shared Telemetry"

**Date**: 2026-02-23
**Status**: Approved
**Goal**: Ship an Android app to beta testers via Google Play internal testing that lets Voltra owners select any training mode, configure load, and view live telemetry.

## Context

No Android app exists for the BeyondPower Voltra. The existing iOS app supports all training modes. This MVP fills the Android gap with a lean, device-control-focused app. Advanced features (workout planning, VBT, history, RPE) exist in the codebase but are deferred from the initial release — code stays in the repo, just not routed to.

## App Flow

No tab navigation. Linear full-screen flow:

```
Connection → Modes → Exercise (per mode)
```

### Connection Screen (App Root)

Full-screen device connection flow. First thing users see.

**States:**
- **Scanning**: Auto-scan on open. Spinner + discovered device list.
- **Connecting**: Selected device shows spinner + "Connecting..."
- **Connected**: Auto-navigate to Modes screen.
- **No devices**: Message + "Scan Again" button.
- **Error**: Error message + "Retry" button.

**Behavior:**
- Auto-reconnect on app resume if previously connected (skip to Modes)
- Settings accessible via gear icon (auto-reconnect toggle, device management)
- Connection loss from Modes/Exercise navigates back here

### Modes Screen

Grid of 7 training modes (Custom Curves hidden — controls not worked out yet).

Tap a mode → selects it on device + opens mode settings.

**Visible modes:** Weight Training, Resistance Band, Rowing, Damper, Isokinetic, Isometric, Idle

### Mode Settings

Each mode has a settings sub-screen with load configuration + "Start Exercise" button.

| Mode | Settings | Component |
|------|----------|-----------|
| Weight Training | Weight + Chains/Inverse Chains + Eccentric | Existing `WeightTrainingConfig` (LoadProfileChart with 3 handles) |
| Resistance Band | Weight + Eccentric | `BasicModeConfig` + `EccentricSlider` |
| Rowing | Weight | `BasicModeConfig` |
| Damper | Weight | `BasicModeConfig` |
| Isokinetic | Weight | `BasicModeConfig` |
| Isometric | Weight | `BasicModeConfig` |
| Idle | None | Device status display, no start button |

**New component needed:** `BasicModeConfig` — weight picker + start button. Reusable across 5 modes.

Eccentric relevance per mode to be validated during device testing (e.g., does eccentric apply to Resistance Band?).

### Exercise Screen (Sub-page of Mode)

Simplified recording interface. No sets, rest, or planning.

**Displays:**
- Current mode + load summary (header)
- Rep count (large, primary metric)
- Last rep peak velocity (m/s)
- Live phase indicator (concentric/eccentric/hold/idle)
- Live velocity and force
- START / STOP button

**Behavior:**
- START → prepare device → 3-2-1 countdown → recording
- Rep counter auto-increments via existing rep detection (mode-agnostic)
- STOP → disengage motor → idle state (can restart without leaving)
- Back → return to mode config (confirm if recording active)

**Not shown (deferred):** RPE/RIR, velocity loss, rest timer, set management, encouragement messages, position bar.

**Rowing note:** Same view for MVP. Rowing telemetry still produces reps (strokes), velocity, and force. Specialized rowing view (stroke rate, distance, power curve) is v2.

## Technical Approach

### Existing code stays, navigation changes

The existing features (history, VBT, workout planning, exercise picker) remain in `src/` untouched. Only the navigation/routing layer changes:

- Replace tab layout (`app/(tabs)/`) with linear flow
- Exercise session store gets a simplified entry point (mode + weight → go, no picker/planning)
- Unused screens are not deleted — they'll be re-routed when features are added back

### Key architectural findings

- **Telemetry is mode-independent.** `TelemetryFrame` format is identical across all 8 modes. Mode only affects device motor behavior. No special parsing per mode.
- **Recording store is mode-agnostic.** Rep detection via `@voltras/workout-analytics` works on generic `WorkoutSample` regardless of mode.
- **Session store is plan-agnostic.** Accepts any exercise + plan structure. Can bypass the planning layer entirely.
- **All three stores (session, recording, voltra) are tightly coupled** but in a clean way — session orchestrates, recording detects, voltra controls hardware.

### New components needed

1. **`BasicModeConfig`** — Weight picker + start button. Used by 5 modes.
2. **Connection screen layout** — Full-screen version of existing connection components.
3. **Simplified exercise screen** — Stripped-down version of `ExerciseScreen` without session/planning.

### Reused as-is

- `WeightTrainingConfig` + `LoadProfileChart`
- `EccentricSlider`
- `RecordingDisplay` + `WorkoutControls`
- `connection-store` (scan, connect, auto-reconnect)
- `voltra-store` (device control, telemetry pipeline)
- `recording-store` (rep detection, velocity tracking)

## Branding

- **App name**: TBD (e.g., "Voltra", "Voltra Connect")
- **Package ID**: Replace `com.anonymous.voltra` with real identifier
- **App icon**: Needed (standard + adaptive for Android)
- **Splash screen**: Logo on brand color (simple)
- **Store listing**: Minimal — title, short description, 2-3 screenshots

## Build & Distribution

- **EAS**: Set up `eas.json` with preview profile (produces installable APK)
- **Google Play**: Developer account ($25 one-time), internal testing track
- **Internal testing track**: Up to 100 testers, no review required, share via opt-in link. Easiest path to get APKs to Reddit beta testers without sideloading.
- **Promotion path**: Internal → Closed beta → Open beta → Production

## Deferred Features (v2+)

- Workout planning / exercise picker
- Session history + analytics
- VBT (load-velocity profiles, discovery sessions, progression)
- RPE/RIR display + encouragement
- Set/rest management
- Specialized rowing telemetry view
- Custom Curves mode
- Multi-device UI
- iOS release
