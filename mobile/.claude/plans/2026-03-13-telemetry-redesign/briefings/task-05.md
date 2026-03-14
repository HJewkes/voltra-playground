# Task 05: SetLog Component

## Architectural Context

The SetLog component displays set history below the telemetry card. It shows completed sets, the in-progress set, and planned future sets. Pause/myorep sets show cluster breakdowns with pause durations indented under the parent set row.

Data comes from the exercise-session-store (extended in Task 02): `setLog: SetLogEntry[]` for completed sets, `currentSetIndex` and recording-store's live `repCount` for the in-progress set, and the session's `plan.sets: PlannedSet[]` for planned future sets.

**Repo:** `voltras/mobile`. Run commands from `voltras/mobile/`.

## File Ownership

**May modify:**
- `src/components/exercise/SetLog.tsx` — new: set history list

**Must not touch:**
- `src/stores/exercise-session-store.ts` — data source (Task 02)
- `src/domain/workout/models/session.ts` — types (Task 02)

**Read for context (do not modify):**
- `src/domain/workout/models/session.ts` — `SetLogEntry`, `ClusterBoundary`
- `src/domain/workout/models/completed-set.ts` — `CompletedSet` (id, weight, data: AnalyticsSet, timestamp)
- `src/domain/workout/models/plan.ts` — `PlannedSet` (setNumber, weight, targetReps, rirTarget)
- `src/stores/exercise-session-store.ts` — `setLog`, `currentSetIndex`, `session.plan.sets`

## Steps

### Step 1: Create SetLog component

Create `src/components/exercise/SetLog.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { getSetMeanVelocity, estimateSetRIR } from '@voltras/workout-analytics';
import type { SetLogEntry, ClusterBoundary } from '@/domain/workout';
import type { PlannedSet } from '@/domain/workout';

const t = getSemanticColors('dark');

interface SetLogProps {
  /** Completed sets with cluster info */
  setLog: SetLogEntry[];
  /** Currently in-progress set info */
  activeSet: {
    setIndex: number;
    repCount: number;
    weight: number;
    targetReps: number | null;
  } | null;
  /** Planned future sets (from session plan) */
  plannedSets: PlannedSet[];
  /** Total planned sets (null if dynamic/unlimited) */
  totalSets: number | null;
}
```

### Step 2: Implement row rendering

Three row types:

**Completed set row:**
```
Set 1   8 reps · 135 lbs   0.52 m/s   RPE 6.5
```

**Pause set row (with clusters):**
```
Set 2   5 reps · 135 lbs   0.45 m/s
          [ 8s pause ]
        3 reps              0.41 m/s
          [ 12s pause ]
        2 reps              0.38 m/s   RPE 8.1
```

**In-progress row:**
```
Set 3   ░░░ 3/8 reps · 135 lbs  (active)
```

**Planned row:**
```
Set 4   8 reps · 135 lbs
```

Implementation:

```typescript
function CompletedSetRow({ entry, setNumber }: { entry: SetLogEntry; setNumber: number }) {
  const { set, clusters } = entry;
  const repCount = set.data.reps.length;
  const avgVel = getSetMeanVelocity(set.data);
  const { rpe } = estimateSetRIR(set.data);
  const hasClusters = clusters.length > 0;

  if (!hasClusters) {
    return (
      <View style={rowStyle}>
        <Text style={setLabelStyle}>Set {setNumber}</Text>
        <Text style={detailStyle}>{repCount} reps · {set.weight} lbs</Text>
        <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>
        {rpe > 0 && <Text style={rpeStyle}>RPE {rpe.toFixed(1)}</Text>}
      </View>
    );
  }

  // Pause set: show clusters
  return (
    <View>
      <View style={rowStyle}>
        <Text style={setLabelStyle}>Set {setNumber}</Text>
      </View>
      {clusters.map((cluster, i) => (
        <React.Fragment key={i}>
          <ClusterRow
            cluster={cluster}
            reps={set.data.reps}
            weight={set.weight}
            isLast={i === clusters.length - 1}
            rpe={i === clusters.length - 1 ? rpe : null}
          />
          {cluster.pauseAfterMs !== null && (
            <PauseRow pauseMs={cluster.pauseAfterMs} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}
```

### Step 3: Implement cluster and pause rows

