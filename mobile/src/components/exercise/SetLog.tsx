import React, { useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';
import {
  getSetMeanVelocity,
  estimateSetRIR,
  getRepPeakVelocity,
  MovementPhase,
  type Rep,
} from '@voltras/workout-analytics';
import type { SetLogEntry, ClusterBoundary, PlannedSet, TempoTarget } from '@/domain/workout';
import { getRPEColor } from '@/domain/workout';
import type { WorkoutSample } from '@voltras/workout-analytics';
import { SetCurveChart, RepCurveChart, SIGNAL_OPTIONS } from '@/components/analytics';
import type { ChartSignal } from '@/components/analytics';
import { RestScrubber } from './RestScrubber';
import { TempoBar } from './TempoBar';
import { CycleToggle, type CycleToggleOption } from './CycleToggle';

type ChartView = 'set' | 'rep';
const VIEW_OPTIONS: readonly CycleToggleOption<ChartView>[] = [
  { value: 'set', label: 'Set' },
  { value: 'rep', label: 'Rep' },
];

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface ActiveChartData {
  samples: WorkoutSample[];
  expectedDurationMs: number;
}

export interface ActiveTelemetry {
  rpe: number;
  rir: number;
  currentPhase: MovementPhase;
  phaseElapsedMs: number;
  repPhaseDurations: { phase: MovementPhase; durationMs: number }[];
  targetTempo?: TempoTarget;
  liveMessage?: string;
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
  /** Live telemetry for the active set (RPE, RIR, tempo) */
  activeTelemetry?: ActiveTelemetry | null;
  /** Planned future sets (from session plan) */
  plannedSets: PlannedSet[];
  /** Total planned sets (null if dynamic/unlimited) */
  totalSets: number | null;
  /** Whether the session is currently in rest state */
  isResting?: boolean;
  /** Elapsed rest time in ms (used with isResting) */
  restElapsedMs?: number;
  /** Default rest seconds from plan (used for rest scrubbers) */
  defaultRestSeconds?: number;
  /** Called when user drags a rest scrubber for a planned set */
  onPlannedRestChange?: (setIndex: number, restSeconds: number) => void;
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
  telemetry,
}: {
  setIndex: number;
  repCount: number;
  weight: number;
  targetReps: number | null;
  chart?: ActiveChartData | null;
  telemetry?: ActiveTelemetry | null;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 56;

  const hasMetrics = telemetry && repCount > 0;
  const rpeColor = hasMetrics ? getRPEColor(telemetry.rpe) : t['text-disabled'];
  const repText = targetReps ? `${repCount}/${targetReps} reps` : `${repCount} reps`;

  return (
    <View>
      <View style={[rowStyle, { backgroundColor: alpha(t['brand-primary'], 0.06) }]}>
        <Text style={setLabelStyle}>Set {setIndex + 1}</Text>
        <Text style={[detailStyle, { color: t['brand-primary'] }]}>
          {repText} · {weight} lbs
        </Text>
        {hasMetrics ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[rpeStyle, { color: rpeColor }]}>
              RPE {telemetry.rpe.toFixed(1)}
            </Text>
            <Text style={rpeStyle}>
              RIR {telemetry.rir >= 5 ? '5+' : `~${Math.round(telemetry.rir)}`}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 11, color: t['brand-primary'], fontStyle: 'italic' }}>
            (active)
          </Text>
        )}
      </View>

      {telemetry && (
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <TempoBar
            currentPhase={telemetry.currentPhase}
            phaseElapsedMs={telemetry.phaseElapsedMs}
            repPhaseDurations={telemetry.repPhaseDurations}
            targetTempo={telemetry.targetTempo}
          />
        </View>
      )}

      {telemetry?.liveMessage && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: rpeColor,
            textAlign: 'center',
            paddingTop: 4,
            paddingHorizontal: 12,
          }}
        >
          {telemetry.liveMessage}
        </Text>
      )}

      {chart && chart.samples.length > 0 && (
        <ActiveSetChart
          chart={chart}
          telemetry={telemetry}
          chartWidth={chartWidth}
        />
      )}
    </View>
  );
}

