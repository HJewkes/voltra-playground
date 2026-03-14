# Telemetry Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add multi-set session orchestration with auto-idle detection, tempo pacing, rest timer, set log, and pause-set support to the exercise screen.

**Architecture:** Extend the existing `exercise-session-store` with idle detection (watching recording-store's `currentPhase`), pause-set cluster tracking, and count-up rest timer. Refactor `SimpleExerciseScreen` to use it instead of local state. New UI components: `RestCard`, `CircularTimer`, `SetLog`. Refactored: `TempoBar` (target pacing). Extended: `MockBLEAdapter` (multi-set simulation).

**Tech Stack:** React Native/Expo, Zustand, Reanimated, @voltras/workout-analytics, @voltras/node-sdk

## Dependency Graph

```
Task 1 (MockBLE) ──────────────────────────┐
Task 2 (Session Store) ────┬───────────────┤
Task 3 (TempoBar) ─────────┤               │
                            ▼               ▼
                    Task 4 (RestCard)   Task 6 (Integration)
                    Task 5 (SetLog) ────────┘
```

## Wave Plan

- **Wave 1** (parallel): Task 1 (MockBLE), Task 2 (Session Store), Task 3 (TempoBar)
- **Wave 2** (depends on Task 2): Task 4 (RestCard + CircularTimer), Task 5 (SetLog)
- **Wave 3** (depends on all): Task 6 (SimpleExerciseScreen Integration)

## Tasks

| # | Name | Files | Wave | Depends On |
|---|------|-------|------|------------|
| 1 | MockBLE Session Config | `voltra-node-sdk/src/bluetooth/adapters/mock/types.ts`, `mock.ts`, `mock/session-config.ts`, tests | 1 | — |
| 2 | Session Store Extensions | `voltras/mobile/src/stores/exercise-session-store.ts`, `domain/workout/models/session.ts`, tests | 1 | — |
| 3 | TempoBar Target Pacing | `voltras/mobile/src/components/exercise/TempoBar.tsx`, tests | 1 | — |
| 4 | RestCard + CircularTimer | `voltras/mobile/src/components/exercise/RestCard.tsx`, `CircularTimer.tsx`, tests | 2 | Task 2 |
| 5 | SetLog Component | `voltras/mobile/src/components/exercise/SetLog.tsx`, tests | 2 | Task 2 |
| 6 | Screen Integration | `voltras/mobile/src/components/screens/SimpleExerciseScreen.tsx`, tests | 3 | Tasks 1-5 |

Detailed task specs: `./briefings/task-NN.md`
