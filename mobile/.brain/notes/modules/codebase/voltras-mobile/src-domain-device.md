---
title: "Architecture: src/domain/device"
type: architecture
tier: slow
module: codebase
module-path: src/domain/device
language: typescript
exports-hash: "8f2c7632ed5f99786cab34651963c8819ce26d116985d074305819bd41b2a482"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.412Z
modified: 2026-03-14T15:53:10.412Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| BLEEnvironmentInfo | interface | export interface BLEEnvironmentInfo |
| detectBLEEnvironment | function | export function detectBLEEnvironment(): BLEEnvironmentInfo |
| detectBLEEnvironment | const | export |
| toWorkoutSample | const | export |
| toWorkoutSample | function | export function toWorkoutSample(frame: TelemetryFrame): WorkoutSample |
| toWorkoutSamples | const | export |
| toWorkoutSamples | function | export function toWorkoutSamples(frames: TelemetryFrame[]): WorkoutSample[] |
| type BLEEnvironmentInfo | const | export |

## Dependencies

### Internal

*(none)*

### External

- `@voltras/node-sdk` — TelemetryFrame
- `@voltras/workout-analytics` — MovementPhase, WorkoutSample

## Invariants

*(none yet)*
