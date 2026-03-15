/**
 * Coaching Context Builder
 *
 * Assembles telemetry data from across the domain into a structured
 * context object for the Claude coaching API. Converts raw domain
 * types into a prompt-ready format with a toPrompt() method.
 */

import type {
  StoredExerciseSession,
  StoredSessionSet,
} from '@/data/exercise-session';
import type { SessionMetrics } from '@/domain/workout/metrics/types';
import type {
  CoachingContext,
  SetSummary,
  SessionContext,
  AthleteHistory,
  AutoRegulationSignals,
  HistoricalSession,
  PersonalRecordSummary,
  PreviousCoachingCue,
  FatigueTrend,
  VelocityWarningSeverity,
} from './types';

// =============================================================================
// Input Types
// =============================================================================

/** Auto-regulation signals accepted by the coaching context builder. */
export interface AutoRegulationInput {
  velocityWarning: {
    severity: VelocityWarningSeverity;
    message: string;
  } | null;
  junkVolumeAlert: {
    isJunkVolume: boolean;
  } | null;
  loadSuggestion: {
    currentWeight: number;
    suggestedWeight: number;
    direction: 'increase' | 'decrease' | 'maintain';
    reason: string;
  } | null;
}

export interface BuildContextInput {
  /** The set that was just completed */
  currentSet: {
    exerciseId: string;
    exerciseName: string;
    setNumber: number;
    storedSet: StoredSessionSet;
  };

  /** Active session state */
  session: {
    setsCompleted: number;
    setsPlanned: number;
    startTime: number;
    trainingGoal: string;
  };

  /** Session-level metrics from the planning domain */
  sessionMetrics: SessionMetrics | null;

  /** Auto-regulation signals from the planning domain */
  autoRegulation: AutoRegulationInput | null;

  /** Historical sessions for this exercise (most recent first) */
  exerciseHistory: StoredExerciseSession[];

  /** Previous coaching cues from this session */
  previousCues?: PreviousCoachingCue[];
}

// =============================================================================
// Context Builder
// =============================================================================

export function buildCoachingContext(input: BuildContextInput): CoachingContext {
  return {
    currentSet: buildSetSummary(input.currentSet),
    session: buildSessionContext(input.session, input.sessionMetrics),
    athleteHistory: buildAthleteHistory(
      input.exerciseHistory,
      input.currentSet.storedSet.weight,
    ),
    autoRegulation: buildAutoRegulationSignals(
      input.autoRegulation,
      input.sessionMetrics,
    ),
    previousCues: input.previousCues ?? [],
    generatedAt: Date.now(),
  };
}

// =============================================================================
// Set Summary
// =============================================================================

function buildSetSummary(current: BuildContextInput['currentSet']): SetSummary {
  const { storedSet } = current;
  const peakVelocity = computePeakVelocity(storedSet);

  return {
    exerciseName: current.exerciseName,
    exerciseId: current.exerciseId,
    setNumber: current.setNumber,
    load: storedSet.weight,
    reps: storedSet.reps.length,
    meanVelocity: round(storedSet.meanVelocity, 2),
    peakVelocity: round(peakVelocity, 2),
    velocityLossPercent: round(storedSet.velocityLossPercent, 1),
    estimatedRPE: round(storedSet.estimatedRPE, 1),
    estimatedRIR: round(storedSet.estimatedRIR, 1),
    tempo: extractTempo(storedSet),
  };
}

function computePeakVelocity(set: StoredSessionSet): number {
  let peak = 0;
  for (const rep of set.reps) {
    for (const sample of rep.concentric.samples) {
      if (sample.velocity > peak) {
        peak = sample.velocity;
      }
    }
  }
  return peak;
}

function extractTempo(set: StoredSessionSet): SetSummary['tempo'] {
  if (set.reps.length === 0) return undefined;

  let totalConcMs = 0;
  let totalEccMs = 0;
  let repCount = 0;

  for (const rep of set.reps) {
    const concSamples = rep.concentric.samples;
    const eccSamples = rep.eccentric.samples;
    if (concSamples.length >= 2 && eccSamples.length >= 2) {
      totalConcMs += concSamples[concSamples.length - 1].timestamp - concSamples[0].timestamp;
      totalEccMs += eccSamples[eccSamples.length - 1].timestamp - eccSamples[0].timestamp;
      repCount++;
    }
  }

  if (repCount === 0) return undefined;

  return {
    concentricMs: Math.round(totalConcMs / repCount),
    eccentricMs: Math.round(totalEccMs / repCount),
  };
}

// =============================================================================
// Session Context
// =============================================================================

