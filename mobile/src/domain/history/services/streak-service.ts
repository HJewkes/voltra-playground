/**
 * Streak Service
 *
 * Computes training consistency metrics from session history:
 * current streak, longest streak, and weekly consistency score.
 *
 * Streak rules:
 * - A "training day" = any day with at least one completed session.
 * - Consecutive training days are counted as a streak.
 * - A single rest day between two training days does NOT break the streak
 *   (to accommodate weekly training patterns like Mon/Wed/Fri).
 * - Weekly consistency = sessions this week / weeklyTarget (default 4).
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import { toDateKey, getWeekStart } from './training-log-service';

// =============================================================================
// Types
// =============================================================================

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  /** 0–100 percentage of weeklyTarget sessions completed this week. Capped at 100. */
  weeklyConsistency: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the set of unique training day keys (YYYY-MM-DD) from completed sessions.
 */
function getTrainingDays(sessions: StoredExerciseSession[]): Set<string> {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.status === 'completed') {
      days.add(toDateKey(session.startTime));
    }
  }
  return days;
}

/**
 * Parse a YYYY-MM-DD key to a Date at midnight local time.
 */
function parseDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Advance a Date by N calendar days (mutates in place, returns it).
 */
function addDays(date: Date, n: number): Date {
  date.setDate(date.getDate() + n);
  return date;
}

/**
 * Format a Date to a YYYY-MM-DD key using local time.
 */
function formatDate(date: Date): string {
  return toDateKey(date.getTime());
}

// =============================================================================
// Core computation
// =============================================================================

/**
 * Compute streak metrics from a list of sessions.
 *
 * Streak algorithm:
 * Walk backwards from today. If today or yesterday was a training day,
 * the streak is alive. A single rest-day gap is allowed between training days
 * so that e.g. Mon–Wed–Fri counts as a 3-day streak not three separate streaks.
 */
export function computeStreak(
  sessions: StoredExerciseSession[],
  weeklyTarget: number = 4
): StreakResult {
  const trainingDays = getTrainingDays(sessions);

  if (trainingDays.size === 0) {
    return { currentStreak: 0, longestStreak: 0, weeklyConsistency: 0 };
  }

  const sortedDays = Array.from(trainingDays).sort();
  const { currentStreak, longestStreak } = computeStreakLengths(sortedDays);
  const weeklyConsistency = computeWeeklyConsistency(sessions, weeklyTarget);

  return { currentStreak, longestStreak, weeklyConsistency };
}

/**
 * Walk the sorted day list to compute current and longest streaks.
 * A gap of 1 rest day between training days is tolerated.
 */
function computeStreakLengths(sortedDays: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  const today = formatDate(new Date());
  const yesterday = formatDate(addDays(new Date(), -1));

  // Current streak: start from the most recent day and walk back.
  // Only start counting if the last training day is today or yesterday.
  const lastDay = sortedDays[sortedDays.length - 1];
  const isActive = lastDay === today || lastDay === yesterday;
  const currentStreak = isActive ? countStreakBackFrom(sortedDays, sortedDays.length - 1) : 0;

  // Longest streak: sweep through all days.
  const longestStreak = computeLongestStreak(sortedDays);

  return { currentStreak, longestStreak };
}

/**
 * Count the streak length ending at index `endIdx` by walking backwards.
 * Allows a single-day rest gap between consecutive training days.
 */
function countStreakBackFrom(sortedDays: string[], endIdx: number): number {
  let count = 1;
  let prevDate = parseDate(sortedDays[endIdx]);

  for (let i = endIdx - 1; i >= 0; i--) {
    const currDate = parseDate(sortedDays[i]);
    const gap = daysBetween(currDate, prevDate);

    // Gap of 1 = consecutive days, gap of 2 = one rest day allowed.
    if (gap <= 2) {
      count++;
      prevDate = currDate;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Sweep through all sorted training days to find the longest streak.
 */
function computeLongestStreak(sortedDays: string[]): number {
  if (sortedDays.length === 0) return 0;

  let longest = 1;
  let current = 1;
  let prevDate = parseDate(sortedDays[0]);

  for (let i = 1; i < sortedDays.length; i++) {
    const currDate = parseDate(sortedDays[i]);
    const gap = daysBetween(prevDate, currDate);

    if (gap <= 2) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }

    prevDate = currDate;
  }

  return longest;
}

/**
 * Number of calendar days between two dates (positive if b > a).
 */
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const aMs = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMs = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.round((bMs - aMs) / MS_PER_DAY));
}

/**
 * Compute weekly consistency as a 0–100 percentage.
 * Uses the current calendar week (Monday–Sunday).
 */
function computeWeeklyConsistency(sessions: StoredExerciseSession[], weeklyTarget: number): number {
  if (weeklyTarget <= 0) return 0;

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = addDays(new Date(weekStart), 7);

  const startTs = weekStart.getTime();
  const endTs = weekEnd.getTime();

  const sessionCount = sessions.filter(
    (s) => s.status === 'completed' && s.startTime >= startTs && s.startTime < endTs
  ).length;

  return Math.min(100, Math.round((sessionCount / weeklyTarget) * 100));
}
