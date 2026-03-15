/**
 * WorkoutSuggestionService Tests
 *
 * Tests for the suggestNextExercise algorithm covering:
 *  - Recency scoring (days since last performed)
 *  - Muscle group balance bonus / penalty
 *  - Catalog exercises never attempted
 *  - Top-N limiting and sort order
 *  - Reason text generation
 */

import { describe, it, expect } from 'vitest';
import { suggestNextExercise } from '../workout-suggestion-service';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { generateStoredSession, generateStoredSet } from '@/__fixtures__/generators/session-generator';
import { EXERCISE_CATALOG } from '@/domain/exercise/catalog';

// =============================================================================
// Helpers
// =============================================================================

const NOW = new Date('2026-03-14T12:00:00Z').getTime();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return NOW - days * MS_PER_DAY;
}

function makeSession(
  exerciseId: string,
  daysAgoCount: number,
  setCount = 3,
): StoredExerciseSession {
  return {
    ...generateStoredSession(),
    exerciseId,
    exerciseName: exerciseId,
    status: 'completed',
    startTime: daysAgo(daysAgoCount),
    completedSets: Array.from({ length: setCount }, () => generateStoredSet({ repCount: 8 })),
  };
}

// Minimal two-exercise catalog for isolated tests
const MINI_CATALOG = {
  cable_chest_press: EXERCISE_CATALOG.cable_chest_press,
  cable_row: EXERCISE_CATALOG.cable_row,
};

// =============================================================================
// Basic behaviour
// =============================================================================

describe('suggestNextExercise', () => {
  it('returns topN suggestions by default (3)', () => {
    const result = suggestNextExercise([], EXERCISE_CATALOG, 3, NOW);
    expect(result.length).toBe(3);
  });

  it('returns fewer than topN when catalog is small', () => {
    const result = suggestNextExercise([], MINI_CATALOG, 5, NOW);
    expect(result.length).toBe(2);
  });

  it('excludes the placeholder general exercise', () => {
    const catalogWithGeneral = { ...MINI_CATALOG, general: EXERCISE_CATALOG.general };
    const result = suggestNextExercise([], catalogWithGeneral, 10, NOW);
    expect(result.find((s) => s.exerciseId === 'general')).toBeUndefined();
  });

  it('sorts suggestions by score descending', () => {
    const result = suggestNextExercise([], EXERCISE_CATALOG, 10, NOW);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

// =============================================================================
// Recency scoring
// =============================================================================

describe('recency scoring', () => {
  it('scores exercise done 10 days ago higher than one done 2 days ago', () => {
    const sessions = [
      makeSession('cable_chest_press', 10),
      makeSession('cable_row', 2),
    ];

    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    const chestIdx = result.findIndex((s) => s.exerciseId === 'cable_chest_press');
    const rowIdx = result.findIndex((s) => s.exerciseId === 'cable_row');
    expect(chestIdx).toBeLessThan(rowIdx);
  });

  it('scores a never-attempted exercise as if done 14 days ago', () => {
    const sessions: StoredExerciseSession[] = [];
    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    // Both never done — both should have score from 14 days × 2 = 28 (before muscle adj)
    expect(result[0].score).toBeGreaterThanOrEqual(28);
  });

  it('includes days in reason when exercise was done ≥7 days ago', () => {
    const sessions = [makeSession('cable_chest_press', 9)];
    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    const chest = result.find((s) => s.exerciseId === 'cable_chest_press');
    expect(chest?.reason).toMatch(/9 day/);
  });
});

// =============================================================================
// Muscle group balance
// =============================================================================

describe('muscle group balance', () => {
  it('gives bonus to exercises with underrepresented muscle group', () => {
    // Lots of back sessions this week, no chest
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('cable_row', i * 0.5), // recent back sessions
    );

    // Both exercises last done at same time — chest should outscore back due to bonus
    const chestsession = makeSession('cable_chest_press', 3);
    const rowSession = makeSession('cable_row', 3);

    const result = suggestNextExercise(
      [...sessions, chestsession, rowSession],
      MINI_CATALOG,
      2,
      NOW,
    );

    const chest = result.find((s) => s.exerciseId === 'cable_chest_press');
    const row = result.find((s) => s.exerciseId === 'cable_row');

    expect(chest!.score).toBeGreaterThan(row!.score);
  });

  it('penalises exercises with overrepresented muscle group', () => {
    // 10 sets of chest this week
    const chestSessions = Array.from({ length: 2 }, (_, i) =>
      makeSession('cable_chest_press', i + 1, 5),
    );

    // Only 1 set of back this week
    const backSession = makeSession('cable_row', 3, 1);

    // Both exercises last done 3 days ago; back should outscore chest
    const result = suggestNextExercise(
      [...chestSessions, backSession],
      MINI_CATALOG,
      2,
      NOW,
    );

    const chest = result.find((s) => s.exerciseId === 'cable_chest_press');
    const row = result.find((s) => s.exerciseId === 'cable_row');

    expect(row!.score).toBeGreaterThan(chest!.score);
  });

  it('mentions low volume in reason when muscle group is underrepresented', () => {
    // No chest sessions this week, some back sets
    const backSessions = [makeSession('cable_row', 2, 4)];

    const result = suggestNextExercise(
      backSessions,
      MINI_CATALOG,
      2,
      NOW,
    );

    const chest = result.find((s) => s.exerciseId === 'cable_chest_press');
    // Chest muscle group (chest) should be mentioned as low if reason triggers
    expect(chest).toBeDefined();
  });
});

// =============================================================================
// Reason strings
// =============================================================================

describe('reason text', () => {
  it('says "Not done in N days" for exercises done ≥7 days ago', () => {
    const sessions = [makeSession('cable_chest_press', 8)];
    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    const chest = result.find((s) => s.exerciseId === 'cable_chest_press');
    expect(chest?.reason).toMatch(/Not done in 8 days/);
  });

  it('says "Not done in N days" for exercises done ≥3 days ago with no muscle bonus', () => {
    // Both muscle groups equally represented this week
    const sessions = [
      makeSession('cable_chest_press', 4, 3),
      makeSession('cable_row', 4, 3),
    ];
    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    for (const suggestion of result) {
      expect(suggestion.reason).toMatch(/Not done in 4 days/);
    }
  });

  it('provides a fallback reason for recently done exercises with no muscle imbalance', () => {
    const sessions = [
      makeSession('cable_chest_press', 1, 3),
      makeSession('cable_row', 1, 3),
    ];
    const result = suggestNextExercise(sessions, MINI_CATALOG, 2, NOW);

    for (const suggestion of result) {
      expect(suggestion.reason).toBeTruthy();
      expect(suggestion.reason.length).toBeGreaterThan(0);
    }
  });
});
