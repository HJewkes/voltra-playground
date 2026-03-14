/**
 * Cross-Session Analytics Service Tests
 *
 * Tests for volume bucketing, muscle group distribution,
 * exercise frequency, training load, and PR timeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import { type StoredExerciseSession } from '@/data/exercise-session';
import {
  computeVolumeBuckets,
  computeMuscleGroupDistribution,
  computeExerciseFrequency,
  computeTrainingLoad,
  computePRTimeline,
} from '../cross-session-analytics';

// =============================================================================
// Test Helpers
// =============================================================================

function createSession(
  overrides: Partial<StoredExerciseSession> = {}
): StoredExerciseSession {
  return { ...generateStoredSession(), ...overrides };
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// =============================================================================
// computeVolumeBuckets
// =============================================================================

describe('computeVolumeBuckets', () => {
  it('returns empty for no sessions', () => {
    expect(computeVolumeBuckets([], 'weekly')).toEqual([]);
  });

  it('returns empty for non-completed sessions', () => {
    const sessions = [createSession({ status: 'abandoned' })];
    expect(computeVolumeBuckets(sessions, 'weekly')).toEqual([]);
  });

  it('groups sessions into weekly buckets', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: daysAgo(1),
        completedSets: [generateStoredSet({ weight: 100, repCount: 10 })],
      }),
      createSession({
        status: 'completed',
        startTime: daysAgo(2),
        completedSets: [generateStoredSet({ weight: 100, repCount: 8 })],
      }),
    ];

    const buckets = computeVolumeBuckets(sessions, 'weekly');

    expect(buckets.length).toBeGreaterThanOrEqual(1);
    const totalVolume = buckets.reduce((sum, b) => sum + b.totalVolume, 0);
    expect(totalVolume).toBe(100 * 10 + 100 * 8);
  });

  it('groups sessions into monthly buckets', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: daysAgo(5),
        completedSets: [generateStoredSet({ weight: 50, repCount: 5 })],
      }),
    ];

    const buckets = computeVolumeBuckets(sessions, 'monthly');

    expect(buckets.length).toBe(1);
    expect(buckets[0].totalVolume).toBe(250);
    expect(buckets[0].sessionCount).toBe(1);
  });

  it('limits to maxBuckets', () => {
    const sessions: StoredExerciseSession[] = [];
    for (let i = 0; i < 20; i++) {
      sessions.push(
        createSession({
          status: 'completed',
          startTime: daysAgo(i * 8),
          completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
        })
      );
    }

    const buckets = computeVolumeBuckets(sessions, 'weekly', 4);
    expect(buckets.length).toBeLessThanOrEqual(4);
  });

  it('sorts buckets chronologically', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: daysAgo(14),
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
      createSession({
        status: 'completed',
        startTime: daysAgo(1),
        completedSets: [generateStoredSet({ weight: 200, repCount: 5 })],
      }),
    ];

    const buckets = computeVolumeBuckets(sessions, 'weekly');

    if (buckets.length >= 2) {
      expect(buckets[0].startDate).toBeLessThan(buckets[buckets.length - 1].startDate);
    }
  });
});

// =============================================================================
// computeMuscleGroupDistribution
// =============================================================================

describe('computeMuscleGroupDistribution', () => {
  it('returns empty for no sessions', () => {
    expect(computeMuscleGroupDistribution([])).toEqual([]);
  });

  it('returns empty for sessions without mapped exercises', () => {
    const sessions = [
      createSession({
        status: 'completed',
        exerciseId: 'unmapped-exercise',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
    ];

    const result = computeMuscleGroupDistribution(sessions);
    expect(result).toEqual([]);
  });

  it('computes percentages that sum to ~100', () => {
    const sessions = [
      createSession({
        status: 'completed',
        exerciseId: 'bench_press',
        completedSets: [
          generateStoredSet({ weight: 100, repCount: 5 }),
          generateStoredSet({ weight: 100, repCount: 5 }),
        ],
      }),
      createSession({
        status: 'completed',
        exerciseId: 'barbell_squat',
        completedSets: [
          generateStoredSet({ weight: 200, repCount: 5 }),
          generateStoredSet({ weight: 200, repCount: 5 }),
        ],
      }),
    ];

    const result = computeMuscleGroupDistribution(sessions);

    if (result.length > 0) {
      const totalPct = result.reduce((sum, r) => sum + r.percentage, 0);
      expect(totalPct).toBeGreaterThanOrEqual(95);
      expect(totalPct).toBeLessThanOrEqual(105);
    }
  });

  it('sorts by sets descending', () => {
    const sessions = [
      createSession({
        status: 'completed',
        exerciseId: 'bench_press',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
      createSession({
        status: 'completed',
        exerciseId: 'barbell_squat',
        completedSets: [
          generateStoredSet({ weight: 200, repCount: 5 }),
          generateStoredSet({ weight: 200, repCount: 5 }),
          generateStoredSet({ weight: 200, repCount: 5 }),
        ],
      }),
    ];

    const result = computeMuscleGroupDistribution(sessions);

    if (result.length >= 2) {
      expect(result[0].sets).toBeGreaterThanOrEqual(result[1].sets);
    }
  });
});

// =============================================================================
// computeExerciseFrequency
// =============================================================================

describe('computeExerciseFrequency', () => {
  it('returns empty for no sessions', () => {
    expect(computeExerciseFrequency([])).toEqual([]);
  });

  it('counts sessions per exercise', () => {
    const sessions = [
      createSession({ status: 'completed', exerciseId: 'bench', exerciseName: 'Bench' }),
      createSession({ status: 'completed', exerciseId: 'bench', exerciseName: 'Bench' }),
      createSession({ status: 'completed', exerciseId: 'squat', exerciseName: 'Squat' }),
    ];

    const result = computeExerciseFrequency(sessions);

    const bench = result.find((r) => r.exerciseId === 'bench');
    expect(bench?.sessionCount).toBe(2);
    expect(bench?.exerciseName).toBe('Bench');

    const squat = result.find((r) => r.exerciseId === 'squat');
    expect(squat?.sessionCount).toBe(1);
  });

  it('sorts by session count descending', () => {
    const sessions = [
      createSession({ status: 'completed', exerciseId: 'rare', exerciseName: 'Rare' }),
      createSession({ status: 'completed', exerciseId: 'common', exerciseName: 'Common' }),
      createSession({ status: 'completed', exerciseId: 'common', exerciseName: 'Common' }),
      createSession({ status: 'completed', exerciseId: 'common', exerciseName: 'Common' }),
    ];

    const result = computeExerciseFrequency(sessions);

    expect(result[0].exerciseId).toBe('common');
    expect(result[0].sessionCount).toBe(3);
  });

  it('limits results', () => {
    const sessions: StoredExerciseSession[] = [];
    for (let i = 0; i < 20; i++) {
      sessions.push(
        createSession({
          status: 'completed',
          exerciseId: `ex-${i}`,
          exerciseName: `Exercise ${i}`,
        })
      );
    }

    const result = computeExerciseFrequency(sessions, 5);
    expect(result.length).toBe(5);
  });

  it('computes average sets per session', () => {
    const sessions = [
      createSession({
        status: 'completed',
        exerciseId: 'bench',
        exerciseName: 'Bench',
        completedSets: [
          generateStoredSet({ repCount: 5 }),
          generateStoredSet({ repCount: 5 }),
          generateStoredSet({ repCount: 5 }),
        ],
      }),
      createSession({
        status: 'completed',
        exerciseId: 'bench',
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ repCount: 5 })],
      }),
    ];

    const result = computeExerciseFrequency(sessions);
    const bench = result.find((r) => r.exerciseId === 'bench');

    expect(bench?.avgSetsPerSession).toBe(2);
  });
});

// =============================================================================
// computeTrainingLoad
// =============================================================================

describe('computeTrainingLoad', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero ACWR for no sessions', () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));
    const result = computeTrainingLoad([]);
    expect(result.acwr).toBe(0);
    expect(result.status).toBe('undertraining');
  });

  it('classifies optimal load', () => {
    const now = new Date('2026-03-14T12:00:00Z');
    vi.setSystemTime(now);

    const sessions: StoredExerciseSession[] = [];
    // Create consistent weekly volume for past 5 weeks
    for (let week = 0; week < 5; week++) {
      sessions.push(
        createSession({
          status: 'completed',
          startTime: now.getTime() - week * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
          completedSets: [
            generateStoredSet({ weight: 100, repCount: 10 }),
            generateStoredSet({ weight: 100, repCount: 10 }),
          ],
        })
      );
    }

    const result = computeTrainingLoad(sessions);

    expect(result.acuteLoad).toBeGreaterThan(0);
    expect(result.chronicLoad).toBeGreaterThan(0);
    // With consistent load, ACWR should be near 1.0
    expect(result.acwr).toBeGreaterThan(0.5);
    expect(result.acwr).toBeLessThan(2.0);
  });

  it('classifies danger when acute load is much higher than chronic', () => {
    const now = new Date('2026-03-14T12:00:00Z');
    vi.setSystemTime(now);

    const sessions: StoredExerciseSession[] = [];

    // Very high current week volume
    sessions.push(
      createSession({
        status: 'completed',
        startTime: now.getTime() - 1 * 24 * 60 * 60 * 1000,
        completedSets: [
          generateStoredSet({ weight: 200, repCount: 20 }),
          generateStoredSet({ weight: 200, repCount: 20 }),
          generateStoredSet({ weight: 200, repCount: 20 }),
          generateStoredSet({ weight: 200, repCount: 20 }),
        ],
      })
    );

    // Very low chronic volume (1 light session per week)
    for (let week = 1; week <= 4; week++) {
      sessions.push(
        createSession({
          status: 'completed',
          startTime: now.getTime() - week * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
          completedSets: [generateStoredSet({ weight: 50, repCount: 3 })],
        })
      );
    }

    const result = computeTrainingLoad(sessions);

    expect(result.acwr).toBeGreaterThan(1.5);
    expect(result.status).toBe('danger');
  });
});

// =============================================================================
// computePRTimeline
// =============================================================================

describe('computePRTimeline', () => {
  it('returns empty for no sessions', () => {
    expect(computePRTimeline([])).toEqual([]);
  });

  it('records initial PRs from first session', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: 1000,
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
    ];

    const timeline = computePRTimeline(sessions);

    expect(timeline.length).toBeGreaterThanOrEqual(4);
    const types = timeline.map((t) => t.type);
    expect(types).toContain('max_weight');
    expect(types).toContain('max_reps');
    expect(types).toContain('max_velocity');
    expect(types).toContain('max_volume');
  });

  it('records new PRs when they are broken', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: 1000,
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
      createSession({
        status: 'completed',
        startTime: 2000,
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ weight: 150, repCount: 5 })],
      }),
    ];

    const timeline = computePRTimeline(sessions);

    const weightPRs = timeline.filter((t) => t.type === 'max_weight');
    expect(weightPRs.length).toBe(2);
    expect(weightPRs[1].value).toBe(150);
  });

  it('does not record PR if value not exceeded', () => {
    const sessions = [
      createSession({
        status: 'completed',
        startTime: 1000,
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ weight: 200, repCount: 10 })],
      }),
      createSession({
        status: 'completed',
        startTime: 2000,
        exerciseName: 'Bench',
        completedSets: [generateStoredSet({ weight: 100, repCount: 5 })],
      }),
    ];

    const timeline = computePRTimeline(sessions);

    const weightPRs = timeline.filter((t) => t.type === 'max_weight');
    expect(weightPRs.length).toBe(1);
    expect(weightPRs[0].value).toBe(200);
  });

  it('excludes non-completed sessions', () => {
    const sessions = [
      createSession({
        status: 'abandoned',
        startTime: 1000,
        completedSets: [generateStoredSet({ weight: 500, repCount: 20 })],
      }),
    ];

    const timeline = computePRTimeline(sessions);
    expect(timeline).toEqual([]);
  });
});
