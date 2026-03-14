# Task 01: MockBLE Session Config

## Architectural Context

The `MockBLEAdapter` at `voltra-node-sdk/src/bluetooth/adapters/mock.ts` simulates a Voltra device for development. It currently cycles through phase profiles at 11Hz, emitting rep/set boundaries, with configurable `repsPerSet` and `restBetweenSetsMs`. We need to add a `MockSessionConfig` that enables multi-set simulation with configurable pause sets, per-set tempo overrides, and inter-set fatigue recovery — supporting the telemetry redesign's auto-idle detection and rest timer features.

**Repo:** `voltra-node-sdk` (NOT voltras/mobile). Run all commands from `voltra-node-sdk/`.

## File Ownership

**May modify:**
- `src/bluetooth/adapters/mock/types.ts` — add `MockSessionConfig` interface
- `src/bluetooth/adapters/mock.ts` — add session-level simulation logic
- `src/bluetooth/adapters/mock/session-config.ts` — new: preset scenario factories

**Must not touch:**
- `src/bluetooth/adapters/mock/profiles.ts` — existing kinematics profiles
- `src/bluetooth/adapters/mock/kinematics.ts` — value builders
- `src/bluetooth/adapters/base.ts` — base adapter

**Read for context (do not modify):**
- `src/bluetooth/adapters/mock/types.ts` — existing `MockBLEConfig`, `PhaseDef`, `KinematicsProfile`
- `src/bluetooth/adapters/mock.ts` — `_startTelemetry()` loop, rep/set boundary detection
- `src/bluetooth/adapters/mock/profiles.ts` — `STANDARD_PHASES` phase counts (IDLE:6, CON:17, HOLD:6, ECC:28)

## Steps

### Step 1: Add MockSessionConfig type

In `src/bluetooth/adapters/mock/types.ts`, add:

```typescript
export interface MockSessionConfig {
  /** Number of sets to simulate */
  sets: number;
  /** Reps per set (overrides MockBLEConfig.repsPerSet) */
  repsPerSet: number;
  /** Rest between sets in ms (overrides MockBLEConfig.restBetweenSetsMs) */
  restBetweenSetsMs: number;

  /** Pause set config — one set gets intra-set pauses */
  pauseSet?: {
    /** Which set index (0-based) has pauses */
    setIndex: number;
    /** Pause after these rep counts, e.g. [5, 3] = pause after rep 5, then 3 more */
    pauseAfterReps: number[];
    /** Duration of each intra-set pause in ms */
    pauseDurationMs: number;
  };

  /** Per-phase sample count overrides (overrides profile defaults) */
  tempo?: {
    concentricCount?: number;  // samples at 11Hz, e.g. 22 ≈ 2s
    holdCount?: number;
    eccentricCount?: number;
    idleCount?: number;
  };

  /** How much fatigue recovers between sets (0.0-1.0) */
  interSetRecovery: number;
}
```

Add `sessionConfig?: MockSessionConfig` to the existing `MockBLEConfig` interface.

### Step 2: Create session-config.ts with preset factories

Create `src/bluetooth/adapters/mock/session-config.ts`:

```typescript
import type { MockSessionConfig } from './types';

/** 3 sets × 8 reps, 90s rest, 60% fatigue recovery */
export function createMultiSetScenario(): MockSessionConfig {
  return {
    sets: 3,
    repsPerSet: 8,
    restBetweenSetsMs: 5000, // 5s for dev (90s in real use)
    interSetRecovery: 0.6,
  };
}

/** Set 1 has pauses after reps 5 and 3 more (10s each) */
export function createPauseSetScenario(): MockSessionConfig {
  return {
    sets: 3,
    repsPerSet: 10,
    restBetweenSetsMs: 5000,
    interSetRecovery: 0.6,
    pauseSet: {
      setIndex: 1,
      pauseAfterReps: [5, 3],
      pauseDurationMs: 10000,
    },
  };
}

/** 3s concentric target for tempo pacing testing */
export function createTempoScenario(): MockSessionConfig {
  return {
    sets: 3,
    repsPerSet: 6,
    restBetweenSetsMs: 5000,
    interSetRecovery: 0.7,
    tempo: {
      concentricCount: 33,  // ~3s at 11Hz
      holdCount: 6,         // ~0.5s
      eccentricCount: 44,   // ~4s
      idleCount: 6,
    },
  };
}

/** Short rest resume — rest triggers but lifting resumes at ~12s */
export function createShortRestScenario(): MockSessionConfig {
  return {
    sets: 2,
    repsPerSet: 5,
    restBetweenSetsMs: 12000, // Short rest, should be treated as intra-set pause
    interSetRecovery: 0.8,
  };
}
```

### Step 3: Implement session simulation in MockBLEAdapter

In `src/bluetooth/adapters/mock.ts`, add session-tracking fields and modify `_startTelemetry()`:

- Add fields: `private sessionConfig: MockSessionConfig | null`, `private currentSet: number`, `private pauseClusterIndex: number`, `private pauseStart: number | null`, `private inPauseRest: boolean`
- In constructor: extract `sessionConfig` from config, set `currentSet = 0`
- In `_startTelemetry()`:
  - If `sessionConfig` exists, use `sessionConfig.repsPerSet` instead of `config.repsPerSet`
  - If `sessionConfig.tempo` exists, override the phase `count` values from the kinematics profile
  - On set boundary: increment `currentSet`, apply `interSetRecovery` to `fatigueReps` (`fatigueReps *= (1 - recovery)`), check if `currentSet >= sessionConfig.sets` to stop
  - For pause sets: when `currentSet === pauseSet.setIndex`, track cluster rep counts, emit idle frames for `pauseDurationMs` then resume same set

### Step 4: Write tests

Create `tests/bluetooth/adapters/mock-session.test.ts`:

Test the following scenarios:
1. Multi-set simulation emits correct number of rep/set boundaries
2. Pause set produces idle frames between clusters
3. Tempo override changes phase durations
4. Inter-set recovery reduces fatigue
5. Session stops after configured number of sets

### Step 5: Export and verify

Export `MockSessionConfig` and scenario factories from the package. Run:

```bash
cd voltra-node-sdk
npm test -- tests/bluetooth/adapters/mock-session.test.ts
npm run lint
npm run typecheck
```

### Step 6: Commit

```bash
git add src/bluetooth/adapters/mock/types.ts src/bluetooth/adapters/mock.ts src/bluetooth/adapters/mock/session-config.ts tests/bluetooth/adapters/mock-session.test.ts
git commit -m "feat: add MockSessionConfig for multi-set BLE simulation"
```

## Success Criteria

- [ ] Tests pass: `npm test -- tests/bluetooth/adapters/mock-session.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] Multi-set scenario produces expected rep/set boundary counts
- [ ] Pause set scenario produces idle frames between clusters within same set

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT change existing test files — only add new ones
- Do NOT modify kinematics profiles or phase builders
