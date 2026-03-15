/**
 * Streak Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateStoredSession } from '@/__fixtures__/generators/session-generator';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computeStreak } from '../streak-service';

// =============================================================================
// Helpers
// =============================================================================

function makeSession(
  daysAgo: number,
  overrides: Partial<StoredExerciseSession> = {}
): StoredExerciseSession {
  const ts = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return {
    ...generateStoredSession(),
    status: 'completed',
    startTime: ts,
    ...overrides,
  };
}

// =============================================================================
// computeStreak — empty / no data
// =============================================================================

describe('computeStreak — empty input', () => {
  it('returns zeros for empty sessions', () => {
    expect(computeStreak([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      weeklyConsistency: 0,
    });
  });

  it('ignores non-completed sessions', () => {
    const sessions = [makeSession(0, { status: 'abandoned' }), makeSession(1, { status: 'in_progress' })];
    expect(computeStreak(sessions)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      weeklyConsistency: 0,
    });
  });
});

// =============================================================================
// computeStreak — currentStreak
// =============================================================================

describe('computeStreak — currentStreak', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns 1 for a session today', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(0)];
    expect(computeStreak(sessions).currentStreak).toBe(1);
  });

  it('returns 1 for a session yesterday (streak still active)', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(1)];
    expect(computeStreak(sessions).currentStreak).toBe(1);
  });

  it('returns 0 when last session was 2 days ago (gap too large without prior day)', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(2)];
    // Gap from 2 days ago to today is 2 days — no training yesterday, streak broken
    expect(computeStreak(sessions).currentStreak).toBe(0);
  });

  it('counts consecutive daily sessions correctly', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(0), makeSession(1), makeSession(2)];
    expect(computeStreak(sessions).currentStreak).toBe(3);
  });

  it('allows a single rest day gap within the streak', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    // Trained today, 2 days ago, 4 days ago — each pair has a 1-day rest gap
    const sessions = [makeSession(0), makeSession(2), makeSession(4)];
    expect(computeStreak(sessions).currentStreak).toBe(3);
  });

  it('breaks streak when gap exceeds 1 rest day', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    // Trained today and yesterday, but 5 days ago (gap of 3+ days)
    const sessions = [makeSession(0), makeSession(1), makeSession(5)];
    expect(computeStreak(sessions).currentStreak).toBe(2);
  });

  it('handles multiple sessions on the same day as a single training day', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(0), makeSession(0), makeSession(1)];
    expect(computeStreak(sessions).currentStreak).toBe(2);
  });
});

// =============================================================================
// computeStreak — longestStreak
// =============================================================================

describe('computeStreak — longestStreak', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('equals currentStreak when no longer past streak exists', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(0), makeSession(1), makeSession(2)];
    const result = computeStreak(sessions);
    expect(result.longestStreak).toBe(result.currentStreak);
  });

  it('finds a past streak longer than the current one', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    // Long past streak: 10, 11, 12, 13, 14 days ago (5 days, no gaps)
    // Current streak: just today (1 day)
    const pastStreak = [makeSession(10), makeSession(11), makeSession(12), makeSession(13), makeSession(14)];
    const sessions = [makeSession(0), ...pastStreak];
    const result = computeStreak(sessions);
    expect(result.longestStreak).toBe(5);
    expect(result.currentStreak).toBe(1);
  });

  it('returns 1 for a single session', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    expect(computeStreak([makeSession(0)]).longestStreak).toBe(1);
  });
});

// =============================================================================
// computeStreak — weeklyConsistency
// =============================================================================

describe('computeStreak — weeklyConsistency', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns 0 with no sessions this week', () => {
    // Set time to Wednesday; put all sessions last week
    vi.setSystemTime(new Date('2026-03-11T12:00:00')); // Wednesday
    const sessions = [makeSession(7), makeSession(8)];
    expect(computeStreak(sessions).weeklyConsistency).toBe(0);
  });

  it('returns 25 for 1 session against target of 4', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00')); // Saturday
    const sessions = [makeSession(0)];
    expect(computeStreak(sessions, 4).weeklyConsistency).toBe(25);
  });

  it('returns 100 when target is met', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00')); // Saturday
    // 4 sessions this week (Sat, Fri, Thu, Wed = 0, 1, 2, 3 days ago)
    const sessions = [makeSession(0), makeSession(1), makeSession(2), makeSession(3)];
    expect(computeStreak(sessions, 4).weeklyConsistency).toBe(100);
  });

  it('caps at 100 even when exceeding target', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [
      makeSession(0), makeSession(1), makeSession(2),
      makeSession(3), makeSession(4), makeSession(5),
    ];
    expect(computeStreak(sessions, 4).weeklyConsistency).toBe(100);
  });

  it('uses a custom weeklyTarget', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00'));
    const sessions = [makeSession(0), makeSession(1)];
    // 2 sessions / target 2 = 100%
    expect(computeStreak(sessions, 2).weeklyConsistency).toBe(100);
  });
});
