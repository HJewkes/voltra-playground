/**
 * Session History Service Tests
 *
 * Tests for aggregate stats, personal records, grouping, and trend
 * computations from stored session data.
 */

import { describe, it, expect } from 'vitest';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  computeStoredAggregateStats,
  computeStoredPersonalRecords,
  groupSessionsByExercise,
  computeVelocityTrend,
  computeVolumeTrend,
} from '../session-history-service';

// =============================================================================
// Test Helpers
// =============================================================================

function createSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  return { ...generateStoredSession(), ...overrides };
}

// =============================================================================
// computeStoredAggregateStats
// =============================================================================

describe('computeStoredAggregateStats', () => {
  it('returns zeros for empty sessions', () => {
    const result = computeStoredAggregateStats([]);
    expect(result).toEqual({ totalSets: 0, totalReps: 0, totalVolume: 0 });
  });

  it('sums sets and reps across sessions', () => {
    const session1 = createSession({
      completedSets: [
        generateStoredSet({ repCount: 8, weight: 100 }),
        generateStoredSet({ repCount: 6, weight: 100 }),
      ],
    });
    const session2 = createSession({
      completedSets: [generateStoredSet({ repCount: 10, weight: 50 })],
    });

    const result = computeStoredAggregateStats([session1, session2]);

    expect(result.totalSets).toBe(3);
    expect(result.totalReps).toBe(24);
    expect(result.totalVolume).toBe(8 * 100 + 6 * 100 + 10 * 50);
  });

  it('handles sessions with no completed sets', () => {
    const session = createSession({ completedSets: [] });
    const result = computeStoredAggregateStats([session]);

    expect(result.totalSets).toBe(0);
    expect(result.totalReps).toBe(0);
    expect(result.totalVolume).toBe(0);
  });
});

// =============================================================================
// computeStoredPersonalRecords
// =============================================================================

describe('computeStoredPersonalRecords', () => {
  it('returns empty for no sessions', () => {
    const result = computeStoredPersonalRecords([]);
    expect(result).toEqual([]);
  });

  it('returns empty for sessions with no completed sets', () => {
    const session = createSession({ completedSets: [] });
    const result = computeStoredPersonalRecords([session]);
    expect(result).toEqual([]);
  });

  it('computes max weight PR', () => {
    const session = createSession({
      exerciseName: 'Bench Press',
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8 }),
        generateStoredSet({ weight: 150, repCount: 5 }),
      ],
    });

    const records = computeStoredPersonalRecords([session]);
    const maxWeight = records.find((r) => r.type === 'max_weight');

    expect(maxWeight).toBeDefined();
    expect(maxWeight?.value).toBe(150);
  });

  it('computes max reps PR', () => {
    const session = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 5 }),
        generateStoredSet({ weight: 80, repCount: 12 }),
      ],
    });

    const records = computeStoredPersonalRecords([session]);
    const maxReps = records.find((r) => r.type === 'max_reps');

    expect(maxReps).toBeDefined();
    expect(maxReps?.value).toBe(12);
  });

  it('computes max volume PR', () => {
    const session = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 5 }),
        generateStoredSet({ weight: 80, repCount: 10 }),
      ],
    });

    const records = computeStoredPersonalRecords([session]);
    const maxVolume = records.find((r) => r.type === 'max_volume');

    expect(maxVolume).toBeDefined();
    expect(maxVolume?.value).toBe(800); // 80 * 10
  });

  it('computes max velocity PR', () => {
    const session = createSession({
      completedSets: [
        generateStoredSet({ startingVelocity: 0.5, repCount: 8 }),
        generateStoredSet({ startingVelocity: 1.2, repCount: 8 }),
      ],
    });

    const records = computeStoredPersonalRecords([session]);
    const maxVelocity = records.find((r) => r.type === 'max_velocity');

    expect(maxVelocity).toBeDefined();
    expect(maxVelocity!.value).toBeGreaterThan(0.5);
  });

  it('includes exercise name and session ID', () => {
    const session = createSession({
      id: 'test-session-1',
      exerciseName: 'Squat',
      completedSets: [generateStoredSet({ weight: 200, repCount: 5 })],
    });

    const records = computeStoredPersonalRecords([session]);

    for (const record of records) {
      expect(record.sessionId).toBe('test-session-1');
      expect(record.exerciseName).toBe('Squat');
    }
  });

  it('finds PRs across multiple sessions', () => {
    const session1 = createSession({
      completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
    });
    const session2 = createSession({
      completedSets: [generateStoredSet({ weight: 200, repCount: 3 })],
    });

    const records = computeStoredPersonalRecords([session1, session2]);
    const maxWeight = records.find((r) => r.type === 'max_weight');

    expect(maxWeight?.value).toBe(200);
  });
});

