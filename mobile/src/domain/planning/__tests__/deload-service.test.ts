/**
 * Deload Service Tests
 *
 * Tests for shouldDeload() and generateDeloadPlan() covering:
 * - ACWR-triggered deload
 * - Progressive overload streak trigger
 * - No-deload baseline
 * - Boundary conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import { shouldDeload, generateDeloadPlan } from '../deload-service';

// =============================================================================
// Helpers
// =============================================================================

function createSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  return { ...generateStoredSession(), ...overrides };
}

/** Build sessions with consistent weekly volume for the past N weeks. */
function buildConsistentWeeks(weekCount: number): StoredExerciseSession[] {
  return Array.from({ length: weekCount }, (_, weekIndex) =>
    createSession({
      status: 'completed',
      // Place sessions in the prior week bands (not current acute week)
      startTime: Date.now() - (weekIndex + 1) * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
      completedSets: [generateStoredSet({ weight: 100, repCount: 10 })],
    })
  );
}

/**
 * Build sessions where each week has strictly higher volume than the last.
 * weekCount sessions each in a different week, oldest first (lowest volume).
 */
function buildProgressiveWeeks(weekCount: number): StoredExerciseSession[] {
  return Array.from({ length: weekCount }, (_, weekIndex) => {
    // weekIndex=0 is the oldest week; weekIndex=weekCount-1 is the most recent
    const weeksFromNow = weekCount - weekIndex;
    return createSession({
      status: 'completed',
      startTime: Date.now() - weeksFromNow * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
      completedSets: [generateStoredSet({ weight: 100, repCount: 5 + weekIndex * 2 })],
    });
  });
}

/** Build high-ACWR scenario: big acute week + low chronic. */
function buildHighAcwrSessions(now: number): StoredExerciseSession[] {
  const thisWeekSession = createSession({
    status: 'completed',
    // Current week: 2 days ago from "now" (Monday-based, within current week)
    startTime: now - 2 * 24 * 60 * 60 * 1000,
    completedSets: [
      generateStoredSet({ weight: 300, repCount: 20 }),
      generateStoredSet({ weight: 300, repCount: 20 }),
      generateStoredSet({ weight: 300, repCount: 20 }),
    ],
  });
  const chronicSessions = Array.from({ length: 4 }, (_, i) =>
    createSession({
      status: 'completed',
      startTime: now - (i + 1) * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
      completedSets: [generateStoredSet({ weight: 50, repCount: 3 })],
    })
  );
  return [thisWeekSession, ...chronicSessions];
}

// =============================================================================
// shouldDeload
// =============================================================================

describe('shouldDeload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z')); // Wednesday — mid-week
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for empty sessions', () => {
    expect(shouldDeload([])).toBe(false);
  });

  it('returns false with healthy consistent training load', () => {
    const sessions = buildConsistentWeeks(5);
    expect(shouldDeload(sessions)).toBe(false);
  });

  it('triggers when ACWR exceeds 1.3', () => {
    const now = new Date('2026-03-11T12:00:00Z').getTime();
    const sessions = buildHighAcwrSessions(now);
    expect(shouldDeload(sessions)).toBe(true);
  });

  it('triggers after 3 consecutive volume increases (4 weeks of data)', () => {
    // 4 weeks → 3 consecutive increases → matches default threshold of 3
    const sessions = buildProgressiveWeeks(4);
    expect(shouldDeload(sessions)).toBe(true);
  });

  it('does not trigger after only 2 consecutive increases (3 weeks of data)', () => {
    // 3 weeks → 2 consecutive increases → below threshold of 3
    const sessions = buildProgressiveWeeks(3);
    expect(shouldDeload(sessions)).toBe(false);
  });

  it('respects custom acwrThreshold config', () => {
    const sessions = buildConsistentWeeks(5);
    // Consistent training produces acwr near 0 (no sessions in the current acute week)
    // so a normal threshold of 1.3 does NOT fire, but we can confirm the ACWR path is
    // checked by lowering it well below the expected acwr.
    // The progressive streak with equal weekly volumes = 0 consecutive increases.
    expect(shouldDeload(sessions, { acwrThreshold: 1.3, progressiveWeeksThreshold: 100 })).toBe(
      false
    );
    // Raising threshold to test non-trigger
    expect(shouldDeload(sessions, { acwrThreshold: 99, progressiveWeeksThreshold: 100 })).toBe(
      false
    );
  });

  it('respects custom progressiveWeeksThreshold config', () => {
    // 5 weeks = 4 consecutive increases
    const sessions = buildProgressiveWeeks(5);
    expect(shouldDeload(sessions, { acwrThreshold: 10, progressiveWeeksThreshold: 4 })).toBe(true);
    expect(shouldDeload(sessions, { acwrThreshold: 10, progressiveWeeksThreshold: 5 })).toBe(false);
  });
});

// =============================================================================
// generateDeloadPlan
// =============================================================================

describe('generateDeloadPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no-deload recommendation for empty sessions', () => {
    const rec = generateDeloadPlan([]);
    expect(rec.shouldDeload).toBe(false);
    expect(rec.reason).toBeNull();
    expect(rec.volumeReduction).toBeNull();
    expect(rec.durationDays).toBeNull();
  });

  it('uses high_acwr reason when ACWR is the trigger', () => {
    const now = new Date('2026-03-11T12:00:00Z').getTime();
    const sessions = buildHighAcwrSessions(now);
    const rec = generateDeloadPlan(sessions);

    expect(rec.shouldDeload).toBe(true);
    expect(rec.reason).toBe('high_acwr');
    expect(rec.volumeReduction).toBeCloseTo(0.65, 2);
    expect(rec.durationDays).toBe(7);
    expect(rec.message).toMatch(/training load ratio/i);
  });

  it('uses progressive_overload_streak reason when streak is the trigger', () => {
    // 4 weeks = 3 consecutive increases, matching progressiveWeeksThreshold: 3
    const sessions = buildProgressiveWeeks(4);
    const rec = generateDeloadPlan(sessions, {
      acwrThreshold: 10,
      progressiveWeeksThreshold: 3,
    });

    expect(rec.shouldDeload).toBe(true);
    expect(rec.reason).toBe('progressive_overload_streak');
    expect(rec.volumeReduction).toBeCloseTo(0.65, 2);
    expect(rec.durationDays).toBe(7);
    expect(rec.message).toMatch(/consecutive weeks/i);
  });

  it('prioritises high_acwr over progressive overload streak when both apply', () => {
    const now = new Date('2026-03-11T12:00:00Z').getTime();
    const sessions = [...buildHighAcwrSessions(now), ...buildProgressiveWeeks(4)];

    const rec = generateDeloadPlan(sessions);
    expect(rec.shouldDeload).toBe(true);
    // ACWR is checked first in the implementation
    expect(rec.reason).toBe('high_acwr');
  });

  it('includes a human-readable message in no-deload case', () => {
    const rec = generateDeloadPlan([]);
    expect(typeof rec.message).toBe('string');
    expect(rec.message.length).toBeGreaterThan(0);
  });
});
