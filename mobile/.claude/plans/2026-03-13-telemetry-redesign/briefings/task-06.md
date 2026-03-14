# Task 06: Screen Integration

## Architectural Context

`SimpleExerciseScreen` at `voltras/mobile/src/components/screens/SimpleExerciseScreen.tsx` currently manages its own local state machine (`ExerciseState = 'idle' | 'preparing' | 'recording' | 'summary'`) and directly drives the recording-store. It needs to be refactored to use the `exercise-session-store` (extended in Task 02) for session orchestration, and wire up the new components: `TempoBar` (target pacing, Task 03), `RestCard` (Task 04), and `SetLog` (Task 05).

**Key changes:**
1. Replace local `ExerciseState` with `exercise-session-store`'s `uiState`
2. Convert `SetTargetsState` into an `ExercisePlan` and start a proper session
3. Show `RestCard` when `uiState === 'resting'` instead of current "Set Complete" card
4. Show `SetLog` below telemetry card
5. Pass `targetTempo` to `TempoBar`
6. Show target-aware rep count (`3/8 reps` with target, `3 reps` without)
7. Auto-idle detection flows from session store → recording store subscription

**Repo:** `voltras/mobile`. Run commands from `voltras/mobile/`.

## File Ownership

**May modify:**
- `src/components/screens/SimpleExerciseScreen.tsx` — main refactor
- `src/components/exercise/index.ts` — add RestCard, CircularTimer, SetLog exports

**Must not touch:**
- `src/stores/exercise-session-store.ts` — used as-is (Task 02)
- `src/stores/recording-store.ts` — used as-is
- `src/components/exercise/TempoBar.tsx` — used as-is (Task 03)
- `src/components/exercise/RestCard.tsx` — used as-is (Task 04)
- `src/components/exercise/SetLog.tsx` — used as-is (Task 05)

**Read for context (do not modify):**
- `src/stores/exercise-session-store.ts` — `ExerciseSessionState`, `createExerciseSessionStore`, all actions
- `src/stores/recording-store.ts` — `RecordingState`, `createRecordingStore`
- `src/domain/workout/models/plan.ts` — `ExercisePlan`, `PlannedSet`, `TempoTarget`
- `src/domain/workout/models/session.ts` — `SetLogEntry`, `ClusterBoundary`
- `src/components/exercise/SetTargets.tsx` — `SetTargetsState`, `EMPTY_TARGETS`

## Steps

### Step 1: Add new component exports to barrel

In `src/components/exercise/index.ts`, add:

```typescript
export { RestCard } from './RestCard';
export { CircularTimer } from './CircularTimer';
export { SetLog } from './SetLog';
```

### Step 2: Create exercise-session-store instance

Replace the local `ExerciseState` with an exercise-session-store:

```typescript
import { createExerciseSessionStore } from '@/stores';
import type { ExercisePlan, PlannedSet, TempoTarget } from '@/domain/workout';

// In ExerciseInner:
const sessionStore = useMemo(() => createExerciseSessionStore(), []);
const uiState = useStore(sessionStore, (s) => s.uiState);
const setLog = useStore(sessionStore, (s) => s.setLog);
const restElapsedMs = useStore(sessionStore, (s) => s.restElapsedMs);
const restCountdown = useStore(sessionStore, (s) => s.restCountdown);
const currentSetIndex = useStore(sessionStore, (s) => s.currentSetIndex);
const currentPlannedSet = useStore(sessionStore, (s) => s.currentPlannedSet);

// Remove: const [exerciseState, setExerciseState] = useState<ExerciseState>('idle');
```

### Step 3: Convert SetTargetsState to ExercisePlan on start

When the user presses Start, build an `ExercisePlan` from the `SetTargetsState`:

```typescript
function buildPlanFromTargets(targets: SetTargetsState, weight: number): ExercisePlan {
  const numSets = targets.enabledSections.sets ? targets.targetSets : 1;
  const targetReps = targets.enabledSections.effort
    ? (targets.targetMode === 'reps' ? targets.targetReps : 0)
    : 0;
  const rirTarget = targets.enabledSections.effort
    ? (targets.targetMode === 'rir' ? targets.rirTarget : 0)
    : 0;
  const targetTempo: TempoTarget | undefined = targets.enabledSections.tempo
    ? targets.targetTempo
    : undefined;
  const restSeconds = targets.enabledSections.rest
    ? targets.restBlocks * 15
    : 90; // default

  const sets: PlannedSet[] = Array.from({ length: numSets }, (_, i) => ({
    setNumber: i + 1,
    weight,
    targetReps: targetReps || 8, // fallback
    rirTarget,
    isWarmup: false,
    targetTempo,
  }));

  return {
    exerciseId: 'simple-exercise',
    sets,
    defaultRestSeconds: restSeconds,
    generatedAt: Date.now(),
    generatedBy: 'manual',
  };
}
```

