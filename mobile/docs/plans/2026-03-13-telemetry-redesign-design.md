# Telemetry View Redesign

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Session state machine, telemetry UI, set log, rest timer, tempo pacing, mock BLE

## Problem

The current exercise screen treats each recording as a single flat session — press start, do reps, press stop. There's no concept of sets, no rest detection, no tracking against configured targets (reps, tempo, rest time), and no set history. The user has to manually stop and restart between sets.

The SetTargets config card now lets users configure sets, reps/RIR, tempo, and rest targets, but nothing in the telemetry view or recording system uses those targets.

## Goals

1. Auto-detect set boundaries and rest periods without requiring manual interaction
2. Show tempo pacing feedback against configured targets
3. Track rep progress against targets
4. Display a set log that fills in as the workout progresses
5. Support pause sets / myorep sets (intra-set rest periods)
6. Show a rest timer with circular countdown when rest targets are configured
7. Add mock BLE scenarios for testing all of the above

## Architecture: Session Store (Approach B)

A new `session-store` orchestrates the workout session. It wraps the `recording-store` — each set gets a fresh recording-store instance. The session-store listens to phase state to detect idle thresholds and trigger transitions.

```
session-store (sets, rest, transitions, set log)
  └─ recording-store (current set's reps, phases, velocity)
       └─ workout-analytics (signal processing)
```

**Why not extend recording-store?** The recording-store does one thing well — process ~11Hz samples into rep metrics. Session orchestration (set boundaries, rest detection, pause-set logic) is a higher-level concern that should live separately. Each set gets a clean recording-store, and the session-store owns the lifecycle.

## Section 1: Session State Machine

### States

```
IDLE → ACTIVE → RESTING → ACTIVE → RESTING → ... → STOPPED
                    ↑
               (intra-set pause if rest < pauseSetThreshold)
```

| State | Entry Condition | Exit Condition |
|-------|----------------|----------------|
| `idle` | Session not started | User presses Start |
| `active` | Start pressed, or lifting resumes from rest | Idle phase for > `idleThreshold` |
| `resting` | Idle threshold exceeded | Lifting resumes |
| `stopped` | User presses Stop | — |

### Auto-transition logic

- **Active → Resting**: When `currentPhase === IDLE` (or HOLD with no movement) persists longer than `idleThreshold` (default 7s).
- **Resting → Active (new set)**: Lifting resumes and elapsed rest >= `pauseSetThreshold` (default 20s). Finalize current set, create fresh recording-store.
- **Resting → Active (continue set)**: Lifting resumes and elapsed rest < `pauseSetThreshold`. Log a cluster boundary, continue same recording-store.

### Tunable constants

```typescript
const SESSION_DEFAULTS = {
  idleThreshold: 7000,        // ms idle before rest triggers
  pauseSetThreshold: 20000,   // ms rest before new set (vs intra-set pause)
  idleDebounce: 2000,         // ms to debounce brief pauses at lockout
};
```

## Section 2: Session Store Data Model

Aligns with existing types from `@voltras/workout-analytics` and `@/domain/workout`.

```typescript
interface SessionState {
  // Lifecycle
  status: 'idle' | 'active' | 'resting' | 'stopped';

  // Targets (copied from SetTargets config at session start)
  targets: {
    sets: number | null;       // null = unlimited/dynamic
    reps: number | null;       // null = no rep target
    rir: number | null;        // null = no RIR target
    tempo: TempoTarget | null; // from @/domain/workout
    restMs: number | null;     // null = no rest target (still tracks time)
  };

  // Current set tracking
  currentSetIndex: number;
  currentClusterStart: number; // rep index where current cluster began

  // Rest tracking
  restStartTime: number | null;
  restElapsedMs: number;

  // Idle detection
  idleSinceMs: number | null;  // timestamp when idle phase began

  // Set log — uses existing CompletedSet from domain
  setLog: SetLogEntry[];
}

interface SetLogEntry {
  set: CompletedSet;            // existing type — contains analytics Set, weight, timestamps
  clusters: ClusterBoundary[];  // lightweight pause markers
}

interface ClusterBoundary {
  repStart: number;             // first rep index in this cluster
  repEnd: number;               // last rep index (exclusive)
  pauseAfterMs: number | null;  // null for last cluster
}
```

### Key behaviors

- **Session start**: Copy targets from SetTargets config, create fresh recording-store, status → `active`.
- **Set finalization** (real rest): Snapshot metrics from recording-store into `CompletedSet`, push `SetLogEntry` to `setLog`, create fresh recording-store for next set.
- **Intra-set pause**: Snapshot current cluster metrics into `ClusterBoundary`, increment `currentClusterStart`, same recording-store continues.
- **Rest timer**: Ticks `restElapsedMs` via interval while `status === 'resting'`.

## Section 3: Telemetry View Layout

### During `active` state

```
┌──────────────────────────────────────────────┐
│  3/8 reps                        0.52 m/s    │  rep count (target-aware) + last rep velocity
│                                  peak        │
│                                              │
│  [==CON 1.2s==] [HOLD 0.3s] [===ECC====]    │  tempo bars (target-aware fill + pacing color)
│                              2.1 / 3.0s      │  elapsed / target for active phase
│                                              │
│  RPE 6.2    RIR ~4    VelLoss 12%            │  effort metrics row
│  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░               │  fatigue bar
│  Fresh ─────────────────────── Fatigued       │
└──────────────────────────────────────────────┘
```

