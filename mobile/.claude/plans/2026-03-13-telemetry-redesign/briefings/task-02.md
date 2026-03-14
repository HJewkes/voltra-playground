# Task 02: Session Store Extensions

## Architectural Context

The `exercise-session-store` at `voltras/mobile/src/stores/exercise-session-store.ts` already manages multi-set session lifecycle with UI state machine (idle → preparing → ready → countdown → recording → processing → resting → results), rest timers, recording-store binding, and device control. We need to extend it with:

1. **Auto-idle detection** — watch the recording-store's `currentPhase` and trigger rest when IDLE/HOLD persists > `idleThreshold` (7s default)
2. **Pause-set / cluster tracking** — if rest is < `pauseSetThreshold` (20s) when lifting resumes, continue same set; otherwise finalize set. Track `ClusterBoundary` within sets.
3. **Count-up rest timer** — always count elapsed rest time (not just countdown). The `restElapsedMs` field runs as long as status is `resting`.
4. **SetLogEntry with clusters** — wrap `CompletedSet` with cluster boundaries for pause-set visualization.

**Repo:** `voltras/mobile`. Run commands from `voltras/mobile/`.

The existing `ExerciseSession` model at `src/domain/workout/models/session.ts` stores `completedSets: CompletedSet[]`. We'll add `SetLogEntry` and `ClusterBoundary` types alongside it, and add `setLog: SetLogEntry[]` and idle detection state to the session store.

## File Ownership

**May modify:**
- `src/stores/exercise-session-store.ts` — add idle detection, cluster tracking, count-up timer, setLog
- `src/domain/workout/models/session.ts` — add `SetLogEntry`, `ClusterBoundary` types

**May need to modify (barrel re-exports):**
- `src/domain/workout/models/index.ts` — re-export new types
- `src/domain/workout/index.ts` — re-export new types

**Must not touch:**
- `src/stores/recording-store.ts` — read-only dependency
- `src/domain/workout/models/completed-set.ts` — existing type, don't change
- `src/domain/workout/models/plan.ts` — existing type, don't change

**Read for context (do not modify):**
- `src/stores/recording-store.ts` — `RecordingState.currentPhase`, `processSample`, `stopRecording`
- `src/stores/exercise-session-store.ts` — existing state machine, `onSetCompleted`, timer management
- `src/domain/workout/models/completed-set.ts` — `CompletedSet` interface (has `data: AnalyticsSet`, `weight`, `timestamp`)
- `src/domain/workout/models/session.ts` — `ExerciseSession`, `addCompletedSet`, `startRest`

## Steps

### Step 1: Add SetLogEntry and ClusterBoundary types

In `src/domain/workout/models/session.ts`, add after existing types:

```typescript
/**
 * A cluster boundary within a pause/myorep set.
 * Marks where intra-set pauses occurred.
 */
export interface ClusterBoundary {
  /** First rep index in this cluster (0-based) */
  repStart: number;
  /** Last rep index (exclusive) */
  repEnd: number;
  /** Pause duration after this cluster in ms (null for last cluster) */
  pauseAfterMs: number | null;
}

/**
 * A set log entry wrapping CompletedSet with cluster info.
 * For standard sets, clusters is empty.
 * For pause/myorep sets, clusters track intra-set pause boundaries.
 */
export interface SetLogEntry {
  set: CompletedSet;
  clusters: ClusterBoundary[];
}
```

Re-export these types from the barrel files (`models/index.ts` and `domain/workout/index.ts`).

### Step 2: Add idle detection and session orchestration to exercise-session-store

Add these constants and state fields to `exercise-session-store.ts`:

```typescript
const SESSION_DEFAULTS = {
  idleThreshold: 7000,        // ms idle before rest triggers
  pauseSetThreshold: 20000,   // ms rest before new set (vs intra-set pause)
  idleDebounce: 2000,         // ms to debounce brief pauses at lockout
};
```

Add to `ExerciseSessionState`:

```typescript
// Idle detection
idleSinceMs: number | null;       // timestamp when IDLE/HOLD phase began

// Count-up rest
restElapsedMs: number;            // always counts up during resting state
restStartTime: number | null;     // when rest started

// Cluster tracking (for pause sets)
currentClusterStart: number;       // rep index where current cluster began
pendingClusters: ClusterBoundary[]; // clusters accumulated during current set

// Set log
setLog: SetLogEntry[];
```

### Step 3: Implement idle detection

