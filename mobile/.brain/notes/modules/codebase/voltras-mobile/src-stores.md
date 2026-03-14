---
title: "Architecture: src/stores"
type: architecture
tier: slow
module: codebase
module-path: src/stores
language: typescript
exports-hash: "243a12419f2e44a35dc130837df20974352037a0cd92103e166c48569eed856e"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.408Z
modified: 2026-03-14T15:53:10.408Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| ConnectionState | type | export type ConnectionState = 'disconnected' \| 'connecting' \| 'authenticating' \| 'connected' |
| createExerciseSessionStore | function | export function createExerciseSessionStore(): ExerciseSessionStoreApi |
| createExerciseSessionStore | const | export |
| createRecordingStore | const | export |
| createRecordingStore | function | export function createRecordingStore(): RecordingStoreApi |
| createVoltraStore | const | export |
| createVoltraStore | function | export function createVoltraStore( client: VoltraClient \| null, deviceId: string, deviceName?: string \| null ): VoltraStoreApi |
| ExerciseSessionState | interface | export interface ExerciseSessionState |
| ExerciseSessionStoreApi | type | export type ExerciseSessionStoreApi = StoreApi<ExerciseSessionState> |
| ExerciseSessionUIState | type | export type ExerciseSessionUIState = |
| export | type | export type |
| RecordingState | interface | export interface RecordingState |
| RecordingState | type | export type RecordingState = 'idle' \| 'preparing' \| 'ready' \| 'active' \| 'stopping' |
| RecordingStoreApi | type | export type RecordingStoreApi = StoreApi<RecordingState> |
| RecordingUIState | type | export type RecordingUIState = |
| selectBleEnvironment | const | export const selectBleEnvironment = (): BLEEnvironmentInfo => |
| selectIsConnected | const | export const selectIsConnected = (state: ConnectionStoreState) => |
| SESSION_DEFAULTS | const | export const SESSION_DEFAULTS = |
| useConnectionStore | const | export const useConnectionStore = create<ConnectionStoreState>()( devtools( (set, get) => ( |
| VoltraState | interface | export interface VoltraState |
| VoltraStoreApi | type | export type VoltraStoreApi = StoreApi<VoltraState> |

## Dependencies

### Internal

- `./recording-store` — RecordingStoreApi
- `./voltra-store` — VoltraStoreApi, createVoltraStore

### External

- `@/config` — SCAN_DURATION, SCAN_INTERVAL
- `@/data/exercise-session` — ExerciseSessionRepository, toStoredExerciseSession
- `@/data/provider` — getRecordingRepository, isDebugTelemetryEnabled
- `@/data/recordings` — SampleRecording
- `@/domain/device` — TrainingMode, toWorkoutSample
- `@/domain/exercise` — Exercise
- `@/domain/workout` — CompletedSet, WorkoutSample, createCompletedSet, getLiveEffortMessage
- `@voltras/workout-analytics` — getSetMeanVelocity
- `react-native` — AppState, AppStateStatus
- `zustand` — StoreApi, create, createStore
- `zustand/middleware` — devtools

## Invariants

*(none yet)*
