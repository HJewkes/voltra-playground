/**
 * Cross-Session Analytics Service
 *
 * Aggregates workout history across sessions for volume trends,
 * personal record timelines, muscle group distribution, exercise
 * frequency, and training load estimation.
 *
 * All functions are pure — they take CompletedSet arrays and return
 * derived analytics. No side effects, no storage.
 */

import type { CompletedSet } from '@/domain/workout';
import type { MuscleGroup } from '@/domain/exercise/types';
import { getExercise } from '@/domain/exercise/catalog';
import { getSetPeakVelocity } from '@voltras/workout-analytics';

// =============================================================================
// Types
// =============================================================================

export type TrendPeriod = 'week' | 'month';

export interface PeriodVolume {
  /** ISO period label (e.g. "2026-W11" or "2026-03") */
  period: string;
  /** Start timestamp of the period (ms) */
  periodStart: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
}

export interface PersonalRecordEntry {
  type: 'weight' | 'velocity' | 'volume';
  value: number;
  weight: number;
  reps?: number;
  date: number;
  setId: string;
}

export interface MuscleGroupShare {
  muscleGroup: MuscleGroup;
  volume: number;
  percentage: number;
}

export interface ExerciseFrequencyEntry {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number;
  totalSets: number;
  totalReps: number;
}

export interface TrainingLoadEstimate {
  acuteLoad: number;
  chronicLoad: number;
  ratio: number;
  zone: 'undertraining' | 'optimal' | 'overreaching' | 'danger';
}

export interface DateRange {
  start: number;
  end: number;
}

// =============================================================================
// Period Helpers
// =============================================================================

function getISOWeekLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + jan4.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getMonthLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodLabel(timestamp: number, period: TrendPeriod): string {
  return period === 'week' ? getISOWeekLabel(timestamp) : getMonthLabel(timestamp);
}

