/**
 * Session History Service
 *
 * Bridges the storage layer (StoredExerciseSession) with domain services
 * (personal records, aggregate stats). Converts stored sessions to domain
 * types and computes derived analytics.
 */

import type {
  StoredExerciseSession,
  StoredSessionSet,
  ExerciseSessionSummary,
} from '@/data/exercise-session';
import { toExerciseSessionSummary } from '@/data/exercise-session';
import type { PersonalRecord } from '../models';
import type { AggregateStats } from './stats-service';

// =============================================================================
// Types
// =============================================================================

/**
 * Exercise group for grouping sessions by exercise.
 */
export interface ExerciseHistoryGroup {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number;
  lastSessionDate: number;
  totalSets: number;
  totalReps: number;
}

/**
 * PR display data derived from stored session sets.
 */
export interface StoredPersonalRecord {
  type: PersonalRecord['type'];
  value: number;
  weight: number;
  reps?: number;
  date: number;
  sessionId: string;
  exerciseName: string;
}

// =============================================================================
// Aggregate Stats
// =============================================================================

/**
 * Compute aggregate stats directly from stored sessions.
 * Avoids domain conversion overhead for summary displays.
 */
export function computeStoredAggregateStats(sessions: StoredExerciseSession[]): AggregateStats {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const session of sessions) {
    totalSets += session.completedSets.length;
    for (const set of session.completedSets) {
      totalReps += set.reps.length;
      totalVolume += set.weight * set.reps.length;
    }
  }

  return { totalSets, totalReps, totalVolume };
}

// =============================================================================
// Personal Records
// =============================================================================

/**
 * Compute personal records directly from stored sessions.
 * Works with StoredSessionSet to avoid expensive domain conversion.
 */
export function computeStoredPersonalRecords(
  sessions: StoredExerciseSession[]
): StoredPersonalRecord[] {
  if (sessions.length === 0) return [];

  const allSets: { set: StoredSessionSet; session: StoredExerciseSession }[] = [];
  for (const session of sessions) {
    for (const set of session.completedSets) {
      allSets.push({ set, session });
    }
  }

  if (allSets.length === 0) return [];

  const records: StoredPersonalRecord[] = [];

  let maxWeight = allSets[0];
  let maxReps = allSets[0];
  let maxVelocity = allSets[0];
  let maxVolume = allSets[0];
  let maxVolumeValue = allSets[0].set.weight * allSets[0].set.reps.length;

  for (const entry of allSets) {
    if (entry.set.weight > maxWeight.set.weight) {
      maxWeight = entry;
    }
    if (entry.set.reps.length > maxReps.set.reps.length) {
      maxReps = entry;
    }
    if (entry.set.meanVelocity > maxVelocity.set.meanVelocity) {
      maxVelocity = entry;
    }
    const volume = entry.set.weight * entry.set.reps.length;
    if (volume > maxVolumeValue) {
      maxVolume = entry;
      maxVolumeValue = volume;
    }
  }

  records.push({
    type: 'max_weight',
    value: maxWeight.set.weight,
    weight: maxWeight.set.weight,
    reps: maxWeight.set.reps.length,
    date: maxWeight.set.startTime,
    sessionId: maxWeight.session.id,
    exerciseName: maxWeight.session.exerciseName ?? 'Exercise',
  });

  records.push({
    type: 'max_reps',
    value: maxReps.set.reps.length,
    weight: maxReps.set.weight,
    reps: maxReps.set.reps.length,
    date: maxReps.set.startTime,
    sessionId: maxReps.session.id,
    exerciseName: maxReps.session.exerciseName ?? 'Exercise',
  });

  records.push({
    type: 'max_velocity',
    value: maxVelocity.set.meanVelocity,
    weight: maxVelocity.set.weight,
    date: maxVelocity.set.startTime,
    sessionId: maxVelocity.session.id,
    exerciseName: maxVelocity.session.exerciseName ?? 'Exercise',
  });

  records.push({
    type: 'max_volume',
    value: maxVolumeValue,
    weight: maxVolume.set.weight,
    reps: maxVolume.set.reps.length,
    date: maxVolume.set.startTime,
    sessionId: maxVolume.session.id,
    exerciseName: maxVolume.session.exerciseName ?? 'Exercise',
  });

  return records;
}

// =============================================================================
// Grouping
// =============================================================================

/**
 * Group sessions by exercise for exercise-level history view.
 */
export function groupSessionsByExercise(
  sessions: StoredExerciseSession[]
): ExerciseHistoryGroup[] {
  const groups = new Map<string, ExerciseHistoryGroup>();

  for (const session of sessions) {
    const existing = groups.get(session.exerciseId);
    const totalReps = session.completedSets.reduce(
      (sum, s) => sum + s.reps.length,
      0
    );

    if (existing) {
      existing.sessionCount++;
      existing.totalSets += session.completedSets.length;
      existing.totalReps += totalReps;
      if (session.startTime > existing.lastSessionDate) {
        existing.lastSessionDate = session.startTime;
      }
    } else {
      groups.set(session.exerciseId, {
        exerciseId: session.exerciseId,
        exerciseName: session.exerciseName ?? session.exerciseId,
        sessionCount: 1,
        lastSessionDate: session.startTime,
        totalSets: session.completedSets.length,
        totalReps,
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.lastSessionDate - a.lastSessionDate
  );
}

// =============================================================================
// Summaries
// =============================================================================

/**
 * Get session summaries from stored sessions.
 */
export function getSessionSummaries(
  sessions: StoredExerciseSession[]
): ExerciseSessionSummary[] {
  return sessions.map(toExerciseSessionSummary);
}

// =============================================================================
// Trends
// =============================================================================

/**
 * Velocity trend data point for charting.
 */
export interface VelocityTrendPoint {
  date: number;
  weight: number;
  meanVelocity: number;
  setIndex: number;
}

/**
 * Compute velocity trend data from sessions for a given exercise.
 * Returns chronological data points for plotting.
 */
export function computeVelocityTrend(
  sessions: StoredExerciseSession[],
  exerciseId: string
): VelocityTrendPoint[] {
  const exerciseSessions = sessions
    .filter((s) => s.exerciseId === exerciseId && s.status === 'completed')
    .sort((a, b) => a.startTime - b.startTime);

  const points: VelocityTrendPoint[] = [];
  for (const session of exerciseSessions) {
    for (const set of session.completedSets) {
      if (set.reps.length > 0) {
        points.push({
          date: set.startTime,
          weight: set.weight,
          meanVelocity: set.meanVelocity,
          setIndex: set.setIndex,
        });
      }
    }
  }

  return points;
}

/**
 * Volume trend data point for charting.
 */
export interface VolumeTrendPoint {
  date: number;
  totalVolume: number;
  totalReps: number;
  setCount: number;
}

/**
 * Compute per-session volume trend data.
 */
export function computeVolumeTrend(
  sessions: StoredExerciseSession[]
): VolumeTrendPoint[] {
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.startTime - b.startTime);

  return completed.map((session) => {
    let totalVolume = 0;
    let totalReps = 0;
    for (const set of session.completedSets) {
      totalReps += set.reps.length;
      totalVolume += set.weight * set.reps.length;
    }
    return {
      date: session.startTime,
      totalVolume,
      totalReps,
      setCount: session.completedSets.length,
    };
  });
}
