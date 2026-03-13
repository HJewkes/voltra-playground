import React, { useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import {
  getSetMeanVelocity,
  estimateSetRIR,
  getRepPeakVelocity,
  type Rep,
} from '@voltras/workout-analytics';
import type { SetLogEntry, ClusterBoundary, PlannedSet } from '@/domain/workout';
import type { WorkoutSample } from '@voltras/workout-analytics';
import { SetCurveChart } from '@/components/analytics';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface ActiveChartData {
  samples: WorkoutSample[];
  expectedDurationMs: number;
}

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
  /** Live chart data for the active set */
  activeChart?: ActiveChartData | null;
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

function CompletedSetRow({
  entry,
  setNumber,
  expanded,
  onToggle,
}: {
  entry: SetLogEntry;
  setNumber: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 56; // account for card + log padding

  const { set, clusters, samples } = entry;
  const repCount = set.data.reps.length;
  const avgVel = getSetMeanVelocity(set.data);
  const { rpe } = estimateSetRIR(set.data);
  const hasClusters = clusters.length > 0;
  const hasSamples = samples && samples.length > 0;

  const chevron = hasSamples ? (expanded ? '▲' : '▼') : null;

  const mainRow = (
    <View style={rowStyle}>
      <Text style={setLabelStyle}>Set {setNumber}</Text>
      <Text style={detailStyle}>
        {repCount} reps · {set.weight} lbs
      </Text>
      {!hasClusters && <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>}
      {!hasClusters && rpe > 0 && <Text style={rpeStyle}>RPE {rpe.toFixed(1)}</Text>}
      {chevron && (
        <Text style={{ fontSize: 10, color: t['text-disabled'], marginLeft: 4 }}>{chevron}</Text>
      )}
    </View>
  );

  return (
    <View>
      {hasSamples ? (
        <Pressable onPress={onToggle}>{mainRow}</Pressable>
      ) : (
        mainRow
      )}

      {hasClusters && clusters.map((cluster, i) => (
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

      {expanded && hasSamples && (
        <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
          <SetCurveChart
            samples={samples}
            width={chartWidth}
            height={120}
          />
        </View>
      )}
    </View>
  );
}

function ActiveSetRow({
  setIndex,
  repCount,
  weight,
  targetReps,
  chart,
}: {
  setIndex: number;
  repCount: number;
  weight: number;
  targetReps: number | null;
  chart?: ActiveChartData | null;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 56;

  const repText = targetReps ? `${repCount}/${targetReps} reps` : `${repCount} reps`;
  return (
    <View>
      <View style={[rowStyle, { backgroundColor: alpha(t['brand-primary'], 0.06) }]}>
        <Text style={setLabelStyle}>Set {setIndex + 1}</Text>
        <Text style={[detailStyle, { color: t['brand-primary'] }]}>
          {repText} · {weight} lbs
        </Text>
        <Text style={{ fontSize: 11, color: t['brand-primary'], fontStyle: 'italic' }}>
          (active)
        </Text>
      </View>
      {chart && chart.samples.length > 0 && (
        <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
          <SetCurveChart
            samples={chart.samples}
            width={chartWidth}
            height={140}
            expectedDurationMs={chart.expectedDurationMs}
          />
        </View>
      )}
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

export function SetLog({ setLog, activeSet, activeChart, plannedSets }: SetLogProps) {
  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  // Active set + chart first, then completed sets in reverse order (most recent first), then planned
  return (
    <View>
      {activeSet && <ActiveSetRow {...activeSet} chart={activeChart} />}

      {[...setLog].reverse().map((entry, i) => (
        <CompletedSetRow
          key={entry.set.id}
          entry={entry}
          setNumber={setLog.length - i}
          expanded={expandedSet === entry.set.id}
          onToggle={() =>
            setExpandedSet((prev) => (prev === entry.set.id ? null : entry.set.id))
          }
        />
      ))}

      {plannedSets.map((planned) => (
        <PlannedSetRow key={planned.setNumber} planned={planned} />
      ))}
    </View>
  );
}
