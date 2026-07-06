/**
 * Training Log Service
 *
 * Pure data transformations for calendar and volume tracking views.
 * Groups sessions by date, computes weekly volume per muscle group,
 * and compares against MEV/MAV/MRV landmarks.
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import type { MuscleGroup } from '@/domain/exercise/types';
import { EXERCISE_MUSCLE_GROUPS } from '@/domain/exercise/mappings';
import { VOLUME_LANDMARKS, type TrainingLevel } from '@/domain/planning/types';

/** A day with one or more workouts. */
export interface WorkoutDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  sessions: StoredExerciseSession[];
  totalSets: number;
  totalVolume: number;
}

/** Volume for a single muscle group over a time range. */
export interface MuscleGroupVolume {
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  volume: number;
}

/** Weekly volume summary with landmark comparisons. */
export interface WeeklyVolumeSummary {
  weekStart: string;
  weekEnd: string;
  muscleVolumes: MuscleGroupVolume[];
  totalSets: number;
  totalVolume: number;
}

/** Volume with landmark context for a single muscle group. */
export interface VolumeLandmarkComparison {
  muscleGroup: MuscleGroup;
  sets: number;
  mev: number;
  mav: number;
  mrv: number;
  status: 'below_mev' | 'at_mev' | 'optimal' | 'at_mrv' | 'over_mrv';
}

/**
 * Convert a timestamp to ISO date string (YYYY-MM-DD).
 */
export function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Group sessions by date, sorted most recent first.
 */
export function groupSessionsByDate(sessions: StoredExerciseSession[]): Map<string, WorkoutDay> {
  const dayMap = new Map<string, WorkoutDay>();

  for (const session of sessions) {
    const dateKey = toDateKey(session.startTime);
    const existing = dayMap.get(dateKey);

    const sessionSets = session.completedSets.length;
    const sessionVolume = session.completedSets.reduce(
      (sum, s) => sum + s.weight * s.reps.length,
      0
    );

    if (existing) {
      existing.sessions.push(session);
      existing.totalSets += sessionSets;
      existing.totalVolume += sessionVolume;
    } else {
      dayMap.set(dateKey, {
        date: dateKey,
        sessions: [session],
        totalSets: sessionSets,
        totalVolume: sessionVolume,
      });
    }
  }

  return dayMap;
}

/**
 * Get the set of dates that have workouts (for calendar dot markers).
 */
export function getWorkoutDates(sessions: StoredExerciseSession[]): Set<string> {
  const dates = new Set<string>();
  for (const session of sessions) {
    dates.add(toDateKey(session.startTime));
  }
  return dates;
}

/**
 * Get the start of the week (Monday) for a given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Shift so Monday = 0
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute volume per muscle group from a set of sessions.
 */
export function computeMuscleGroupVolumes(sessions: StoredExerciseSession[]): MuscleGroupVolume[] {
  const volumeMap = new Map<MuscleGroup, { sets: number; reps: number; volume: number }>();

  for (const session of sessions) {
    const muscleGroup = EXERCISE_MUSCLE_GROUPS[session.exerciseId];
    if (!muscleGroup) continue;

    const existing = volumeMap.get(muscleGroup) ?? { sets: 0, reps: 0, volume: 0 };

    for (const set of session.completedSets) {
      existing.sets += 1;
      existing.reps += set.reps.length;
      existing.volume += set.weight * set.reps.length;
    }

    volumeMap.set(muscleGroup, existing);
  }

  return Array.from(volumeMap.entries())
    .map(([muscleGroup, data]) => ({ muscleGroup, ...data }))
    .sort((a, b) => b.sets - a.sets);
}

/**
 * Compute weekly volume summary for a given week.
 */
export function computeWeeklyVolume(
  sessions: StoredExerciseSession[],
  weekStartDate: Date
): WeeklyVolumeSummary {
  const weekStart = getWeekStart(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const startTs = weekStart.getTime();
  const endTs = weekEnd.getTime();

  const weekSessions = sessions.filter((s) => s.startTime >= startTs && s.startTime < endTs);

  const muscleVolumes = computeMuscleGroupVolumes(weekSessions);
  const totalSets = muscleVolumes.reduce((sum, mv) => sum + mv.sets, 0);
  const totalVolume = muscleVolumes.reduce((sum, mv) => sum + mv.volume, 0);

  return {
    weekStart: toDateKey(startTs),
    weekEnd: toDateKey(endTs),
    muscleVolumes,
    totalSets,
    totalVolume,
  };
}

/**
 * Compare weekly muscle group volumes against MEV/MAV/MRV landmarks.
 */
export function compareVolumeLandmarks(
  muscleVolumes: MuscleGroupVolume[],
  level: TrainingLevel
): VolumeLandmarkComparison[] {
  const landmarks = VOLUME_LANDMARKS[level];

  return muscleVolumes.map(({ muscleGroup, sets }) => {
    let status: VolumeLandmarkComparison['status'];
    if (sets > landmarks.mrv) {
      status = 'over_mrv';
    } else if (sets >= landmarks.mrv) {
      status = 'at_mrv';
    } else if (sets >= landmarks.mev && sets <= landmarks.mav) {
      status = 'optimal';
    } else if (sets >= landmarks.mev) {
      status = 'optimal';
    } else if (sets > 0) {
      status = 'below_mev';
    } else {
      status = 'below_mev';
    }

    return {
      muscleGroup,
      sets,
      mev: landmarks.mev,
      mav: landmarks.mav,
      mrv: landmarks.mrv,
      status,
    };
  });
}

/**
 * Generate calendar days for a given month.
 * Returns an array of 42 days (6 weeks) starting from the Monday
 * before or on the first of the month.
 */
export function getCalendarDays(year: number, month: number): string[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = getWeekStart(firstOfMonth);

  const days: string[] = [];
  const current = new Date(startDay);

  for (let i = 0; i < 42; i++) {
    days.push(toDateKey(current.getTime()));
    current.setDate(current.getDate() + 1);
  }

  return days;
}
