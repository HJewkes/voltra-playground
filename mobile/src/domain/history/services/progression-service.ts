/**
 * Progression Service
 *
 * Pure functions for computing per-exercise progression between sessions.
 * Compares velocity, e1RM, and volume across sessions to show trends.
 */

import type { StoredExerciseSession, StoredSessionSet } from '@/data/exercise-session';

// =============================================================================
// Types
// =============================================================================

/** Direction of a metric trend. */
export type TrendDirection = 'up' | 'down' | 'flat';

/** A single metric comparison between current and previous session. */
export interface MetricComparison {
  label: string;
  unit: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  direction: TrendDirection;
}

/** Full progression comparison for an exercise. */
export interface ExerciseProgression {
  exerciseId: string;
  exerciseName: string;
  currentSessionDate: number;
  previousSessionDate: number;
  weight: number;
  velocity: MetricComparison;
  e1RM: MetricComparison;
  volume: MetricComparison;
}

/** Lightweight banner data for session start. */
export interface LastSessionBanner {
  exerciseId: string;
  exerciseName: string;
  date: number;
  weight: number;
  velocity: number;
  sets: number;
  reps: number;
}

// =============================================================================
// Constants
// =============================================================================

const FLAT_THRESHOLD_PERCENT = 2;

// =============================================================================
// Helpers
// =============================================================================

function getTrendDirection(deltaPercent: number): TrendDirection {
  if (Math.abs(deltaPercent) < FLAT_THRESHOLD_PERCENT) return 'flat';
  return deltaPercent > 0 ? 'up' : 'down';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute mean velocity across working sets (excludes warmups). */
function computeWorkingMeanVelocity(session: StoredExerciseSession): number {
  const workingSets = getWorkingSets(session);
  if (workingSets.length === 0) return 0;

  const sum = workingSets.reduce((acc, s) => acc + s.meanVelocity, 0);
  return sum / workingSets.length;
}

/** Estimate 1RM using Brzycki formula from the heaviest working set. */
function computeEstimated1RM(session: StoredExerciseSession): number {
  const workingSets = getWorkingSets(session);
  if (workingSets.length === 0) return 0;

  let best1RM = 0;
  for (const set of workingSets) {
    const reps = set.reps.length;
    if (reps === 0) continue;
    const e1rm = reps === 1
      ? set.weight
      : set.weight * (36 / (37 - reps));
    if (e1rm > best1RM) best1RM = e1rm;
  }
  return round2(best1RM);
}

/** Compute total session volume (weight x reps for working sets). */
function computeSessionVolume(session: StoredExerciseSession): number {
  const workingSets = getWorkingSets(session);
  let volume = 0;
  for (const set of workingSets) {
    volume += set.weight * set.reps.length;
  }
  return volume;
}

/** Get working sets (non-warmup). */
function getWorkingSets(session: StoredExerciseSession): StoredSessionSet[] {
  return session.completedSets.filter(
    (_, i) => !session.plan.sets[i]?.isWarmup,
  );
}

function buildMetricComparison(
  label: string,
  unit: string,
  current: number,
  previous: number,
): MetricComparison {
  const delta = round2(current - previous);
  const deltaPercent = previous !== 0
    ? round2((delta / previous) * 100)
    : 0;

  return {
    label,
    unit,
    current: round2(current),
    previous: round2(previous),
    delta,
    deltaPercent,
    direction: getTrendDirection(deltaPercent),
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compare a current session against the most recent previous session
 * for the same exercise.
 *
 * Returns null if no previous session exists or either session has no sets.
 */
export function computeExerciseProgression(
  currentSession: StoredExerciseSession,
  previousSession: StoredExerciseSession,
): ExerciseProgression | null {
  if (
    currentSession.completedSets.length === 0 ||
    previousSession.completedSets.length === 0
  ) {
    return null;
  }

  const currentWeight = getMaxWorkingWeight(currentSession);
  const currentVelocity = computeWorkingMeanVelocity(currentSession);
  const currentE1RM = computeEstimated1RM(currentSession);
  const currentVolume = computeSessionVolume(currentSession);

  const previousVelocity = computeWorkingMeanVelocity(previousSession);
  const previousE1RM = computeEstimated1RM(previousSession);
  const previousVolume = computeSessionVolume(previousSession);

  return {
    exerciseId: currentSession.exerciseId,
    exerciseName: currentSession.exerciseName ?? currentSession.exerciseId,
    currentSessionDate: currentSession.startTime,
    previousSessionDate: previousSession.startTime,
    weight: currentWeight,
    velocity: buildMetricComparison('Velocity', 'm/s', currentVelocity, previousVelocity),
    e1RM: buildMetricComparison('Est. 1RM', 'lbs', currentE1RM, previousE1RM),
    volume: buildMetricComparison('Volume', 'lbs', currentVolume, previousVolume),
  };
}

/**
 * Build a "last session" banner for display at session start.
 * Returns null if no completed session exists for the exercise.
 */
export function buildLastSessionBanner(
  sessions: StoredExerciseSession[],
  exerciseId: string,
): LastSessionBanner | null {
  const completed = sessions
    .filter((s) => s.exerciseId === exerciseId && s.status === 'completed')
    .sort((a, b) => b.startTime - a.startTime);

  if (completed.length === 0) return null;

  const latest = completed[0];
  const workingSets = getWorkingSets(latest);
  if (workingSets.length === 0) return null;

  const weight = getMaxWorkingWeight(latest);
  const velocity = computeWorkingMeanVelocity(latest);
  const sets = workingSets.length;
  const reps = workingSets.reduce((sum, s) => sum + s.reps.length, 0);

  return {
    exerciseId: latest.exerciseId,
    exerciseName: latest.exerciseName ?? latest.exerciseId,
    date: latest.startTime,
    weight,
    velocity: round2(velocity),
    sets,
    reps,
  };
}

/**
 * Compute progression data from session history for an exercise.
 * Uses the two most recent completed sessions.
 * Returns null if fewer than two sessions exist.
 */
export function computeProgressionFromHistory(
  sessions: StoredExerciseSession[],
  exerciseId: string,
): ExerciseProgression | null {
  const completed = sessions
    .filter((s) => s.exerciseId === exerciseId && s.status === 'completed')
    .sort((a, b) => b.startTime - a.startTime);

  if (completed.length < 2) return null;

  return computeExerciseProgression(completed[0], completed[1]);
}

/** Get the max weight across working sets. */
function getMaxWorkingWeight(session: StoredExerciseSession): number {
  const workingSets = getWorkingSets(session);
  return workingSets.reduce((max, s) => Math.max(max, s.weight), 0);
}