function getPeriodStart(timestamp: number, period: TrendPeriod): number {
  const date = new Date(timestamp);
  if (period === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
  return monday.getTime();
}

function filterByDateRange(sets: readonly CompletedSet[], range?: DateRange): CompletedSet[] {
  if (!range) return [...sets];
  return sets.filter((s) => s.timestamp.start >= range.start && s.timestamp.start <= range.end);
}

// =============================================================================
// Volume Trends
// =============================================================================

/**
 * Aggregate volume by period (week or month).
 * Returns periods sorted chronologically.
 */
export function volumeTrendByPeriod(
  sets: readonly CompletedSet[],
  period: TrendPeriod,
): PeriodVolume[] {
  if (sets.length === 0) return [];

  const buckets = new Map<string, PeriodVolume>();

  for (const set of sets) {
    const label = getPeriodLabel(set.timestamp.start, period);

    let bucket = buckets.get(label);
    if (!bucket) {
      bucket = {
        period: label,
        periodStart: getPeriodStart(set.timestamp.start, period),
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
      };
      buckets.set(label, bucket);
    }

    const reps = set.data.reps.length;
    bucket.totalSets += 1;
    bucket.totalReps += reps;
    bucket.totalVolume += set.weight * reps;
  }

  return [...buckets.values()].sort((a, b) => a.periodStart - b.periodStart);
}

// =============================================================================
// Personal Record Timeline
// =============================================================================

/**
 * Build a chronological timeline of PR progressions for an exercise.
 * Returns only the moments a new record was set, sorted by date.
 */
export function personalRecordTimeline(
  sets: readonly CompletedSet[],
  exerciseId: string,
): PersonalRecordEntry[] {
  const exerciseSets = sets
    .filter((s) => s.exerciseId === exerciseId && s.data.reps.length > 0)
    .sort((a, b) => a.timestamp.start - b.timestamp.start);

  if (exerciseSets.length === 0) return [];

  const records: PersonalRecordEntry[] = [];
  let maxWeight = -Infinity;
  let maxVelocity = -Infinity;
  let maxVolume = -Infinity;

  for (const set of exerciseSets) {
    const reps = set.data.reps.length;
    const volume = set.weight * reps;
    const peakVel = getSetPeakVelocity(set.data);

    if (set.weight > maxWeight) {
      maxWeight = set.weight;
      records.push({
        type: 'weight',
        value: set.weight,
        weight: set.weight,
        reps,
        date: set.timestamp.start,
        setId: set.id,
      });
    }

    if (peakVel > maxVelocity) {
      maxVelocity = peakVel;
      records.push({
        type: 'velocity',
        value: peakVel,
        weight: set.weight,
        date: set.timestamp.start,
        setId: set.id,
      });
    }

    if (volume > maxVolume) {
      maxVolume = volume;
      records.push({
        type: 'volume',
        value: volume,
        weight: set.weight,
        reps,
        date: set.timestamp.start,
        setId: set.id,
      });
    }
  }

  return records.sort((a, b) => a.date - b.date);
}

// =============================================================================
// Muscle Group Distribution
// =============================================================================

/**
 * Compute volume distribution across muscle groups.
 * Volume is split evenly across an exercise's muscle groups.
 * Returns entries sorted by percentage descending.
 */
export function muscleGroupDistribution(
  sets: readonly CompletedSet[],
  dateRange?: DateRange,
): MuscleGroupShare[] {
  const filtered = filterByDateRange(sets, dateRange);
  if (filtered.length === 0) return [];

  const volumeByGroup = new Map<MuscleGroup, number>();

  for (const set of filtered) {
    const exercise = getExercise(set.exerciseId);
    const groups = exercise?.muscleGroups ?? [];
    if (groups.length === 0) continue;

    const setVolume = set.weight * set.data.reps.length;
    const sharePerGroup = setVolume / groups.length;

    for (const group of groups) {
      volumeByGroup.set(group, (volumeByGroup.get(group) ?? 0) + sharePerGroup);
    }
  }

  const totalVolume = [...volumeByGroup.values()].reduce((sum, v) => sum + v, 0);
  if (totalVolume === 0) return [];

  return [...volumeByGroup.entries()]
    .map(([muscleGroup, volume]) => ({
      muscleGroup,
      volume,
      percentage: (volume / totalVolume) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// =============================================================================
// Exercise Frequency
// =============================================================================

/**
 * Compute how often each exercise is performed.
 * Groups sets into sessions by exercise + day, then counts distinct days.
 * Returns entries sorted by session count descending.
 */
export function exerciseFrequency(
  sets: readonly CompletedSet[],
): ExerciseFrequencyEntry[] {
  if (sets.length === 0) return [];

  const exerciseMap = new Map<
    string,
    { exerciseName: string; days: Set<string>; totalSets: number; totalReps: number }
  >();

  for (const set of sets) {
    let entry = exerciseMap.get(set.exerciseId);
    if (!entry) {
      entry = {
        exerciseName: set.exerciseName ?? set.exerciseId,
        days: new Set(),
        totalSets: 0,
        totalReps: 0,
      };
      exerciseMap.set(set.exerciseId, entry);
    }

    const dayLabel = new Date(set.timestamp.start).toISOString().slice(0, 10);
    entry.days.add(dayLabel);
    entry.totalSets += 1;
    entry.totalReps += set.data.reps.length;
  }

  return [...exerciseMap.entries()]
    .map(([exerciseId, entry]) => ({
      exerciseId,
      exerciseName: entry.exerciseName,
      sessionCount: entry.days.size,
      totalSets: entry.totalSets,
      totalReps: entry.totalReps,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

// =============================================================================
// Training Load (ACWR)
// =============================================================================

const DAY_MS = 86400000;

/**
 * Estimate training load using acute:chronic workload ratio (ACWR).
 *
 * Acute window: 7 days. Chronic window: 28 days.
 * Volume = weight x reps, averaged per day in each window.
 *
 * Zones:
 *   < 0.8  undertraining
 *   0.8-1.3 optimal
 *   1.3-1.5 overreaching
 *   > 1.5  danger
 */
export function estimateTrainingLoad(
  sets: readonly CompletedSet[],
  dateRange: DateRange,
): TrainingLoadEstimate {
  const acuteWindowDays = 7;
  const chronicWindowDays = 28;

  const acuteStart = dateRange.end - acuteWindowDays * DAY_MS;
  const chronicStart = dateRange.end - chronicWindowDays * DAY_MS;

  let acuteVolume = 0;
  let chronicVolume = 0;

  for (const set of sets) {
    const ts = set.timestamp.start;
    const vol = set.weight * set.data.reps.length;

    if (ts >= chronicStart && ts <= dateRange.end) {
      chronicVolume += vol;
    }
    if (ts >= acuteStart && ts <= dateRange.end) {
      acuteVolume += vol;
    }
  }

  const acuteLoad = acuteVolume / acuteWindowDays;
  const chronicLoad = chronicVolume / chronicWindowDays;

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  let zone: TrainingLoadEstimate['zone'];
  if (ratio < 0.8) {
    zone = 'undertraining';
  } else if (ratio <= 1.3) {
    zone = 'optimal';
  } else if (ratio <= 1.5) {
    zone = 'overreaching';
  } else {
    zone = 'danger';
  }

  return { acuteLoad, chronicLoad, ratio, zone };
}
