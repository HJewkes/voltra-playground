import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Surface, SetRow, getSemanticColors } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import {
  getSetMeanVelocity,
  estimateSetRIR,
  MovementPhase,
  type Rep,
  type WorkoutSample,
} from '@voltras/workout-analytics';
import { computeClusterMeanVelocity } from './set-log-utils';
import type { SetLogEntry, ClusterBoundary, PlannedSet, TempoTarget } from '@/domain/workout';
import type { PRBadge } from '@/domain/history/services/pr-detector';
import { getRPEColor } from '@/domain/workout';
import { SetCurveChart, RepCurveChart, SIGNAL_OPTIONS } from '@/components/analytics';
import type { ChartSignal } from '@/components/analytics';
import type { SessionNote } from '@/stores/exercise-session-store';
import { RestScrubber } from './RestScrubber';
import { TempoBar } from './TempoBar';
import { CycleToggle, type CycleToggleOption } from './CycleToggle';
import { QuickNote } from './QuickNote';

export { computeClusterMeanVelocity } from './set-log-utils';

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
  meanVelocity?: number;
  velocityLoss?: number;
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
  /** Setup notes for the current exercise (from catalog) */
  exerciseSetupNotes?: string;
  /** Whether the session is currently in rest state */
  isResting?: boolean;
  /** Elapsed rest time in ms (used with isResting) */
  restElapsedMs?: number;
  /** Default rest seconds from plan (used for rest scrubbers) */
  defaultRestSeconds?: number;
  /** Called when user drags a rest scrubber for a planned set */
  onPlannedRestChange?: (setIndex: number, restSeconds: number) => void;
  /** Session notes (displayed after their corresponding set) */
  sessionNotes?: SessionNote[];
  /** Called when athlete saves a new note */
  onAddNote?: (text: string) => void;
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

// Sibling meta row under a titan SetRow (mean velocity / expand chevron / RIR).
const completedMetaStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  paddingHorizontal: 12,
  paddingTop: 2,
};

// =============================================================================
// Coaching Cues
// =============================================================================

/** Cable-specific velocity zones (m/s) — lower than barbell due to friction/pulley */
const VELOCITY_GREEN = 0.55;
const VELOCITY_WORKING = 0.4;
// Cable-specific velocity loss threshold (higher than barbell 20%)
const VELOCITY_LOSS_THRESHOLD = 0.25;
const MIN_REPS_FOR_VEL_LOSS = 3;

interface CoachingCueData {
  text: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function getVelocityCue(
  meanVelocity: number,
  velocityLoss: number,
  repCount: number
): CoachingCueData {
  // Only flag velocity loss after enough reps for reliable data
  if (repCount >= MIN_REPS_FOR_VEL_LOSS && velocityLoss >= VELOCITY_LOSS_THRESHOLD) {
    return {
      text: 'High velocity loss — nearing limit',
      color: '#f97316',
      icon: 'trending-down-outline',
    };
  }
  if (meanVelocity < VELOCITY_WORKING) {
    return {
      text: 'Heavy load zone — control the eccentric',
      color: '#eab308',
      icon: 'barbell-outline',
    };
  }
  if (meanVelocity <= VELOCITY_GREEN) {
    return { text: 'Good working pace', color: '#22c55e', icon: 'checkmark-circle-outline' };
  }
  return {
    text: 'Light — increase load or slow tempo',
    color: t['text-tertiary'],
    icon: 'arrow-up-circle-outline',
  };
}

function getCoachingCue(
  repCount: number,
  telemetry: ActiveTelemetry | null | undefined,
  setupNotes: string | undefined
): CoachingCueData | null {
  if (repCount === 0 && setupNotes) {
    return { text: setupNotes, color: t['text-secondary'], icon: 'information-circle-outline' };
  }
  // Don't show velocity cue when effort message is active (avoids conflicting signals)
  if (telemetry?.liveMessage) {
    return null;
  }
  if (repCount > 0 && telemetry?.meanVelocity !== undefined && telemetry.meanVelocity > 0) {
    return getVelocityCue(telemetry.meanVelocity, telemetry.velocityLoss ?? 0, repCount);
  }
  return null;
}

function CoachingCueBar({ cue }: { cue: CoachingCueData }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingTop: 4,
      }}
    >
      <Ionicons name={cue.icon} size={14} color={cue.color} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, fontWeight: '500', color: cue.color, flex: 1 }}
      >
        {cue.text}
      </Text>
    </View>
  );
}

// =============================================================================
// Info Icon — replaces inline onboarding tooltips
// =============================================================================

