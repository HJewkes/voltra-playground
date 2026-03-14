/**
 * Cross-Session Analytics Tests
 */

import { describe, it, expect } from 'vitest';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';
import {
  volumeTrendByPeriod,
  personalRecordTimeline,
  muscleGroupDistribution,
  exerciseFrequency,
  estimateTrainingLoad,
} from '../cross-session-analytics';

// =============================================================================
// Helpers
// =============================================================================

const DAY_MS = 86400000;

/** Create a timestamp at a specific date (YYYY-MM-DD). */
function ts(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getTime();
}

// =============================================================================
// volumeTrendByPeriod()
// =============================================================================

describe('volumeTrendByPeriod()', () => {
  it('returns empty array for no sets', () => {
    expect(volumeTrendByPeriod([], 'week')).toEqual([]);
  });

  it('groups sets into weekly buckets', () => {
    const sets = [
      mockCompletedSet({ weight: 100, repCount: 5, startTime: ts('2026-03-02') }),
      mockCompletedSet({ weight: 100, repCount: 5, startTime: ts('2026-03-03') }),
      mockCompletedSet({ weight: 100, repCount: 5, startTime: ts('2026-03-09') }),
    ];

    const result = volumeTrendByPeriod(sets, 'week');

    expect(result.length).toBe(2);
    expect(result[0].totalSets).toBe(2);
    expect(result[0].totalReps).toBe(10);
    expect(result[0].totalVolume).toBe(1000);
    expect(result[1].totalSets).toBe(1);
    expect(result[1].totalVolume).toBe(500);
  });

  it('groups sets into monthly buckets', () => {
    const sets = [
      mockCompletedSet({ weight: 100, repCount: 3, startTime: ts('2026-02-15') }),
      mockCompletedSet({ weight: 100, repCount: 3, startTime: ts('2026-02-20') }),
      mockCompletedSet({ weight: 100, repCount: 3, startTime: ts('2026-03-05') }),
    ];

    const result = volumeTrendByPeriod(sets, 'month');

    expect(result.length).toBe(2);
    expect(result[0].period).toBe('2026-02');
    expect(result[0].totalSets).toBe(2);
    expect(result[1].period).toBe('2026-03');
    expect(result[1].totalSets).toBe(1);
  });

  it('sorts periods chronologically', () => {
    const sets = [
      mockCompletedSet({ weight: 50, repCount: 2, startTime: ts('2026-03-15') }),
      mockCompletedSet({ weight: 50, repCount: 2, startTime: ts('2026-01-10') }),
      mockCompletedSet({ weight: 50, repCount: 2, startTime: ts('2026-02-05') }),
    ];

    const result = volumeTrendByPeriod(sets, 'month');

    expect(result[0].period).toBe('2026-01');
    expect(result[1].period).toBe('2026-02');
    expect(result[2].period).toBe('2026-03');
  });
});

// =============================================================================
// personalRecordTimeline()
// =============================================================================

