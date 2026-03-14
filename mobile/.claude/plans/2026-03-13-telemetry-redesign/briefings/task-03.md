# Task 03: TempoBar Target Pacing

## Architectural Context

The `TempoBar` at `voltras/mobile/src/components/exercise/TempoBar.tsx` shows a 3-segment bar (CON → HOLD → ECC) with live phase elapsed time. Currently it has no concept of tempo targets — it just shows current timing with phase colors.

We need to add target-aware pacing:
- When targets are set, bars fill proportionally toward the target duration
- Color transitions to red when behind pace (> `behindThresholdPct` of target)
- No targets = current behavior (phase color, count up, no warnings)
- All thresholds are tunable constants at the top of the file

The `TempoTarget` type from `@/domain/workout` has `concentric`, `eccentric`, `pauseTop`, `pauseBottom` (seconds).

**Repo:** `voltras/mobile`. Run commands from `voltras/mobile/`.

## File Ownership

**May modify:**
- `src/components/exercise/TempoBar.tsx` — add target pacing logic and fill animation

**Must not touch:**
- `src/components/exercise/SetTargets.tsx` — target configuration (separate concern)
- `src/stores/recording-store.ts` — phase data source

**Read for context (do not modify):**
- `src/components/exercise/TempoBar.tsx` — existing implementation
- `src/domain/workout/models/plan.ts` — `TempoTarget` interface (concentric/eccentric/pauseTop/pauseBottom in seconds)
- `src/stores/recording-store.ts` — `currentPhase`, `phaseElapsedMs`, `repPhaseDurations`

## Steps

### Step 1: Add tunable constants and target prop

Add at the top of `TempoBar.tsx`:

```typescript
const TEMPO_PACING = {
  behindThresholdPct: 0.15,   // 15% over target → warning color
  aheadThresholdPct: 0.20,    // 20% under target (tracked, not warned)
  minPhaseDurationMs: 500,    // ignore pacing on very short targets
  colorTransitionMs: 300,     // smoothing for color transitions
};
```

Add `targetTempo?: TempoTarget` to `TempoBarProps`. Map TempoTarget fields to phases:

```typescript
const TARGET_MAP: Record<number, keyof TempoTarget> = {
  [MovementPhase.CONCENTRIC]: 'concentric',
  [MovementPhase.HOLD]: 'pauseTop',
  [MovementPhase.ECCENTRIC]: 'eccentric',
};
```

### Step 2: Implement target-aware fill

For each phase segment, when a target exists:

- **Active phase with target**: Bar fills as a percentage of target duration. Show elapsed/target as `"1.2 / 3.0s"`. Fill color = phase color when on pace, transitions to red (`t['status-error']`) when `elapsed > targetMs * (1 + behindThresholdPct)`.
- **Active phase without target**: Current behavior — phase color, count up.
- **Completed phase**: Dimmed, show final duration. If target existed, show checkmark or X indicator.
- **Ignore pacing for targets < `minPhaseDurationMs`** (e.g., 0.5s hold targets don't need pacing indicators).

```typescript
function getPacingState(elapsedMs: number, targetMs: number | null): 'none' | 'on-pace' | 'behind' {
  if (!targetMs || targetMs < TEMPO_PACING.minPhaseDurationMs) return 'none';
  const ratio = elapsedMs / targetMs;
  if (ratio > 1 + TEMPO_PACING.behindThresholdPct) return 'behind';
  return 'on-pace';
}
```

### Step 3: Update rendering

Modify the segment rendering:

```typescript
// For active phase with target:
const targetMs = targetTempo ? targetTempo[TARGET_MAP[phase]] * 1000 : null;
const pacing = isActive ? getPacingState(phaseElapsedMs, targetMs) : 'none';
const barColor = pacing === 'behind' ? t['status-error'] : config.color;
const fillPct = targetMs ? Math.min(100, (phaseElapsedMs / targetMs) * 100) : 100;

// Render fill bar inside segment:
<View style={{
  position: 'absolute', left: 0, top: 0, bottom: 0,
  width: targetMs ? `${fillPct}%` : '100%',
  backgroundColor: alpha(barColor, 0.3),
  borderRadius: 4,
}} />

// Label: show elapsed / target when target exists
const label = targetMs
  ? `${formatDuration(phaseElapsedMs)} / ${formatDuration(targetMs)}`
  : formatDuration(phaseElapsedMs);
```

### Step 4: Write tests

Create `src/components/exercise/__tests__/TempoBar.test.ts`:

Test (pure logic, no rendering):
1. `getPacingState` returns 'none' when no target
2. `getPacingState` returns 'on-pace' when within threshold
3. `getPacingState` returns 'behind' when over threshold
4. `getPacingState` returns 'none' when target < minPhaseDurationMs
5. Fill percentage calculation is correct (elapsed/target * 100, capped at 100)

### Step 5: Verify and commit

```bash
cd voltras/mobile
npm test -- src/components/exercise/__tests__/TempoBar.test.ts
npm run lint
npm run typecheck
```

```bash
git add src/components/exercise/TempoBar.tsx src/components/exercise/__tests__/TempoBar.test.ts
git commit -m "feat: add target-aware tempo pacing with tunable thresholds"
```

## Success Criteria

- [ ] Tests pass: `npm test -- src/components/exercise/__tests__/TempoBar.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] With no target: behavior identical to current (phase color, count up)
- [ ] With target: fill bar shows progress, red when behind pace
- [ ] All thresholds are tunable constants

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT add Reanimated animations — keep color transitions simple (opacity-based)
- Do NOT add ROM-based pacing (flagged for future in design doc)
