/**
 * Training Log Service Tests
 *
 * Tests for calendar grouping, volume computation, and landmark comparisons.
 */

import { describe, it, expect } from 'vitest';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { MuscleGroup } from '@/domain/exercise/types';
import { TrainingLevel } from '@/domain/planning/types';
import {
  toDateKey,
  groupSessionsByDate,
  getWorkoutDates,
  getWeekStart,
  computeMuscleGroupVolumes,
  computeWeeklyVolume,
  compareVolumeLandmarks,
  getCalendarDays,
} from '../training-log-service';

function makeSession(
  overrides: Partial<StoredExerciseSession> & { exerciseId: string; startTime: number }
): StoredExerciseSession {
  return {
    id: overrides.id ?? `session-${overrides.startTime}`,
    exerciseId: overrides.exerciseId,
    exerciseName: overrides.exerciseName ?? 'Test Exercise',
    startTime: overrides.startTime,
    endTime: overrides.endTime ?? overrides.startTime + 3600000,
    plan: overrides.plan ?? {
      exerciseId: overrides.exerciseId,
      sets: [],
      defaultRestSeconds: 120,
      generatedAt: overrides.startTime,
      generatedBy: 'standard',
    },
    completedSets: overrides.completedSets ?? [],
    status: overrides.status ?? 'completed',
  };
}

function makeSet(weight: number, repCount: number, setIndex = 0) {
  return {
    setIndex,
    weight,
    reps: Array.from({ length: repCount }, (_, i) => ({
      repNumber: i + 1,
      concentric: { samples: [] },
      eccentric: { samples: [] },
    })),
    startTime: Date.now(),
    endTime: Date.now() + 30000,
    meanVelocity: 0.5,
    estimatedRPE: 7,
    estimatedRIR: 3,
    velocityLossPercent: 10,
  };
}

// =============================================================================
// toDateKey
// =============================================================================

describe('toDateKey', () => {
  it('converts timestamp to YYYY-MM-DD', () => {
    // 2025-03-14 12:00:00 UTC
    const ts = new Date(2025, 2, 14, 12, 0, 0).getTime();
    expect(toDateKey(ts)).toBe('2025-03-14');
  });

  it('pads single-digit months and days', () => {
    const ts = new Date(2025, 0, 5).getTime();
    expect(toDateKey(ts)).toBe('2025-01-05');
  });
});

// =============================================================================
// groupSessionsByDate
// =============================================================================

describe('groupSessionsByDate', () => {
  it('groups multiple sessions on the same day', () => {
    const day = new Date(2025, 2, 14, 10, 0, 0).getTime();
    const sessions = [
      makeSession({
        exerciseId: 'cable_row',
        startTime: day,
        completedSets: [makeSet(100, 8)],
      }),
      makeSession({
        exerciseId: 'cable_curl',
        startTime: day + 3600000,
        completedSets: [makeSet(50, 10)],
      }),
    ];

    const grouped = groupSessionsByDate(sessions);
    expect(grouped.size).toBe(1);

    const dayData = grouped.get('2025-03-14')!;
    expect(dayData.sessions).toHaveLength(2);
    expect(dayData.totalSets).toBe(2);
    expect(dayData.totalVolume).toBe(100 * 8 + 50 * 10);
  });

  it('separates sessions on different days', () => {
    const sessions = [
      makeSession({ exerciseId: 'cable_row', startTime: new Date(2025, 2, 14).getTime() }),
      makeSession({ exerciseId: 'cable_row', startTime: new Date(2025, 2, 15).getTime() }),
    ];

    const grouped = groupSessionsByDate(sessions);
    expect(grouped.size).toBe(2);
  });

  it('returns empty map for no sessions', () => {
    expect(groupSessionsByDate([]).size).toBe(0);
  });
});

// =============================================================================
// getWorkoutDates
// =============================================================================

describe('getWorkoutDates', () => {
  it('returns unique dates with workouts', () => {
    const day = new Date(2025, 2, 14).getTime();
    const sessions = [
      makeSession({ exerciseId: 'cable_row', startTime: day }),
      makeSession({ exerciseId: 'cable_curl', startTime: day + 3600000 }),
      makeSession({ exerciseId: 'cable_row', startTime: day + 86400000 }),
    ];

    const dates = getWorkoutDates(sessions);
    expect(dates.size).toBe(2);
    expect(dates.has('2025-03-14')).toBe(true);
    expect(dates.has('2025-03-15')).toBe(true);
  });
});

// =============================================================================
// getWeekStart
// =============================================================================

describe('getWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    // 2025-03-12 is Wednesday
    const wed = new Date(2025, 2, 12);
    const monday = getWeekStart(wed);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(10);
  });

  it('returns same day for a Monday', () => {
    const mon = new Date(2025, 2, 10);
    const result = getWeekStart(mon);
    expect(result.getDate()).toBe(10);
  });

  it('returns previous Monday for a Sunday', () => {
    // 2025-03-16 is Sunday
    const sun = new Date(2025, 2, 16);
    const monday = getWeekStart(sun);
    expect(monday.getDate()).toBe(10);
  });
});

// =============================================================================
// computeMuscleGroupVolumes
// =============================================================================