### Step 4: Wire session lifecycle to handleStart/handleStop

```typescript
const handleStart = useCallback(async () => {
  // Build plan and start session
  const plan = buildPlanFromTargets(setTargets, weight);
  const exercise = { id: 'simple-exercise', name: modeName };
  sessionStore.getState().startSession(exercise, plan);
  sessionStore.getState().bindRecordingStore(recordingStore);
  sessionStore.getState().bindVoltraStore(voltraStore);
  await sessionStore.getState().prepareFirstSet();
  sessionStore.getState().startFirstSet();
}, [sessionStore, recordingStore, voltraStore, setTargets, weight, modeName]);

const handleStop = useCallback(async () => {
  await sessionStore.getState().stopSession();
}, [sessionStore]);
```

### Step 5: Wire telemetry display to session state

- **Rep count**: Show `${repCount}/${targetReps} reps` when target exists, `${repCount} reps` without
- **TempoBar**: Pass `targetTempo={currentPlannedSet?.targetTempo}` prop
- **Telemetry card**: Show when `uiState === 'recording'`
- **RestCard**: Show when `uiState === 'resting'`
- **SetLog**: Show below telemetry card, always visible after first set

```typescript
{/* Telemetry card switches between active and rest states */}
<Surface elevation={1} className="mt-2 rounded-xl p-4">
  {uiState === 'resting' ? (
    <RestCard
      restElapsedMs={restElapsedMs}
      restTargetMs={restTargetMs}
      lastSetEntry={setLog.at(-1) ?? null}
      setNumber={currentSetIndex}
    />
  ) : (
    <>
      {/* Existing telemetry content with target-aware rep count */}
      {/* ... rep count row ... */}
      <TempoBar
        currentPhase={isRecording ? currentPhase : MovementPhase.IDLE}
        phaseElapsedMs={phaseElapsedMs}
        repPhaseDurations={repPhaseDurations}
        targetTempo={currentPlannedSet?.targetTempo}
      />
      {/* ... metrics row ... */}
    </>
  )}
</Surface>

{/* Set Log */}
{(setLog.length > 0 || uiState === 'recording') && (
  <Surface elevation={1} className="mt-2 rounded-xl p-3">
    <SetLog
      setLog={setLog}
      activeSet={uiState === 'recording' ? {
        setIndex: currentSetIndex,
        repCount,
        weight: currentPlannedSet?.weight ?? weight,
        targetReps: currentPlannedSet?.targetReps ?? null,
      } : null}
      plannedSets={session?.plan.sets.slice(currentSetIndex + 1) ?? []}
      totalSets={session?.plan.sets.length ?? null}
    />
  </Surface>
)}
```

### Step 6: Remove "summary" state and "Go Again" button

The session store handles transitions automatically. Remove:
- `'summary'` from `ExerciseState`
- "Set Complete" card and "Go Again" button
- `handleGoAgain` callback
- Local `exerciseState`, `duration`, `startTimeRef` state

The session store's `onSetCompleted` automatically transitions to `resting`, and idle detection or rest timer completion transitions back to `recording`.

### Step 7: Update WorkoutControls binding

```typescript
{/* Show start/stop based on uiState */}
{uiState !== 'results' && (
  <WorkoutControls
    isActive={uiState === 'recording' || uiState === 'countdown'}
    onStart={handleStart}
    onStop={handleStop}
  />
)}
```

### Step 8: Update tests

Update `src/components/screens/__tests__/SimpleExerciseScreen.test.ts`:
- Add `exercise-session-store` to mocks
- Update exercise state transition tests for new flow
- Add mock for `RestCard`, `CircularTimer`, `SetLog` in exercise component mock

### Step 9: Verify and commit

```bash
cd voltras/mobile
npm test -- src/components/screens/__tests__/SimpleExerciseScreen.test.ts
npm run lint
npm run typecheck
```

```bash
git add src/components/screens/SimpleExerciseScreen.tsx src/components/exercise/index.ts src/components/screens/__tests__/SimpleExerciseScreen.test.ts
git commit -m "feat: integrate session store, rest card, set log into exercise screen"
```

## Success Criteria

- [ ] Tests pass: `npm test -- src/components/screens/__tests__/SimpleExerciseScreen.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] Rep count shows target when configured (e.g., "3/8 reps")
- [ ] TempoBar receives target tempo from planned set
- [ ] RestCard shows during rest state with circular timer
- [ ] SetLog shows completed sets, active set, and planned sets
- [ ] Session auto-transitions between sets without manual intervention

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT keep the old local ExerciseState machine — fully replace with session store
- Do NOT add workout persistence or exercise selection (future scope)
