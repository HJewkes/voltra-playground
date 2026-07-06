/**
 * Session Debrief Service Tests
 *
 * Tests for the debrief data assembly: progression arrows, training load,
 * PR detection, recovery notes, and exercise suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { EXERCISE_CATALOG } from '@/domain/exercise';
import { assembleSessionDebrief } from '../session-debrief-service';

// =============================================================================
// Helpers
// =============================================================================

function createSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  return { ...generateStoredSession(), ...overrides };
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// =============================================================================
// assembleSessionDebrief
// =============================================================================

describe('assembleSessionDebrief', () => {
  it('returns training load even with no history', () => {
    const current = createSession({ exerciseId: 'cable_row', exerciseName: 'Seated Cable Row' });
    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.trainingLoad).toBeDefined();
    expect(result.trainingLoad.acwr).toBeGreaterThanOrEqual(0);
    expect(result.trainingLoad.status).toBeDefined();
  });

  it('returns empty progression arrows for first-ever session', () => {
    const current = createSession({ exerciseId: 'cable_row', exerciseName: 'Seated Cable Row' });
    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.progressionArrows).toHaveLength(0);
  });

  it('returns progression arrows when previous session exists', () => {
    const previous = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: daysAgo(3),
      completedSets: [generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.6 })],
    });

    const current = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: Date.now(),
      completedSets: [generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.7 })],
    });

    const result = assembleSessionDebrief([current], [current, previous], EXERCISE_CATALOG);

    expect(result.progressionArrows).toHaveLength(1);
    expect(result.progressionArrows[0].exerciseName).toBe('Seated Cable Row');
    expect(result.progressionArrows[0].velocity.direction).toBe('up');
  });

  it('returns suggestions based on history', () => {
    const current = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: Date.now(),
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    expect(result.suggestions.length).toBeLessThanOrEqual(2);
  });

  it('returns no recovery note for clean completion', () => {
    const current = createSession({
      terminationReason: 'plan_exhausted',
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.recoveryNote).toBeNull();
  });

  it('returns warning recovery note for velocity grinding', () => {
    const current = createSession({
      terminationReason: 'velocity_grinding',
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.recoveryNote).not.toBeNull();
    expect(result.recoveryNote!.severity).toBe('warning');
    expect(result.recoveryNote!.message).toContain('max effort');
  });

  it('returns warning recovery note for failure', () => {
    const current = createSession({
      terminationReason: 'failure',
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.recoveryNote).not.toBeNull();
    expect(result.recoveryNote!.severity).toBe('warning');
    expect(result.recoveryNote!.message).toContain('failure');
  });

  it('returns info recovery note for junk volume', () => {
    const current = createSession({
      terminationReason: 'junk_volume',
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.recoveryNote).not.toBeNull();
    expect(result.recoveryNote!.severity).toBe('info');
    expect(result.recoveryNote!.message).toContain('lighter volume');
  });

  it('returns combined warning for grinding + junk volume', () => {
    const session1 = createSession({
      exerciseId: 'cable_row',
      terminationReason: 'velocity_grinding',
    });
    const session2 = createSession({
      exerciseId: 'cable_curl',
      terminationReason: 'junk_volume',
    });

    const result = assembleSessionDebrief(
      [session1, session2],
      [session1, session2],
      EXERCISE_CATALOG
    );

    expect(result.recoveryNote).not.toBeNull();
    expect(result.recoveryNote!.severity).toBe('warning');
  });

  it('handles multi-exercise workout progression', () => {
    const prevRow = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: daysAgo(3),
      completedSets: [generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.6 })],
    });
    const prevCurl = createSession({
      exerciseId: 'cable_curl',
      exerciseName: 'Cable Bicep Curl',
      startTime: daysAgo(3),
      completedSets: [generateStoredSet({ weight: 30, repCount: 12, startingVelocity: 0.5 })],
    });

    const currentRow = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: Date.now(),
      completedSets: [generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.7 })],
    });
    const currentCurl = createSession({
      exerciseId: 'cable_curl',
      exerciseName: 'Cable Bicep Curl',
      startTime: Date.now(),
      completedSets: [generateStoredSet({ weight: 30, repCount: 12, startingVelocity: 0.6 })],
    });

    const allHistory = [currentRow, currentCurl, prevRow, prevCurl];
    const result = assembleSessionDebrief([currentRow, currentCurl], allHistory, EXERCISE_CATALOG);

    expect(result.progressionArrows).toHaveLength(2);
    const names = result.progressionArrows.map((a) => a.exerciseName);
    expect(names).toContain('Seated Cable Row');
    expect(names).toContain('Cable Bicep Curl');
  });

  it('detects PR badges from current session', () => {
    const current = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: Date.now(),
      completedSets: [generateStoredSet({ weight: 200, repCount: 10, startingVelocity: 1.5 })],
    });

    const result = assembleSessionDebrief([current], [current], EXERCISE_CATALOG);

    expect(result.prBadges.length).toBeGreaterThan(0);
  });

  it('does not attribute PRs from older sessions to current session', () => {
    const olderSetTime = daysAgo(7);
    const currentSetTime = Date.now();

    const older = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: olderSetTime,
      completedSets: [
        {
          ...generateStoredSet({ weight: 200, repCount: 15, startingVelocity: 2.0 }),
          startTime: olderSetTime,
          endTime: olderSetTime + 60_000,
        },
      ],
    });

    const current = createSession({
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      startTime: currentSetTime,
      completedSets: [
        {
          ...generateStoredSet({ weight: 100, repCount: 5, startingVelocity: 0.5 }),
          startTime: currentSetTime,
          endTime: currentSetTime + 60_000,
        },
      ],
    });

    const result = assembleSessionDebrief([current], [older, current], EXERCISE_CATALOG);

    expect(result.prBadges).toHaveLength(0);
  });
});