describe('personalRecordTimeline()', () => {
  it('returns empty array for no sets', () => {
    expect(personalRecordTimeline([], 'bench')).toEqual([]);
  });

  it('filters to the specified exercise', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 5, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'squat', weight: 200, repCount: 5, startTime: 2000 }),
    ];

    const result = personalRecordTimeline(sets, 'bench');

    expect(result.every((r) => r.weight <= 100)).toBe(true);
  });

  it('tracks weight PR progression', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 5, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 120, repCount: 5, startTime: 2000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 110, repCount: 5, startTime: 3000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 130, repCount: 5, startTime: 4000 }),
    ];

    const result = personalRecordTimeline(sets, 'bench');
    const weightRecords = result.filter((r) => r.type === 'weight');

    expect(weightRecords.length).toBe(3);
    expect(weightRecords[0].value).toBe(100);
    expect(weightRecords[1].value).toBe(120);
    expect(weightRecords[2].value).toBe(130);
  });

  it('tracks volume PR progression', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 3, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 5, startTime: 2000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 4, startTime: 3000 }),
    ];

    const result = personalRecordTimeline(sets, 'bench');
    const volumeRecords = result.filter((r) => r.type === 'volume');

    expect(volumeRecords.length).toBe(2);
    expect(volumeRecords[0].value).toBe(300);
    expect(volumeRecords[1].value).toBe(500);
  });

  it('returns records sorted by date', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 5, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 120, repCount: 6, startTime: 2000 }),
    ];

    const result = personalRecordTimeline(sets, 'bench');

    for (let i = 1; i < result.length; i++) {
      expect(result[i].date).toBeGreaterThanOrEqual(result[i - 1].date);
    }
  });

  it('skips sets with zero reps', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', weight: 200, repCount: 0, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'bench', weight: 100, repCount: 5, startTime: 2000 }),
    ];

    const result = personalRecordTimeline(sets, 'bench');
    const weightRecords = result.filter((r) => r.type === 'weight');

    expect(weightRecords.length).toBe(1);
    expect(weightRecords[0].value).toBe(100);
  });
});

// =============================================================================
// muscleGroupDistribution()
// =============================================================================

describe('muscleGroupDistribution()', () => {
  it('returns empty array for no sets', () => {
    expect(muscleGroupDistribution([])).toEqual([]);
  });

  it('computes distribution for single muscle group exercises', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'cable_curl', weight: 50, repCount: 10, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'cable_curl', weight: 50, repCount: 10, startTime: 2000 }),
    ];

    const result = muscleGroupDistribution(sets);

    expect(result.length).toBe(1);
    expect(result[0].muscleGroup).toBe('biceps');
    expect(result[0].percentage).toBeCloseTo(100);
  });

  it('splits volume across multiple muscle groups', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'cable_row', weight: 100, repCount: 10, startTime: 1000 }),
    ];

    const result = muscleGroupDistribution(sets);

    expect(result.length).toBe(2);
    const totalPct = result.reduce((sum, r) => sum + r.percentage, 0);
    expect(totalPct).toBeCloseTo(100);
  });

  it('filters by date range', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'cable_curl', weight: 50, repCount: 10, startTime: ts('2026-01-15') }),
      mockCompletedSet({ exerciseId: 'cable_curl', weight: 50, repCount: 10, startTime: ts('2026-03-15') }),
    ];

    const result = muscleGroupDistribution(sets, {
      start: ts('2026-03-01'),
      end: ts('2026-03-31'),
    });

    expect(result.length).toBe(1);
    expect(result[0].volume).toBe(500);
  });

  it('sorts by percentage descending', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'cable_curl', weight: 50, repCount: 5, startTime: 1000 }),
      mockCompletedSet({ exerciseId: 'cable_squat', weight: 100, repCount: 10, startTime: 2000 }),
    ];

    const result = muscleGroupDistribution(sets);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].percentage).toBeLessThanOrEqual(result[i - 1].percentage);
    }
  });
});

// =============================================================================
// exerciseFrequency()
// =============================================================================

