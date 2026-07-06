/**
 * Cross-Session Analytics Service
 *
 * Pure functions for computing analytics across multiple workout sessions.
 * Provides volume trends, training load estimation, exercise frequency,
 * and muscle group distribution from stored session data.
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import type { MuscleGroup } from '@/domain/exercise/types';
import { EXERCISE_MUSCLE_GROUPS } from '@/domain/exercise/mappings';
import { toDateKey, getWeekStart } from './training-log-service';

// =============================================================================
// Types
// =============================================================================

export type TimeRange = 'weekly' | 'monthly';

/** Aggregated volume for a time bucket (week or month). */
export interface VolumeBucket {
  label: string;
  startDate: number;
  totalVolume: number;
  totalReps: number;
  totalSets: number;
  sessionCount: number;
}

/** Muscle group distribution entry. */
export interface MuscleGroupShare {
  muscleGroup: MuscleGroup;
  sets: number;
  volume: number;
  percentage: number;
}

/** Exercise frequency entry. */
export interface ExerciseFrequency {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number;
  lastSessionDate: number;
  avgSetsPerSession: number;
}

/** Training load for ACWR calculation. */
export interface TrainingLoad {
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  status: 'undertraining' | 'optimal' | 'caution' | 'danger';
}

/** PR timeline entry showing when a record was set. */
export interface PRTimelineEntry {
  type: 'max_weight' | 'max_reps' | 'max_velocity' | 'max_volume';
  value: number;
  date: number;
  exerciseName: string;
}

// =============================================================================
// Volume Trends
// =============================================================================

/**
 * Get the Monday-based ISO week label (e.g. "Jan 6").
 */
function getWeekLabel(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get month label (e.g. "Jan 2026").
 */
function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Get the Monday-based week key for grouping.
 */
function getWeekKey(timestamp: number): string {
  const weekStart = getWeekStart(new Date(timestamp));
  return toDateKey(weekStart.getTime());
}

/**
 * Get month key for grouping (YYYY-MM).
 */
function getMonthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute session volume (weight x reps summed across all sets).
 */
function computeSessionVolume(session: StoredExerciseSession): {
  volume: number;
  reps: number;
  sets: number;
} {
  let volume = 0;
  let reps = 0;
  for (const set of session.completedSets) {
    reps += set.reps.length;
    volume += set.weight * set.reps.length;
  }
  return { volume, reps, sets: session.completedSets.length };
}

/**
 * Compute volume trends aggregated by time range.
 * Returns buckets sorted chronologically, limited to the most recent entries.
 */
export function computeVolumeBuckets(
  sessions: StoredExerciseSession[],
  range: TimeRange,
  maxBuckets: number = 12
): VolumeBucket[] {
  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) return [];

  const bucketMap = new Map<string, VolumeBucket>();

  for (const session of completed) {
    const key = range === 'weekly' ? getWeekKey(session.startTime) : getMonthKey(session.startTime);

    const { volume, reps, sets } = computeSessionVolume(session);
    const existing = bucketMap.get(key);

    if (existing) {
      existing.totalVolume += volume;
      existing.totalReps += reps;
      existing.totalSets += sets;
      existing.sessionCount += 1;
    } else {
      const date = new Date(session.startTime);
      bucketMap.set(key, {
        label: range === 'weekly' ? getWeekLabel(date) : getMonthLabel(date),
        startDate: session.startTime,
        totalVolume: volume,
        totalReps: reps,
        totalSets: sets,
        sessionCount: 1,
      });
    }
  }

  return Array.from(bucketMap.values())
    .sort((a, b) => a.startDate - b.startDate)
    .slice(-maxBuckets);
}

// =============================================================================
// Muscle Group Distribution
// =============================================================================

/**
 * Compute muscle group distribution as percentages.
 */
export function computeMuscleGroupDistribution(
  sessions: StoredExerciseSession[]
): MuscleGroupShare[] {
  const completed = sessions.filter((s) => s.status === 'completed');
  const groupMap = new Map<MuscleGroup, { sets: number; volume: number }>();

  let totalSets = 0;

  for (const session of completed) {
    const muscleGroup = EXERCISE_MUSCLE_GROUPS[session.exerciseId];
    if (!muscleGroup) continue;

    const existing = groupMap.get(muscleGroup) ?? { sets: 0, volume: 0 };
    for (const set of session.completedSets) {
      existing.sets += 1;
      existing.volume += set.weight * set.reps.length;
      totalSets += 1;
    }
    groupMap.set(muscleGroup, existing);
  }

  if (totalSets === 0) return [];

  return Array.from(groupMap.entries())
    .map(([muscleGroup, data]) => ({
      muscleGroup,
      sets: data.sets,
      volume: data.volume,
      percentage: Math.round((data.sets / totalSets) * 100),
    }))
    .sort((a, b) => b.sets - a.sets);
}