function buildSessionContext(
  session: BuildContextInput['session'],
  metrics: SessionMetrics | null,
): SessionContext {
  const durationMs = Date.now() - session.startTime;
  const durationMinutes = round(durationMs / 60_000, 1);

  const fatigueTrend: FatigueTrend = metrics
    ? {
        velocityRecoveryPercent: round(metrics.fatigue.velocityRecoveryPercent, 1),
        repDropPercent: round(metrics.fatigue.repDropPercent, 1),
        isJunkVolume: metrics.fatigue.isJunkVolume,
        fatigueLevel: round(metrics.fatigue.level, 2),
      }
    : {
        velocityRecoveryPercent: 100,
        repDropPercent: 0,
        isJunkVolume: false,
        fatigueLevel: 0,
      };

  return {
    exerciseName: session.trainingGoal,
    setsCompleted: session.setsCompleted,
    setsPlanned: session.setsPlanned,
    sessionDurationMinutes: durationMinutes,
    fatigueTrend,
    trainingGoal: session.trainingGoal,
  };
}

// =============================================================================
// Athlete History
// =============================================================================

const MAX_HISTORY_SESSIONS = 5;

function buildAthleteHistory(
  exerciseHistory: StoredExerciseSession[],
  currentLoad: number,
): AthleteHistory {
  const completed = exerciseHistory
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.startTime - a.startTime);

  const recent = completed.slice(0, MAX_HISTORY_SESSIONS);

  const recentSessions: HistoricalSession[] = recent.map(sessionToHistorical);
  const baselineVelocityAtLoad = findBaselineVelocity(completed, currentLoad);
  const personalRecords = buildPersonalRecords(completed);

  return {
    recentSessions,
    baselineVelocityAtLoad,
    personalRecords,
    sessionCount: completed.length,
  };
}

function sessionToHistorical(session: StoredExerciseSession): HistoricalSession {
  const sets = session.completedSets;
  let totalReps = 0;
  let totalVelocity = 0;
  let totalVLoss = 0;

  for (const set of sets) {
    totalReps += set.reps.length;
    totalVelocity += set.meanVelocity;
    totalVLoss += set.velocityLossPercent;
  }

  const setCount = sets.length || 1;
  const avgWeight = sets.length > 0 ? sets[0].weight : 0;

  return {
    date: session.startTime,
    load: avgWeight,
    sets: sets.length,
    totalReps,
    avgMeanVelocity: round(totalVelocity / setCount, 2),
    avgVelocityLossPercent: round(totalVLoss / setCount, 1),
  };
}

function findBaselineVelocity(
  sessions: StoredExerciseSession[],
  targetLoad: number,
): number | null {
  const tolerance = targetLoad * 0.05;
  const matchingSets: number[] = [];

  for (const session of sessions) {
    for (const set of session.completedSets) {
      if (
        Math.abs(set.weight - targetLoad) <= tolerance &&
        set.reps.length > 0
      ) {
        matchingSets.push(set.meanVelocity);
      }
    }
  }

  if (matchingSets.length === 0) return null;

  const sum = matchingSets.reduce((a, b) => a + b, 0);
  return round(sum / matchingSets.length, 3);
}

function buildPersonalRecords(
  sessions: StoredExerciseSession[],
): PersonalRecordSummary[] {
  const allSets: { set: StoredSessionSet; startTime: number }[] = [];
  for (const session of sessions) {
    for (const set of session.completedSets) {
      allSets.push({ set, startTime: set.startTime });
    }
  }

  if (allSets.length === 0) return [];

  const records: PersonalRecordSummary[] = [];

  let maxWeight = allSets[0];
  let maxReps = allSets[0];
  let maxVelocity = allSets[0];
  let maxVolume = allSets[0];
  let maxVolumeValue = allSets[0].set.weight * allSets[0].set.reps.length;

  for (const entry of allSets) {
    if (entry.set.weight > maxWeight.set.weight) maxWeight = entry;
    if (entry.set.reps.length > maxReps.set.reps.length) maxReps = entry;
    if (entry.set.meanVelocity > maxVelocity.set.meanVelocity) maxVelocity = entry;
    const volume = entry.set.weight * entry.set.reps.length;
    if (volume > maxVolumeValue) {
      maxVolume = entry;
      maxVolumeValue = volume;
    }
  }

  records.push({ type: 'max_weight', value: maxWeight.set.weight, date: maxWeight.startTime });
  records.push({ type: 'max_reps', value: maxReps.set.reps.length, date: maxReps.startTime });
  records.push({ type: 'max_velocity', value: maxVelocity.set.meanVelocity, date: maxVelocity.startTime });
  records.push({ type: 'max_volume', value: maxVolumeValue, date: maxVolume.startTime });

  return records;
}

// =============================================================================
// Auto-Regulation Signals
// =============================================================================

function buildAutoRegulationSignals(
  autoReg: AutoRegulationInput | null,
  metrics: SessionMetrics | null,
): AutoRegulationSignals {
  const readinessZone = metrics?.readiness.zone ?? 'green';
  const readinessConfidence = metrics?.readiness.confidence ?? 0;

  return {
    readinessZone,
    readinessConfidence: round(readinessConfidence, 2),
    velocityWarningSeverity: autoReg?.velocityWarning?.severity ?? null,
    velocityWarningMessage: autoReg?.velocityWarning?.message ?? null,
    junkVolumeDetected: autoReg?.junkVolumeAlert?.isJunkVolume ?? false,
    loadSuggestion: autoReg?.loadSuggestion
      ? {
          currentWeight: autoReg.loadSuggestion.currentWeight,
          suggestedWeight: autoReg.loadSuggestion.suggestedWeight,
          direction: autoReg.loadSuggestion.direction,
          reason: autoReg.loadSuggestion.reason,
        }
      : null,
  };
}