Add an `_onPhaseChange` method that the recording-store subscription calls:

- When `currentPhase` transitions to `IDLE` or `HOLD`: record `idleSinceMs = Date.now()`
- When `currentPhase` transitions to `CONCENTRIC` or `ECCENTRIC`: check if idle duration exceeded `idleThreshold`. If so, auto-trigger `_autoTransitionToRest()`. Clear `idleSinceMs`.
- Debounce: ignore idle periods shorter than `idleDebounce` (brief pauses at lockout)

The idle detection subscribes to the bound recording-store when status is `recording`:

```typescript
// In transitionToRecording or equivalent:
const unsubIdle = recordingStore.subscribe((state, prev) => {
  if (state.currentPhase !== prev.currentPhase) {
    get()._onPhaseChange(state.currentPhase, state.repCount);
  }
});
```

### Step 4: Implement auto-transition to rest

`_autoTransitionToRest()`:
- Call `recordingStore.getState().stopRecording(weight)` to get the CompletedSet
- Call `onSetCompleted(completedSet)` which handles rest timer, set log, etc.
- The existing `onSetCompleted` flow handles termination checks and rest period setup

### Step 5: Implement rest resume logic (pause-set vs new set)

When lifting resumes from rest (detected via phase change subscription while resting):

```typescript
_onLiftingResumedFromRest():
  const elapsed = Date.now() - restStartTime;
  if (elapsed < SESSION_DEFAULTS.pauseSetThreshold) {
    // Intra-set pause — continue same recording, add cluster boundary
    pendingClusters.push({
      repStart: currentClusterStart,
      repEnd: recordingStore.getState().repCount,
      pauseAfterMs: elapsed,
    });
    currentClusterStart = recordingStore.getState().repCount;
    // Clear rest, go back to recording
    set({ uiState: 'recording', restElapsedMs: 0, restStartTime: null });
  } else {
    // Real rest — finalize set, start new one
    // onSetCompleted already handles this
    set({ uiState: 'countdown', startCountdown: COUNTDOWN_SECONDS });
    startCountdownTimer(get, set);
  }
```

### Step 6: Add count-up rest timer

Modify rest timer to count UP in addition to the existing countdown:

```typescript
// In startRestTimer, add a separate interval or modify existing:
// restElapsedMs increments by 1000 every second alongside restCountdown decrement
tickRestTimer: () => {
  const { restCountdown, restElapsedMs } = get();
  set({ restElapsedMs: restElapsedMs + 1000 });
  // ... existing countdown logic
}
```

### Step 7: Build SetLogEntry on set completion

In `onSetCompleted`, after creating `CompletedSet`:

```typescript
const entry: SetLogEntry = {
  set: completedSet,
  clusters: [...get().pendingClusters],
};
set({
  setLog: [...get().setLog, entry],
  pendingClusters: [],
  currentClusterStart: 0,
});
```

### Step 8: Write tests

Create `src/stores/__tests__/exercise-session-idle.test.ts`:

Test:
1. Idle detection triggers rest after `idleThreshold` ms of IDLE phase
2. Brief idle (< `idleDebounce`) does not trigger rest
3. Short rest resume (< `pauseSetThreshold`) continues same set with cluster boundary
4. Long rest (>= `pauseSetThreshold`) finalizes set and starts new one
5. `restElapsedMs` counts up during rest
6. `setLog` accumulates entries with correct cluster boundaries
7. Cluster boundaries track correct rep ranges

### Step 9: Verify and commit

```bash
cd voltras/mobile
npm test -- src/stores/__tests__/exercise-session-idle.test.ts
npm run lint
npm run typecheck
```

```bash
git add src/stores/exercise-session-store.ts src/domain/workout/models/session.ts src/domain/workout/models/index.ts src/domain/workout/index.ts src/stores/__tests__/exercise-session-idle.test.ts
git commit -m "feat: add auto-idle detection, pause-set clusters, and count-up rest to session store"
```

## Success Criteria

- [ ] Tests pass: `npm test -- src/stores/__tests__/exercise-session-idle.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] Idle detection auto-triggers rest after threshold
- [ ] Pause-set clusters tracked correctly when rest < pauseSetThreshold
- [ ] restElapsedMs counts up continuously during rest

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT modify recording-store.ts — only subscribe to it
- Do NOT change the existing ExerciseSessionUIState values — add fields alongside them
- Do NOT remove any existing functionality from the session store