describe('computeMuscleGroupVolumes', () => {
  it('computes volume per muscle group', () => {
    const sessions = [
      makeSession({
        exerciseId: 'cable_row',
        startTime: Date.now(),
        completedSets: [makeSet(100, 8, 0), makeSet(100, 8, 1)],
      }),
      makeSession({
        exerciseId: 'cable_curl',
        startTime: Date.now(),
        completedSets: [makeSet(50, 10, 0)],
      }),
    ];

    const volumes = computeMuscleGroupVolumes(sessions);
    const back = volumes.find((v) => v.muscleGroup === MuscleGroup.BACK);
    const biceps = volumes.find((v) => v.muscleGroup === MuscleGroup.BICEPS);

    expect(back).toBeDefined();
    expect(back!.sets).toBe(2);
    expect(back!.reps).toBe(16);
    expect(back!.volume).toBe(1600);

    expect(biceps).toBeDefined();
    expect(biceps!.sets).toBe(1);
    expect(biceps!.reps).toBe(10);
    expect(biceps!.volume).toBe(500);
  });

  it('skips sessions with unknown exercise IDs', () => {
    const sessions = [
      makeSession({
        exerciseId: 'unknown_exercise',
        startTime: Date.now(),
        completedSets: [makeSet(100, 8)],
      }),
    ];

    const volumes = computeMuscleGroupVolumes(sessions);
    expect(volumes).toHaveLength(0);
  });

  it('sorts by sets descending', () => {
    const sessions = [
      makeSession({
        exerciseId: 'cable_curl',
        startTime: Date.now(),
        completedSets: [makeSet(50, 10)],
      }),
      makeSession({
        exerciseId: 'cable_row',
        startTime: Date.now(),
        completedSets: [makeSet(100, 8, 0), makeSet(100, 8, 1), makeSet(100, 6, 2)],
      }),
    ];

    const volumes = computeMuscleGroupVolumes(sessions);
    expect(volumes[0].muscleGroup).toBe(MuscleGroup.BACK);
    expect(volumes[1].muscleGroup).toBe(MuscleGroup.BICEPS);
  });
});

// =============================================================================
// computeWeeklyVolume
// =============================================================================

describe('computeWeeklyVolume', () => {
  it('includes only sessions within the target week', () => {
    // Monday March 10 to Sunday March 16
    const monday = new Date(2025, 2, 10, 10, 0, 0).getTime();
    const wednesday = new Date(2025, 2, 12, 10, 0, 0).getTime();
    const nextMonday = new Date(2025, 2, 17, 10, 0, 0).getTime();

    const sessions = [
      makeSession({
        exerciseId: 'cable_row',
        startTime: monday,
        completedSets: [makeSet(100, 8)],
      }),
      makeSession({
        exerciseId: 'cable_row',
        startTime: wednesday,
        completedSets: [makeSet(100, 8)],
      }),
      makeSession({
        exerciseId: 'cable_row',
        startTime: nextMonday,
        completedSets: [makeSet(100, 8)],
      }),
    ];

    const summary = computeWeeklyVolume(sessions, new Date(2025, 2, 12));
    expect(summary.totalSets).toBe(2);
  });
});

// =============================================================================
// compareVolumeLandmarks
// =============================================================================

describe('compareVolumeLandmarks', () => {
  it('marks below MEV correctly', () => {
    const volumes = [{ muscleGroup: MuscleGroup.BACK, sets: 2, reps: 16, volume: 1600 }];
    const result = compareVolumeLandmarks(volumes, TrainingLevel.INTERMEDIATE);

    expect(result[0].status).toBe('below_mev');
    expect(result[0].mev).toBe(8);
    expect(result[0].mav).toBe(16);
    expect(result[0].mrv).toBe(20);
  });

  it('marks optimal range correctly', () => {
    const volumes = [{ muscleGroup: MuscleGroup.BACK, sets: 12, reps: 96, volume: 9600 }];
    const result = compareVolumeLandmarks(volumes, TrainingLevel.INTERMEDIATE);

    expect(result[0].status).toBe('optimal');
  });

  it('marks over MRV correctly', () => {
    const volumes = [{ muscleGroup: MuscleGroup.BACK, sets: 25, reps: 200, volume: 20000 }];
    const result = compareVolumeLandmarks(volumes, TrainingLevel.INTERMEDIATE);

    expect(result[0].status).toBe('over_mrv');
  });
});

// =============================================================================
// getCalendarDays
// =============================================================================

describe('getCalendarDays', () => {
  it('returns 42 days (6 weeks)', () => {
    const days = getCalendarDays(2025, 2); // March 2025
    expect(days).toHaveLength(42);
  });

  it('starts on a Monday', () => {
    const days = getCalendarDays(2025, 2);
    // Parse as local date components to avoid UTC/local timezone mismatch
    const [y, m, d] = days[0].split('-').map(Number);
    const firstDay = new Date(y, m - 1, d);
    expect(firstDay.getDay()).toBe(1); // Monday
  });

  it('includes the first of the month', () => {
    const days = getCalendarDays(2025, 2);
    expect(days).toContain('2025-03-01');
  });
});