- **Rep count**: `3/8 reps` with targets, `3 reps` without. No progress bar.
- **Tempo bars**: Phase color when on pace, red when behind threshold. No target = count up with phase color, no warnings.
- **Effort metrics**: Same as current (RPE, RIR, VelLoss with colors).

### During `resting` state

```
┌──────────────────────────────────────────────┐
│           ┌─────┐                            │
│           │ ◔   │  0:47                      │  circular timer winding down + count-up
│           └─────┘                            │  circle goes red past target
│                                              │
│  Set 2 complete · 8 reps · 135 lbs · 0.48   │  just-finished set summary
└──────────────────────────────────────────────┘
```

- Circular timer winds down toward rest target. Count-up timer always shows actual elapsed rest.
- Past target: circle goes red (overshot).
- No rest target: just count-up timer, no circle.

### Set Log (below telemetry card)

```
┌──────────────────────────────────────────────┐
│ Set 1   8 reps · 135 lbs   0.52 m/s  RPE 6.5│  completed
├──────────────────────────────────────────────┤
│ Set 2   5 reps · 135 lbs   0.45 m/s         │  pause set
│           [ 8s pause ]                       │
│         3 reps              0.41 m/s         │
│           [ 12s pause ]                      │
│         2 reps              0.38 m/s  RPE 8.1│
├──────────────────────────────────────────────┤
│ Set 3   ░░░ 3/8 reps · 135 lbs  (active)    │  in progress
├──────────────────────────────────────────────┤
│ Set 4   8 reps · 135 lbs                     │  planned (from targets)
│ Set 5   8 reps · 135 lbs                     │  planned (from targets)
└──────────────────────────────────────────────┘
```

- Completed sets: reps, weight, avg velocity, RPE.
- Pause sets: cluster breakdown with pause durations.
- In-progress: live rep count against target.
- Planned: target reps + current weight. Updates if weight changes between sets.
- No sets target: rows added dynamically as sets complete.

## Section 4: Tempo Pacing System

All thresholds are tunable constants at the top of the component.

```typescript
const TEMPO_PACING_DEFAULTS = {
  behindThresholdPct: 0.15,   // 15% over target duration → warning color
  aheadThresholdPct: 0.20,    // 20% under target (tracked, not warned)
  minPhaseDurationMs: 500,    // ignore pacing on very short phases
  colorTransitionMs: 300,     // smoothing for color transitions
  useROMPacing: false,        // future: position-based pacing
  romWeightVsTime: 0.5,       // future: blend factor time vs ROM
};
```

**Color states per phase bar:**
- **No target**: Phase color (green/blue/orange), counts up, no warnings.
- **On pace**: Phase color, bar fills toward 100% at target duration.
- **Behind** (elapsed > target × (1 + behindThresholdPct)): Transitions to red.
- **Complete** (phase ended): Dims, shows final duration.

## Section 5: Mock BLE Adapter Changes

New `MockSessionConfig` layered on top of existing per-mode phase profiles:

```typescript
interface MockSessionConfig {
  sets: number;
  repsPerSet: number;
  restBetweenSetsMs: number;

  // Pause set config (optional)
  pauseSet?: {
    setIndex: number;          // which set has intra-set pauses
    pauseAfterReps: number[];  // e.g., [5, 3] → pause after rep 5, then after rep 8
    pauseDurationMs: number;   // how long each intra-set pause lasts
  };

  // Tempo config (optional, overrides mode defaults)
  tempo?: {
    concentricMs: number;
    holdMs: number;
    eccentricMs: number;
  };

  // Recovery between sets (fatigue reset %)
  interSetRecovery: number;    // 0.0-1.0, how much fatigue recovers
}
```

### Scenarios to support

1. **Multi-set with rest**: 3 sets × 8 reps, 90s rest between sets. Tests auto-transition and rest timer.
2. **Pause set**: Set 2 has pauses after reps 5 and 8 (10s each). Tests intra-set detection and cluster logging.
3. **No targets**: Unlimited sets, no rep/rest targets. Tests dynamic set log.
4. **Tempo-matched**: Configured tempo targets with mock emitting samples that roughly match (with some drift). Tests pacing indicators.
5. **Short rest resume**: Rest triggers but lifting resumes at 12s. Tests pause-set threshold (should continue set, not start new one).

## Component Breakdown

| Component | Responsibility |
|-----------|---------------|
| `session-store` (new) | Set lifecycle, rest detection, auto-transitions, set log |
| `recording-store` (existing) | Per-set sample processing, rep/phase/velocity tracking |
| `TelemetryCard` (refactor) | Active-state metrics display with tempo pacing |
| `RestCard` (new) | Rest-state display with circular timer + count-up |
| `SetLog` (new) | Set history list with cluster support + planned sets |
| `CircularTimer` (new) | Circular countdown/overshoot indicator |
| `TempoBar` (refactor) | Add target-aware fill + pacing colors |
| `MockBLEAdapter` (extend) | Add `MockSessionConfig` for multi-set simulation |

## Not in Scope

- Workout persistence / history (future)
- Exercise selection / naming (future)
- Weight suggestions after set completion (future)
- ROM-based tempo pacing (flagged for future, constants in place)
- Haptic/audio alerts on rest timer completion (future)
