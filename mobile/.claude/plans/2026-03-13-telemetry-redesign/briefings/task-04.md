# Task 04: RestCard + CircularTimer

## Architectural Context

When the session transitions to `resting` state, the telemetry card should switch to show a rest view: a circular countdown timer (winding down to the rest target), a count-up timer showing actual elapsed rest, and a summary of the just-completed set.

The `CircularTimer` is an SVG-based circular progress indicator. The `RestCard` composes it with set summary info.

The exercise-session-store (extended in Task 02) provides `restElapsedMs` (count-up), `restCountdown` (seconds remaining), and `setLog` (for the just-completed set summary). The rest target in ms comes from `SetTargetsState.restBlocks * 15 * 1000`.

**Repo:** `voltras/mobile`. Run commands from `voltras/mobile/`.

## File Ownership

**May modify:**
- `src/components/exercise/RestCard.tsx` — new: rest state display
- `src/components/exercise/CircularTimer.tsx` — new: circular countdown indicator

**Must not touch:**
- `src/stores/exercise-session-store.ts` — modified in Task 02
- `src/components/exercise/TempoBar.tsx` — modified in Task 03

**Read for context (do not modify):**
- `src/stores/exercise-session-store.ts` — `restElapsedMs`, `restCountdown`, `setLog`, `uiState`
- `src/domain/workout/models/completed-set.ts` — `CompletedSet` interface
- `src/domain/workout/models/session.ts` — `SetLogEntry`, `ClusterBoundary` (from Task 02)

## Steps

### Step 1: Create CircularTimer component

Create `src/components/exercise/CircularTimer.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

interface CircularTimerProps {
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Target time in ms (null = no target, don't show circle) */
  targetMs: number | null;
  /** Size in px */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
}

export function CircularTimer({
  elapsedMs,
  targetMs,
  size = 80,
  strokeWidth = 6,
}: CircularTimerProps) {
  if (!targetMs) {
    // No target — just show count-up time, no circle
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: t['text-primary'] }}>
          {formatTime(elapsedMs)}
        </Text>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsedMs / targetMs);
  const overshot = elapsedMs > targetMs;
  const strokeDashoffset = circumference * (1 - progress);

  const circleColor = overshot ? t['status-error'] : t['brand-primary'];
  const trackColor = overshot ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.08)';

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={trackColor} strokeWidth={strokeWidth} fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={circleColor} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{
        fontSize: 20, fontWeight: '700',
        color: overshot ? t['status-error'] : t['text-primary'],
      }}>
        {formatTime(elapsedMs)}
      </Text>
    </View>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}
```

Note: `react-native-svg` is already in the project dependencies — verify with `npm ls react-native-svg`. If not present, add it.

### Step 2: Create RestCard component

Create `src/components/exercise/RestCard.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { CircularTimer } from './CircularTimer';
import type { SetLogEntry } from '@/domain/workout';
import { getSetMeanVelocity } from '@voltras/workout-analytics';

const t = getSemanticColors('dark');

interface RestCardProps {
  /** Elapsed rest time in ms */
  restElapsedMs: number;
  /** Rest target in ms (null = no target) */
  restTargetMs: number | null;
  /** The just-completed set (last entry in setLog) */
  lastSetEntry: SetLogEntry | null;
  /** Current set number (1-based) */
  setNumber: number;
}

export function RestCard({ restElapsedMs, restTargetMs, lastSetEntry, setNumber }: RestCardProps) {
  const completedSet = lastSetEntry?.set;
  const repCount = completedSet?.data.reps.length ?? 0;
  const weight = completedSet?.weight ?? 0;
  const avgVelocity = completedSet ? getSetMeanVelocity(completedSet.data) : 0;

  return (
    <View>
      {/* Circular timer centered */}
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <CircularTimer elapsedMs={restElapsedMs} targetMs={restTargetMs} />
      </View>

      {/* Set summary */}
      {completedSet && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            backgroundColor: alpha('#fff', 0.04),
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 13, color: t['text-secondary'] }}>
            Set {setNumber} complete
          </Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {repCount} reps
          </Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {weight} lbs
          </Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {avgVelocity.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}
```

### Step 3: Write tests

Create `src/components/exercise/__tests__/RestCard.test.ts`:

Test (pure logic):
1. `formatTime` formats ms to m:ss correctly (0, 47000, 90000, 125000)
2. CircularTimer progress calculation: 0% at 0ms, 50% at half target, 100% at target, capped at 100% past target
3. Overshot detection: `elapsedMs > targetMs` triggers red state
4. No target: circle not rendered, just count-up time

### Step 4: Verify and commit

```bash
cd voltras/mobile
npm test -- src/components/exercise/__tests__/RestCard.test.ts
npm run lint
npm run typecheck
```

```bash
git add src/components/exercise/RestCard.tsx src/components/exercise/CircularTimer.tsx src/components/exercise/__tests__/RestCard.test.ts
git commit -m "feat: add RestCard with circular countdown timer"
```

## Success Criteria

- [ ] Tests pass: `npm test -- src/components/exercise/__tests__/RestCard.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] CircularTimer shows progress winding down to target
- [ ] Timer goes red when rest exceeds target
- [ ] No target = just count-up, no circle

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT add haptic/audio alerts (flagged as future in design doc)
- Do NOT use Reanimated for the circular animation — SVG dashoffset is sufficient for 1Hz updates