function ActiveSetChart({
  chart,
  telemetry,
  chartWidth,
}: {
  chart: ActiveChartData;
  telemetry?: ActiveTelemetry | null;
  chartWidth: number;
}) {
  const [view, setView] = useState<ChartView>('set');
  const [signal, setSignal] = useState<ChartSignal>('velocity');

  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
      {/* Two toggles on one line: view left, signal right */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <CycleToggle options={VIEW_OPTIONS} value={view} onChange={setView} />
        <CycleToggle
          options={SIGNAL_OPTIONS}
          value={signal}
          onChange={setSignal}
          activeColor={signal === 'velocity' ? t['status-success'] : signal === 'force' ? t['brand-primary'] : t['status-info']}
        />
      </View>
      {view === 'set' ? (
        <SetCurveChart
          samples={chart.samples}
          width={chartWidth}
          height={140}
          expectedDurationMs={chart.expectedDurationMs}
          signal={signal}
        />
      ) : (
        <RepCurveChart
          samples={chart.samples}
          width={chartWidth}
          height={140}
          repPhaseDurations={telemetry?.repPhaseDurations ?? []}
          currentPhase={telemetry?.currentPhase ?? MovementPhase.IDLE}
          phaseElapsedMs={telemetry?.phaseElapsedMs ?? 0}
          targetTempo={telemetry?.targetTempo}
        />
      )}
    </View>
  );
}

function PlannedSetRow({ planned }: { planned: PlannedSet }) {
  return (
    <View style={rowStyle}>
      <Text style={setLabelStyle}>Set {planned.setNumber}</Text>
      <Text style={detailStyle}>
        {planned.targetReps > 0 ? `${planned.targetReps} reps · ` : ''}{planned.weight} lbs
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SetLog({
  setLog,
  activeSet,
  activeChart,
  activeTelemetry,
  plannedSets,
  isResting,
  restElapsedMs,
  defaultRestSeconds = 90,
  onPlannedRestChange,
}: SetLogProps) {
  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  // Ascending order: completed sets → rest (if resting) → active set → planned sets
  return (
    <View>
      {/* Completed sets in ascending order */}
      {setLog.map((entry, i) => (
        <React.Fragment key={entry.set.id}>
          <Surface elevation={1} className="rounded-xl p-3 mt-2">
            <CompletedSetRow
              entry={entry}
              setNumber={i + 1}
              expanded={expandedSet === entry.set.id}
              onToggle={() =>
                setExpandedSet((prev) => (prev === entry.set.id ? null : entry.set.id))
              }
            />
          </Surface>
          {/* Rest scrubber after each completed set */}
          {i < setLog.length - 1 && (
            <View style={{ marginTop: 4, marginBottom: 4 }}>
              <RestScrubber mode="complete" restSeconds={defaultRestSeconds} />
            </View>
          )}
        </React.Fragment>
      ))}

      {/* Rest scrubber in resting mode — after last completed set, before next */}
      {isResting && (
        <View style={{ marginTop: 4, marginBottom: 4 }}>
          <RestScrubber
            mode="resting"
            restSeconds={defaultRestSeconds}
            elapsedMs={restElapsedMs}
          />
        </View>
      )}

      {/* Active set with telemetry + chart */}
      {activeSet && (
        <Surface
          elevation={1}
          className="rounded-xl p-3 mt-2"
          style={{ borderLeftWidth: 3, borderLeftColor: t['brand-primary'] }}
        >
          <ActiveSetRow {...activeSet} chart={activeChart} telemetry={activeTelemetry} />
        </Surface>
      )}

      {/* Rest scrubbers + planned (future) sets */}
      {plannedSets.map((planned, i) => (
        <React.Fragment key={planned.setNumber}>
          {(i === 0 && (setLog.length > 0 || activeSet || isResting)) || i > 0 ? (
            <View style={{ marginTop: 4, marginBottom: 4 }}>
              <RestScrubber
                mode="editing"
                restSeconds={planned.restSeconds ?? defaultRestSeconds}
                onRestChange={onPlannedRestChange
                  ? (s) => onPlannedRestChange(planned.setNumber - 1, s)
                  : undefined
                }
              />
            </View>
          ) : null}
          <Surface
            elevation={1}
            className="rounded-xl p-3 mt-1"
            style={{ opacity: 0.5 }}
          >
            <PlannedSetRow planned={planned} />
          </Surface>
        </React.Fragment>
      ))}
    </View>
  );
}