// =============================================================================
// Prompt Generation
// =============================================================================

export function toPrompt(context: CoachingContext): {
  system: string;
  user: string;
} {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt(context),
  };
}

function buildSystemPrompt(): string {
  return [
    'You are a strength and conditioning coach analyzing real-time velocity-based training (VBT) data from a Voltra cable machine.',
    'Your role is to provide concise, actionable coaching cues based on the telemetry data provided.',
    '',
    'Guidelines:',
    '- Keep responses to 2-3 sentences max',
    '- Focus on the most important signal (fatigue, form, load adjustment)',
    '- Reference specific numbers from the data (velocity, RPE, load)',
    '- If velocity is dropping significantly, prioritize that over other signals',
    '- If auto-regulation suggests a load change, incorporate that recommendation',
    '- Be encouraging but honest about performance',
    '- Never recommend ignoring junk volume or velocity warning signals',
  ].join('\n');
}

function buildUserPrompt(context: CoachingContext): string {
  const sections: string[] = [];

  sections.push(formatCurrentSet(context.currentSet));
  sections.push(formatSession(context.session));
  sections.push(formatHistory(context.athleteHistory));
  sections.push(formatAutoRegulation(context.autoRegulation));

  if (context.previousCues.length > 0) {
    sections.push(formatPreviousCues(context.previousCues));
  }

  return sections.join('\n\n');
}

function formatCurrentSet(set: SetSummary): string {
  const lines = [
    `## Current Set`,
    `Exercise: ${set.exerciseName}`,
    `Set ${set.setNumber}: ${set.load} lbs x ${set.reps} reps`,
    `Mean velocity: ${set.meanVelocity} m/s | Peak: ${set.peakVelocity} m/s`,
    `Velocity loss: ${set.velocityLossPercent}%`,
    `RPE: ${set.estimatedRPE} | RIR: ${set.estimatedRIR}`,
  ];

  if (set.tempo) {
    lines.push(
      `Tempo: ${set.tempo.concentricMs}ms concentric / ${set.tempo.eccentricMs}ms eccentric`,
    );
  }

  return lines.join('\n');
}

function formatSession(session: SessionContext): string {
  const { fatigueTrend: ft } = session;
  return [
    `## Session`,
    `Progress: ${session.setsCompleted}/${session.setsPlanned} sets | Duration: ${session.sessionDurationMinutes} min`,
    `Goal: ${session.trainingGoal}`,
    `Fatigue: level ${ft.fatigueLevel} | velocity recovery ${ft.velocityRecoveryPercent}% | rep drop ${ft.repDropPercent}%`,
    ft.isJunkVolume ? '⚠ JUNK VOLUME DETECTED' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatHistory(history: AthleteHistory): string {
  if (history.sessionCount === 0) {
    return '## History\nNo previous sessions for this exercise.';
  }

  const lines = [`## History (${history.sessionCount} sessions)`];

  if (history.baselineVelocityAtLoad !== null) {
    lines.push(`Baseline velocity at this load: ${history.baselineVelocityAtLoad} m/s`);
  }

  for (const s of history.recentSessions) {
    const date = new Date(s.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    lines.push(
      `- ${date}: ${s.load} lbs, ${s.sets} sets, ${s.totalReps} reps, avg vel ${s.avgMeanVelocity} m/s`,
    );
  }

  if (history.personalRecords.length > 0) {
    lines.push('PRs:');
    for (const pr of history.personalRecords) {
      lines.push(`- ${pr.type}: ${pr.value}`);
    }
  }

  return lines.join('\n');
}

function formatAutoRegulation(signals: AutoRegulationSignals): string {
  const lines = [
    `## Auto-Regulation`,
    `Readiness: ${signals.readinessZone} (confidence: ${signals.readinessConfidence})`,
  ];

  if (signals.velocityWarningSeverity) {
    lines.push(
      `Velocity warning [${signals.velocityWarningSeverity}]: ${signals.velocityWarningMessage}`,
    );
  }

  if (signals.junkVolumeDetected) {
    lines.push('Junk volume: DETECTED — additional sets are not productive');
  }

  if (signals.loadSuggestion) {
    const ls = signals.loadSuggestion;
    lines.push(
      `Load suggestion: ${ls.direction} from ${ls.currentWeight} to ${ls.suggestedWeight} lbs (${ls.reason})`,
    );
  }

  return lines.join('\n');
}

function formatPreviousCues(cues: PreviousCoachingCue[]): string {
  const lines = ['## Previous Coaching'];
  for (const cue of cues) {
    const status =
      cue.followed === true
        ? '(followed)'
        : cue.followed === false
          ? '(not followed)'
          : '(unknown)';
    lines.push(`- Set ${cue.setNumber}: "${cue.message}" ${status}`);
  }
  return lines.join('\n');
}

// =============================================================================
// Helpers
// =============================================================================

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