// =============================================================================
// Exercise Frequency
// =============================================================================

/**
 * Compute exercise frequency ranked by session count.
 */
export function computeExerciseFrequency(
  sessions: StoredExerciseSession[],
  limit: number = 10
): ExerciseFrequency[] {
  const completed = sessions.filter((s) => s.status === 'completed');
  const freqMap = new Map<
    string,
    { name: string; count: number; totalSets: number; lastDate: number }
  >();

  for (const session of completed) {
    const existing = freqMap.get(session.exerciseId);
    if (existing) {
      existing.count += 1;
      existing.totalSets += session.completedSets.length;
      if (session.startTime > existing.lastDate) {
        existing.lastDate = session.startTime;
      }
    } else {
      freqMap.set(session.exerciseId, {
        name: session.exerciseName ?? session.exerciseId,
        count: 1,
        totalSets: session.completedSets.length,
        lastDate: session.startTime,
      });
    }
  }

  return Array.from(freqMap.entries())
    .map(([exerciseId, data]) => ({
      exerciseId,
      exerciseName: data.name,
      sessionCount: data.count,
      lastSessionDate: data.lastDate,
      avgSetsPerSession: data.count > 0 ? Math.round((data.totalSets / data.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, limit);
}

// =============================================================================
// Training Load (ACWR)
// =============================================================================

/**
 * Compute weekly load (total volume) for a given week.
 */
function computeWeekLoad(sessions: StoredExerciseSession[], weekStart: Date): number {
  const startTs = weekStart.getTime();
  const endTs = startTs + 7 * 24 * 60 * 60 * 1000;

  let load = 0;
  for (const session of sessions) {
    if (session.startTime >= startTs && session.startTime < endTs) {
      load += computeSessionVolume(session).volume;
    }
  }
  return load;
}

/**
 * Compute training load using Acute:Chronic Workload Ratio.
 * Acute = last 1 week volume, Chronic = average of last 4 weeks.
 */
export function computeTrainingLoad(sessions: StoredExerciseSession[]): TrainingLoad {
  const completed = sessions.filter((s) => s.status === 'completed');
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  const acuteLoad = computeWeekLoad(completed, currentWeekStart);

  let chronicTotal = 0;
  for (let i = 1; i <= 4; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    chronicTotal += computeWeekLoad(completed, weekStart);
  }
  const chronicLoad = chronicTotal / 4;

  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  let status: TrainingLoad['status'];
  if (acwr < 0.8) {
    status = 'undertraining';
  } else if (acwr <= 1.3) {
    status = 'optimal';
  } else if (acwr <= 1.5) {
    status = 'caution';
  } else {
    status = 'danger';
  }

  return { acuteLoad, chronicLoad, acwr, status };
}

// =============================================================================
// PR Timeline
// =============================================================================

/**
 * Compute a timeline of personal records being set over time.
 * Scans sessions chronologically and records when a new max is achieved.
 */
export function computePRTimeline(sessions: StoredExerciseSession[]): PRTimelineEntry[] {
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.startTime - b.startTime);

  const timeline: PRTimelineEntry[] = [];
  let maxWeight = -Infinity;
  let maxReps = -Infinity;
  let maxVelocity = -Infinity;
  let maxVolume = -Infinity;

  for (const session of completed) {
    const name = session.exerciseName ?? 'Exercise';

    for (const set of session.completedSets) {
      if (set.weight > maxWeight) {
        maxWeight = set.weight;
        timeline.push({
          type: 'max_weight',
          value: set.weight,
          date: set.startTime,
          exerciseName: name,
        });
      }

      if (set.reps.length > maxReps) {
        maxReps = set.reps.length;
        timeline.push({
          type: 'max_reps',
          value: set.reps.length,
          date: set.startTime,
          exerciseName: name,
        });
      }

      if (set.meanVelocity > maxVelocity) {
        maxVelocity = set.meanVelocity;
        timeline.push({
          type: 'max_velocity',
          value: set.meanVelocity,
          date: set.startTime,
          exerciseName: name,
        });
      }

      const volume = set.weight * set.reps.length;
      if (volume > maxVolume) {
        maxVolume = volume;
        timeline.push({
          type: 'max_volume',
          value: volume,
          date: set.startTime,
          exerciseName: name,
        });
      }
    }
  }

  return timeline;
}
