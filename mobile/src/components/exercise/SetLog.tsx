import React from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import {
  getSetMeanVelocity,
  estimateSetRIR,
  getRepPeakVelocity,
  type Rep,
} from '@voltras/workout-analytics';
import type { SetLogEntry, ClusterBoundary, PlannedSet } from '@/domain/workout';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface SetLogProps {
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

// =============================================================================
// Styles
// =============================================================================

const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 6,
  paddingHorizontal: 12,
  gap: 8,
};

const setLabelStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '600',
  color: t['text-primary'],
  width: 44,
};

const detailStyle: TextStyle = {
  fontSize: 13,
  color: t['text-secondary'],
  flex: 1,
};

const metricStyle: TextStyle = {
  fontSize: 13,
  color: t['text-primary'],
  fontVariant: ['tabular-nums'],
};

const rpeStyle: TextStyle = {
  fontSize: 12,
  color: t['text-secondary'],
  minWidth: 48,
  textAlign: 'right',
};

// =============================================================================
// Sub-components
// =============================================================================

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

export function computeClusterMeanVelocity(reps: readonly Rep[], cluster: ClusterBoundary): number {
  const clusterReps = reps.slice(cluster.repStart, cluster.repEnd);
  if (clusterReps.length === 0) return 0;
  const sum = clusterReps.reduce((acc, r) => acc + getRepPeakVelocity(r), 0);
  return sum / clusterReps.length;
}

function ClusterRow({
  cluster,
  reps,
  isLast,
  rpe,
}: {
  cluster: ClusterBoundary;
  reps: readonly Rep[];
  isLast: boolean;
  rpe: number | null;
}) {
  const clusterRepCount = cluster.repEnd - cluster.repStart;
  const avgVel = computeClusterMeanVelocity(reps, cluster);

  return (
    <View style={[rowStyle, { paddingLeft: 24 }]}>
      <Text style={detailStyle}>{clusterRepCount} reps</Text>
      <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>
      {isLast && rpe !== null && rpe > 0 && <Text style={rpeStyle}>RPE {rpe.toFixed(1)}</Text>}
    </View>
  );
}

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
        <Text style={detailStyle}>
          {repCount} reps · {set.weight} lbs
        </Text>
        <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>
        {rpe > 0 && <Text style={rpeStyle}>RPE {rpe.toFixed(1)}</Text>}
      </View>
    );
  }

  return (
    <View>
      <View style={rowStyle}>
        <Text style={setLabelStyle}>Set {setNumber}</Text>
        <Text style={detailStyle}>
          {repCount} reps · {set.weight} lbs
        </Text>
      </View>
      {clusters.map((cluster, i) => (
        <React.Fragment key={i}>
          <ClusterRow
            cluster={cluster}
            reps={set.data.reps}
            isLast={i === clusters.length - 1}
            rpe={i === clusters.length - 1 ? rpe : null}
          />
          {cluster.pauseAfterMs !== null && <PauseRow pauseMs={cluster.pauseAfterMs} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function ActiveSetRow({
  setIndex,
  repCount,
  weight,
  targetReps,
}: {
  setIndex: number;
  repCount: number;
  weight: number;
  targetReps: number | null;
}) {
  const repText = targetReps ? `${repCount}/${targetReps} reps` : `${repCount} reps`;
  return (
    <View style={[rowStyle, { backgroundColor: alpha(t['brand-primary'], 0.06) }]}>
      <Text style={setLabelStyle}>Set {setIndex + 1}</Text>
      <Text style={[detailStyle, { color: t['brand-primary'] }]}>
        {repText} · {weight} lbs
      </Text>
      <Text style={{ fontSize: 11, color: t['brand-primary'], fontStyle: 'italic' }}>
        (active)
      </Text>
    </View>
  );
}

function PlannedSetRow({ planned }: { planned: PlannedSet }) {
  return (
    <View style={[rowStyle, { opacity: 0.4 }]}>
      <Text style={setLabelStyle}>Set {planned.setNumber}</Text>
      <Text style={detailStyle}>
        {planned.targetReps} reps · {planned.weight} lbs
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SetLog({ setLog, activeSet, plannedSets }: SetLogProps) {
  return (
    <View>
      {setLog.map((entry, i) => (
        <CompletedSetRow key={entry.set.id} entry={entry} setNumber={i + 1} />
      ))}

      {activeSet && <ActiveSetRow {...activeSet} />}

      {plannedSets.map((planned) => (
        <PlannedSetRow key={planned.setNumber} planned={planned} />
      ))}
    </View>
  );
}