function InfoIcon({ title, body }: { title: string; body: string }) {
  return (
    <Pressable onPress={() => Alert.alert(title, body)} hitSlop={8}>
      <Ionicons name="information-circle-outline" size={14} color={t['text-tertiary']} />
    </Pressable>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

// =============================================================================
// PR Badge
// =============================================================================

function PRBadgeRow({ badges }: { badges: PRBadge[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        paddingHorizontal: 12,
        paddingTop: 4,
      }}
    >
      {badges.map((badge) => (
        <View
          key={badge.type}
          style={{
            backgroundColor: '#facc15',
            borderRadius: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#78350f' }}>{badge.label}</Text>
        </View>
      ))}
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

// computeClusterMeanVelocity moved to set-log-utils.ts, re-exported above

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

  // titan SetRow renders the canonical set# / reps / weight / RPE columns.
  // RPE stays off the row when clusters exist (shown per-cluster below instead).
  const mainRow = (
    <>
      <SetRow
        mode="completed"
        setNumber={setNumber}
        previous={null}
        reps={repCount}
        weight={set.weight}
        rpe={!hasClusters && rpe > 0 ? rpe : null}
        unit="lbs"
        isNextSet={false}
      />
      {/* Mean velocity + expand chevron — SetRow has no slot for either.
          Velocity kept as a sibling (titan VelocityStrip zones are barbell-tuned;
          cable work needs its own thresholds — VLT-09.33 velocities option a). */}
      {(!hasClusters || chevron) && (
        <View style={completedMetaStyle}>
          {!hasClusters && <Text style={metricStyle}>{avgVel.toFixed(2)} m/s</Text>}
          {chevron && <Text style={{ fontSize: 10, color: t['text-disabled'] }}>{chevron}</Text>}
        </View>
      )}
    </>
  );

  return (
    <View>
      {hasSamples ? <Pressable onPress={onToggle}>{mainRow}</Pressable> : mainRow}

      {hasClusters &&
        clusters.map((cluster, i) => (
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

      {entry.prBadges && entry.prBadges.length > 0 && <PRBadgeRow badges={entry.prBadges} />}

      {expanded && hasSamples && (
        <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
          <SetCurveChart samples={samples} width={chartWidth} height={120} />
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
  exerciseSetupNotes,
}: {
  setIndex: number;
  repCount: number;
  weight: number;
  targetReps: number | null;
  chart?: ActiveChartData | null;
  telemetry?: ActiveTelemetry | null;
  exerciseSetupNotes?: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 56;

  const hasMetrics = telemetry && repCount > 0;
  const rpeColor = hasMetrics ? getRPEColor(telemetry.rpe) : t['text-disabled'];

  return (
    <View>
      {/* Active set as a titan SetRow: orange next-set highlight, live reps/RPE,
          italic target reps pre-first-rep. Weight is always the configured load. */}
      <SetRow
        mode="active"
        setNumber={setIndex + 1}
        previous={null}
        reps={repCount > 0 ? repCount : null}
        weight={weight}
        rpe={hasMetrics ? telemetry.rpe : null}
        unit="lbs"
        isNextSet
        targets={targetReps != null ? { reps: targetReps, weight } : undefined}
      />
      {/* RIR + the RPE explainer — SetRow shows the RPE number itself. */}
      {hasMetrics && (
        <View style={completedMetaStyle}>
          <Text style={rpeStyle}>
            RIR {telemetry.rir >= 5 ? '5+' : `~${Math.round(telemetry.rir)}`}
          </Text>
          <InfoIcon
            title="RPE — rate of perceived exertion"
            body="Scale of 1–10 estimating how hard the set was. RPE 10 = maximum effort, RPE 7–8 = 2–3 reps left in the tank."
          />
        </View>
      )}

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

      {(() => {
        const cue = getCoachingCue(repCount, telemetry, exerciseSetupNotes);
        if (!cue) return null;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1 }}>
              <CoachingCueBar cue={cue} />
            </View>
            <View style={{ paddingRight: 12 }}>
              <InfoIcon
                title="Mean concentric velocity"
                body="This number (m/s) measures how fast you moved the bar. Higher is more explosive; lower means the load is heavier relative to your strength. A 20%+ drop from your first rep typically means your muscles are near their limit."
              />
            </View>
          </View>
        );
      })()}

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
        <ActiveSetChart chart={chart} telemetry={telemetry} chartWidth={chartWidth} />
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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <CycleToggle options={VIEW_OPTIONS} value={view} onChange={setView} />
        <CycleToggle
          options={SIGNAL_OPTIONS}
          value={signal}
          onChange={setSignal}
          activeColor={
            signal === 'velocity'
              ? t['status-success']
              : signal === 'force'
                ? t['brand-primary']
                : t['status-info']
          }
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

function NoteRow({ note }: { note: SessionNote }) {
  const time = new Date(note.timestamp);
  const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Ionicons
        name="create-outline"
        size={12}
        color={t['text-tertiary']}
        style={{ marginTop: 2 }}
      />
      <Text style={{ fontSize: 12, color: t['text-secondary'], flex: 1 }} numberOfLines={3}>
        {note.text}
      </Text>
      <Text style={{ fontSize: 10, color: t['text-disabled'] }}>{timeStr}</Text>
    </View>
  );
}

function PlannedSetRow({ planned }: { planned: PlannedSet }) {
  // Rendered as an active SetRow WITHOUT the next-set highlight, so titan shows the
  // planned reps/weight as italic targets. The parent Surface dims it (opacity 0.5).
  return (
    <SetRow
      mode="active"
      setNumber={planned.setNumber}
      previous={null}
      reps={null}
      weight={null}
      unit="lbs"
      isNextSet={false}
      targets={{ reps: planned.targetReps, weight: planned.weight }}
    />
  );
}

// =============================================================================
// Active set card
// =============================================================================

function ActiveSetCard({
  activeSet,
  activeChart,
  activeTelemetry,
  exerciseSetupNotes,
}: {
  activeSet: NonNullable<SetLogProps['activeSet']>;
  activeChart: SetLogProps['activeChart'];
  activeTelemetry: SetLogProps['activeTelemetry'];
  exerciseSetupNotes: SetLogProps['exerciseSetupNotes'];
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Surface
        elevation={1}
        className="rounded-xl p-3"
        style={{ borderLeftWidth: 3, borderLeftColor: t['brand-primary'] }}
      >
        <ActiveSetRow
          {...activeSet}
          chart={activeChart}
          telemetry={activeTelemetry}
          exerciseSetupNotes={exerciseSetupNotes}
        />
      </Surface>
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
  exerciseSetupNotes,
  isResting,
  restElapsedMs,
  defaultRestSeconds = 90,
  onPlannedRestChange,
  sessionNotes = [],
  onAddNote,
}: SetLogProps) {
  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  // Ascending order: completed sets → rest (if resting) → active set → planned sets
  return (
    <View>
      {/* Completed sets in ascending order */}
      {setLog.map((entry, i) => {
        const setNotes = sessionNotes.filter((n) => n.setIndex === i + 1);
        return (
          <React.Fragment key={entry.set.id}>
            <Surface elevation={1} className="mt-2 rounded-xl p-3">
              <CompletedSetRow
                entry={entry}
                setNumber={i + 1}
                expanded={expandedSet === entry.set.id}
                onToggle={() =>
                  setExpandedSet((prev) => (prev === entry.set.id ? null : entry.set.id))
                }
              />
              {/* Notes attached to this set */}
              {setNotes.map((note) => (
                <NoteRow key={note.timestamp} note={note} />
              ))}
            </Surface>
            {/* Rest scrubber after each completed set */}
            {i < setLog.length - 1 && (
              <View style={{ marginTop: 4, marginBottom: 4 }}>
                <RestScrubber mode="complete" restSeconds={defaultRestSeconds} />
              </View>
            )}
          </React.Fragment>
        );
      })}

      {/* Quick note input during rest */}
      {isResting && onAddNote && (
        <View style={{ marginTop: 6, paddingHorizontal: 12 }}>
          <QuickNote onSave={onAddNote} />
        </View>
      )}

      {/* Rest scrubber in resting mode — after last completed set, before next */}
      {isResting && (
        <View style={{ marginTop: 4, marginBottom: 4 }}>
          <RestScrubber mode="resting" restSeconds={defaultRestSeconds} elapsedMs={restElapsedMs} />
        </View>
      )}

      {/* Active set */}
      {activeSet && (
        <ActiveSetCard
          activeSet={activeSet}
          activeChart={activeChart}
          activeTelemetry={activeTelemetry}
          exerciseSetupNotes={exerciseSetupNotes}
        />
      )}

      {/* Rest scrubbers + planned (future) sets */}
      {plannedSets.map((planned, i) => (
        <React.Fragment key={planned.setNumber}>
          {(i === 0 && (setLog.length > 0 || activeSet || isResting)) || i > 0 ? (
            <View style={{ marginTop: 4, marginBottom: 4 }}>
              <RestScrubber
                mode="editing"
                restSeconds={planned.restSeconds ?? defaultRestSeconds}
                onRestChange={
                  onPlannedRestChange
                    ? (s) => onPlannedRestChange(planned.setNumber - 1, s)
                    : undefined
                }
              />
            </View>
          ) : null}
          <Surface elevation={1} className="mt-1 rounded-xl p-3" style={{ opacity: 0.5 }}>
            <PlannedSetRow planned={planned} />
          </Surface>
        </React.Fragment>
      ))}
    </View>
  );
}