describe('exerciseFrequency()', () => {
  it('returns empty array for no sets', () => {
    expect(exerciseFrequency([])).toEqual([]);
  });

  it('counts distinct days as sessions', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', exerciseName: 'Bench', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'bench', exerciseName: 'Bench', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'bench', exerciseName: 'Bench', repCount: 5, startTime: ts('2026-03-03') }),
    ];

    const result = exerciseFrequency(sets);

    expect(result.length).toBe(1);
    expect(result[0].exerciseId).toBe('bench');
    expect(result[0].sessionCount).toBe(2);
    expect(result[0].totalSets).toBe(3);
    expect(result[0].totalReps).toBe(15);
  });

  it('tracks multiple exercises separately', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'bench', exerciseName: 'Bench', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'squat', exerciseName: 'Squat', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'bench', exerciseName: 'Bench', repCount: 5, startTime: ts('2026-03-03') }),
    ];

    const result = exerciseFrequency(sets);

    expect(result.length).toBe(2);
    const bench = result.find((r) => r.exerciseId === 'bench');
    const squat = result.find((r) => r.exerciseId === 'squat');
    expect(bench?.sessionCount).toBe(2);
    expect(squat?.sessionCount).toBe(1);
  });

  it('sorts by session count descending', () => {
    const sets = [
      mockCompletedSet({ exerciseId: 'a', exerciseName: 'A', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'b', exerciseName: 'B', repCount: 5, startTime: ts('2026-03-01') }),
      mockCompletedSet({ exerciseId: 'b', exerciseName: 'B', repCount: 5, startTime: ts('2026-03-02') }),
      mockCompletedSet({ exerciseId: 'b', exerciseName: 'B', repCount: 5, startTime: ts('2026-03-03') }),
    ];

    const result = exerciseFrequency(sets);

    expect(result[0].exerciseId).toBe('b');
    expect(result[0].sessionCount).toBe(3);
  });
});

// =============================================================================
// estimateTrainingLoad()
// =============================================================================

describe('estimateTrainingLoad()', () => {
  const endDate = ts('2026-03-14');

  it('returns undertraining for no recent sets', () => {
    const result = estimateTrainingLoad([], { start: endDate - 28 * DAY_MS, end: endDate });

    expect(result.acuteLoad).toBe(0);
    expect(result.chronicLoad).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.zone).toBe('undertraining');
  });

  it('detects optimal training load', () => {
    const sets = Array.from({ length: 28 }, (_, i) =>
      mockCompletedSet({
        weight: 100,
        repCount: 10,
        startTime: endDate - (27 - i) * DAY_MS,
      }),
    );

    const result = estimateTrainingLoad(sets, { start: endDate - 28 * DAY_MS, end: endDate });

    expect(result.ratio).toBeCloseTo(1.0, 0);
    expect(result.zone).toBe('optimal');
  });

  it('detects overreaching when acute spike exceeds chronic', () => {
    const chronicSets = [0, 7, 14, 21].map((daysAgo) =>
      mockCompletedSet({
        weight: 100,
        repCount: 5,
        startTime: endDate - daysAgo * DAY_MS,
      }),
    );
    const acuteSets = Array.from({ length: 10 }, (_, i) =>
      mockCompletedSet({
        weight: 100,
        repCount: 10,
        startTime: endDate - i * DAY_MS,
      }),
    );

    const allSets = [...chronicSets, ...acuteSets];
    const result = estimateTrainingLoad(allSets, { start: endDate - 28 * DAY_MS, end: endDate });

    expect(result.ratio).toBeGreaterThan(1.3);
  });

  it('detects undertraining when acute is much lower than chronic', () => {
    const sets = Array.from({ length: 21 }, (_, i) =>
      mockCompletedSet({
        weight: 100,
        repCount: 10,
        startTime: endDate - (27 - i) * DAY_MS,
      }),
    );

    const result = estimateTrainingLoad(sets, { start: endDate - 28 * DAY_MS, end: endDate });

    expect(result.ratio).toBeLessThan(0.8);
    expect(result.zone).toBe('undertraining');
  });

  it('only counts sets within the date range', () => {
    const oldSet = mockCompletedSet({
      weight: 1000,
      repCount: 100,
      startTime: endDate - 60 * DAY_MS,
    });
    const recentSet = mockCompletedSet({
      weight: 50,
      repCount: 5,
      startTime: endDate - 3 * DAY_MS,
    });

    const result = estimateTrainingLoad([oldSet, recentSet], {
      start: endDate - 28 * DAY_MS,
      end: endDate,
    });

    expect(result.acuteLoad).toBeCloseTo(250 / 7, 1);
  });
});