```typescript
function ClusterRow({ cluster, reps, weight, isLast, rpe }: {
  cluster: ClusterBoundary;
  reps: readonly Rep[];
  weight: number;
  isLast: boolean;
  rpe: number | null;
}) {
  const clusterReps = reps.slice(cluster.repStart, cluster.repEnd);
  const clusterRepCount = clusterReps.length;
  // Compute avg velocity for this cluster's reps
  const avgVel = clusterReps.length > 0
    ? clusterReps.reduce((sum, r) => sum + getRepPeakVelocity(r), 0) / clusterReps.length
    : 0;

  return (
    <View style={[rowStyle, { paddingLeft: 24 }]}>
      <Text style={detailStyle}>{clusterRepCount} reps</Text>
      <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>
      {isLast && rpe !== null && rpe > 0 && <Text style={rpeStyle}>RPE {rpe.toFixed(1)}</Text>}
    </View>
  );
}

function PauseRow({ pauseMs }: { pauseMs: number }) {
  const sec = Math.round(pauseMs / 1000);
  return (
    <View style={{ paddingLeft: 40, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color: t['text-disabled'], fontStyle: 'italic' }}>
        [ {sec}s pause ]
      </Text>
    </View>
  );
}
```

### Step 4: Implement active and planned rows

```typescript
function ActiveSetRow({ setIndex, repCount, weight, targetReps }: {
  setIndex: number; repCount: number; weight: number; targetReps: number | null;
}) {
  const repText = targetReps ? `${repCount}/${targetReps} reps` : `${repCount} reps`;
  return (
    <View style={[rowStyle, { backgroundColor: alpha(t['brand-primary'], 0.06) }]}>
      <Text style={setLabelStyle}>Set {setIndex + 1}</Text>
      <Text style={[detailStyle, { color: t['brand-primary'] }]}>
        {repText} · {weight} lbs
      </Text>
      <Text style={{ fontSize: 11, color: t['brand-primary'], fontStyle: 'italic' }}>(active)</Text>
    </View>
  );
}

function PlannedSetRow({ planned }: { planned: PlannedSet }) {
  return (
    <View style={[rowStyle, { opacity: 0.4 }]}>
      <Text style={setLabelStyle}>Set {planned.setNumber}</Text>
      <Text style={detailStyle}>{planned.targetReps} reps · {planned.weight} lbs</Text>
    </View>
  );
}
```

### Step 5: Compose SetLog

```typescript
export function SetLog({ setLog, activeSet, plannedSets, totalSets }: SetLogProps) {
  return (
    <View>
      {/* Completed sets */}
      {setLog.map((entry, i) => (
        <CompletedSetRow key={entry.set.id} entry={entry} setNumber={i + 1} />
      ))}

      {/* Active set */}
      {activeSet && <ActiveSetRow {...activeSet} />}

      {/* Planned future sets */}
      {plannedSets.map((planned) => (
        <PlannedSetRow key={planned.setNumber} planned={planned} />
      ))}
    </View>
  );
}
```

### Step 6: Write tests

Create `src/components/exercise/__tests__/SetLog.test.ts`:

Test:
1. Completed set row shows reps, weight, velocity, RPE
2. Pause set row shows cluster breakdown with pause durations
3. Active set row shows live rep count with target
4. Planned set row shows target reps and weight
5. No sets target: no planned rows rendered
6. Dynamic sets: rows accumulate as setLog grows

### Step 7: Verify and commit

```bash
cd voltras/mobile
npm test -- src/components/exercise/__tests__/SetLog.test.ts
npm run lint
npm run typecheck
```

```bash
git add src/components/exercise/SetLog.tsx src/components/exercise/__tests__/SetLog.test.ts
git commit -m "feat: add SetLog component with pause-set cluster support"
```

## Success Criteria

- [ ] Tests pass: `npm test -- src/components/exercise/__tests__/SetLog.test.ts`
- [ ] No new lint warnings: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] Completed sets show reps, weight, avg velocity, RPE
- [ ] Pause sets show indented cluster rows with pause durations
- [ ] Active set shows live rep count against target
- [ ] Planned sets show target reps and weight

## Anti-patterns

- Do NOT modify files outside the ownership list above
- Do NOT modify CLAUDE.md or any persistent configuration files
- Do NOT add features beyond what is specified in the steps
- Do NOT add swipe-to-delete or editing functionality (future scope)
- Do NOT import from recording-store directly — receive data via props