// =============================================================================
// groupSessionsByExercise
// =============================================================================

describe('groupSessionsByExercise', () => {
  it('returns empty for no sessions', () => {
    expect(groupSessionsByExercise([])).toEqual([]);
  });

  it('groups sessions by exercise ID', () => {
    const sessions = [
      createSession({ exerciseId: 'bench', exerciseName: 'Bench Press' }),
      createSession({ exerciseId: 'bench', exerciseName: 'Bench Press' }),
      createSession({ exerciseId: 'squat', exerciseName: 'Squat' }),
    ];

    const groups = groupSessionsByExercise(sessions);

    expect(groups.length).toBe(2);
    const bench = groups.find((g) => g.exerciseId === 'bench');
    expect(bench?.sessionCount).toBe(2);
  });

  it('sorts groups by most recent session', () => {
    const sessions = [
      createSession({ exerciseId: 'bench', startTime: 1000 }),
      createSession({ exerciseId: 'squat', startTime: 2000 }),
    ];

    const groups = groupSessionsByExercise(sessions);

    expect(groups[0].exerciseId).toBe('squat');
    expect(groups[1].exerciseId).toBe('bench');
  });

  it('accumulates set and rep counts', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        completedSets: [generateStoredSet({ repCount: 8 }), generateStoredSet({ repCount: 6 })],
      }),
      createSession({
        exerciseId: 'bench',
        completedSets: [generateStoredSet({ repCount: 10 })],
      }),
    ];

    const groups = groupSessionsByExercise(sessions);
    const bench = groups.find((g) => g.exerciseId === 'bench')!;

    expect(bench.totalSets).toBe(3);
    expect(bench.totalReps).toBe(24);
  });
});

// =============================================================================
// computeVelocityTrend
// =============================================================================

describe('computeVelocityTrend', () => {
  it('returns empty for no matching sessions', () => {
    const sessions = [createSession({ exerciseId: 'bench' })];
    const result = computeVelocityTrend(sessions, 'squat');
    expect(result).toEqual([]);
  });

  it('returns data points for matching exercise', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
    ];

    const result = computeVelocityTrend(sessions, 'bench');
    expect(result.length).toBe(1);
    expect(result[0].weight).toBe(100);
    expect(result[0].meanVelocity).toBeGreaterThan(0);
  });

  it('excludes non-completed sessions', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'abandoned',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
    ];

    const result = computeVelocityTrend(sessions, 'bench');
    expect(result).toEqual([]);
  });

  it('returns points sorted chronologically', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: 2000,
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: 1000,
        completedSets: [generateStoredSet({ weight: 80, repCount: 8 })],
      }),
    ];

    const result = computeVelocityTrend(sessions, 'bench');

    expect(result.length).toBe(2);
    expect(result[0].weight).toBe(80);
    expect(result[1].weight).toBe(100);
  });
});

// =============================================================================
// computeVolumeTrend
// =============================================================================

describe('computeVolumeTrend', () => {
  it('returns empty for no sessions', () => {
    expect(computeVolumeTrend([])).toEqual([]);
  });

  it('computes per-session volume', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: 1000,
        completedSets: [
          generateStoredSet({ weight: 100, repCount: 8 }),
          generateStoredSet({ weight: 100, repCount: 6 }),
        ],
      }),
    ];

    const result = computeVolumeTrend(sessions);
    expect(result.length).toBe(1);
    expect(result[0].totalVolume).toBe(100 * 8 + 100 * 6);
    expect(result[0].totalReps).toBe(14);
    expect(result[0].setCount).toBe(2);
  });

  it('excludes non-completed sessions', () => {
    const sessions = [
      createSession({ status: 'abandoned' }),
      createSession({ status: 'completed', startTime: 1000 }),
    ];

    const result = computeVolumeTrend(sessions);
    expect(result.length).toBe(1);
  });
});
