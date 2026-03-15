/**
 * Progression Service Tests
 *
 * Tests for per-exercise progression computation, including
 * velocity/e1RM/volume comparison and last session banner.
 */

import { describe, it, expect } from 'vitest';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  computeExerciseProgression,
  buildLastSessionBanner,
  computeProgressionFromHistory,
  buildRepeatLastSessionPlan,
  type LastSessionBanner,
} from '../progression-service';

// =============================================================================
// Test Helpers
// =============================================================================

function createSession(
  overrides: Partial<StoredExerciseSession> = {},
): StoredExerciseSession {
  return { ...generateStoredSession(), ...overrides };
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// =============================================================================
// computeExerciseProgression
// =============================================================================

describe('computeExerciseProgression', () => {
  it('returns null when current session has no sets', () => {
    const current = createSession({ completedSets: [] });
    const previous = createSession();

    expect(computeExerciseProgression(current, previous)).toBeNull();
  });

  it('returns null when previous session has no sets', () => {
    const current = createSession();
    const previous = createSession({ completedSets: [] });

    expect(computeExerciseProgression(current, previous)).toBeNull();
  });

  it('computes velocity comparison between sessions', () => {
    const previous = createSession({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.6 }),
      ],
    });

    const current = createSession({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.7 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result).not.toBeNull();
    expect(result!.exerciseId).toBe('bench');
    expect(result!.velocity.current).toBeGreaterThan(result!.velocity.previous);
    expect(result!.velocity.direction).toBe('up');
  });

  it('detects velocity decrease', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.8 }),
      ],
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.5 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.velocity.direction).toBe('down');
    expect(result!.velocity.delta).toBeLessThan(0);
  });

  it('detects flat trend when change is minimal', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.8 }),
      ],
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.801 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.velocity.direction).toBe('flat');
  });

  it('computes e1RM comparison', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 5 }),
      ],
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 110, repCount: 5 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.e1RM.current).toBeGreaterThan(result!.e1RM.previous);
    expect(result!.e1RM.direction).toBe('up');
  });

  it('computes volume comparison', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 8 }),
        generateStoredSet({ weight: 100, repCount: 8 }),
      ],
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 10 }),
        generateStoredSet({ weight: 100, repCount: 10 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.volume.current).toBe(2000);
    expect(result!.volume.previous).toBe(1600);
    expect(result!.volume.direction).toBe('up');
  });

  it('includes delta percent', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 10 }),
      ],
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 100, repCount: 5 }),
      ],
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.volume.deltaPercent).toBe(-50);
  });

  it('excludes warmup sets from calculations', () => {
    const previous = createSession({
      completedSets: [
        generateStoredSet({ weight: 50, repCount: 5 }),
        generateStoredSet({ weight: 100, repCount: 8 }),
      ],
      plan: {
        exerciseId: 'bench',
        sets: [
          { setNumber: 1, weight: 50, targetReps: 5, rirTarget: 4, isWarmup: true },
          { setNumber: 2, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false },
        ],
        defaultRestSeconds: 120,
        generatedAt: Date.now(),
        generatedBy: 'standard',
      },
    });

    const current = createSession({
      completedSets: [
        generateStoredSet({ weight: 50, repCount: 5 }),
        generateStoredSet({ weight: 100, repCount: 10 }),
      ],
      plan: {
        exerciseId: 'bench',
        sets: [
          { setNumber: 1, weight: 50, targetReps: 5, rirTarget: 4, isWarmup: true },
          { setNumber: 2, weight: 100, targetReps: 10, rirTarget: 2, isWarmup: false },
        ],
        defaultRestSeconds: 120,
        generatedAt: Date.now(),
        generatedBy: 'standard',
      },
    });

    const result = computeExerciseProgression(current, previous);

    expect(result!.volume.previous).toBe(800);
    expect(result!.volume.current).toBe(1000);
  });
});

// =============================================================================
// buildLastSessionBanner
// =============================================================================

describe('buildLastSessionBanner', () => {
  it('returns null when no sessions exist', () => {
    expect(buildLastSessionBanner([], 'bench')).toBeNull();
  });

  it('returns null for non-completed sessions only', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'abandoned',
      }),
    ];

    expect(buildLastSessionBanner(sessions, 'bench')).toBeNull();
  });

  it('returns banner from most recent completed session', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        status: 'completed',
        startTime: daysAgo(7),
        completedSets: [
          generateStoredSet({ weight: 100, repCount: 8, startingVelocity: 0.6 }),
        ],
      }),
      createSession({
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        status: 'completed',
        startTime: daysAgo(1),
        completedSets: [
          generateStoredSet({ weight: 110, repCount: 8, startingVelocity: 0.55 }),
        ],
      }),
    ];

    const banner = buildLastSessionBanner(sessions, 'bench');

    expect(banner).not.toBeNull();
    expect(banner!.weight).toBe(110);
    expect(banner!.exerciseName).toBe('Bench Press');
    expect(banner!.sets).toBe(1);
    expect(banner!.reps).toBe(8);
  });

  it('filters by exercise ID', () => {
    const sessions = [
      createSession({
        exerciseId: 'squat',
        exerciseName: 'Squat',
        status: 'completed',
        startTime: daysAgo(1),
      }),
    ];

    expect(buildLastSessionBanner(sessions, 'bench')).toBeNull();
  });
});

// =============================================================================
// computeProgressionFromHistory
// =============================================================================

describe('computeProgressionFromHistory', () => {
  it('returns null with fewer than two sessions', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'completed',
      }),
    ];

    expect(computeProgressionFromHistory(sessions, 'bench')).toBeNull();
  });

  it('returns null with no sessions', () => {
    expect(computeProgressionFromHistory([], 'bench')).toBeNull();
  });

  it('compares the two most recent sessions', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: daysAgo(14),
        completedSets: [
          generateStoredSet({ weight: 90, repCount: 8 }),
        ],
      }),
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: daysAgo(7),
        completedSets: [
          generateStoredSet({ weight: 100, repCount: 8 }),
        ],
      }),
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: daysAgo(1),
        completedSets: [
          generateStoredSet({ weight: 110, repCount: 8 }),
        ],
      }),
    ];

    const result = computeProgressionFromHistory(sessions, 'bench');

    expect(result).not.toBeNull();
    expect(result!.volume.current).toBe(880);
    expect(result!.volume.previous).toBe(800);
  });

  it('ignores non-completed sessions', () => {
    const sessions = [
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: daysAgo(7),
        completedSets: [generateStoredSet({ weight: 100, repCount: 8 })],
      }),
      createSession({
        exerciseId: 'bench',
        status: 'abandoned',
        startTime: daysAgo(3),
        completedSets: [generateStoredSet({ weight: 200, repCount: 10 })],
      }),
      createSession({
        exerciseId: 'bench',
        status: 'completed',
        startTime: daysAgo(1),
        completedSets: [generateStoredSet({ weight: 110, repCount: 8 })],
      }),
    ];

    const result = computeProgressionFromHistory(sessions, 'bench');

    expect(result).not.toBeNull();
    expect(result!.volume.previous).toBe(800);
    expect(result!.volume.current).toBe(880);
  });

  it('filters by exercise ID', () => {
    const sessions = [
      createSession({
        exerciseId: 'squat',
        status: 'completed',
        startTime: daysAgo(7),
      }),
      createSession({
        exerciseId: 'squat',
        status: 'completed',
        startTime: daysAgo(1),
      }),
    ];

    expect(computeProgressionFromHistory(sessions, 'bench')).toBeNull();
  });
});

// =============================================================================
// buildRepeatLastSessionPlan
// =============================================================================

describe('buildRepeatLastSessionPlan', () => {
  function makeBanner(overrides: Partial<LastSessionBanner> = {}): LastSessionBanner {
    return {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      date: daysAgo(7),
      weight: 135,
      velocity: 0.6,
      sets: 3,
      reps: 24,
      ...overrides,
    };
  }

  it('creates one planned set per working set from the last session', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ sets: 3, reps: 24 }));
    expect(plan.sets).toHaveLength(3);
  });

  it('assigns the last session weight to every planned set', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ weight: 185, sets: 2, reps: 16 }));
    for (const set of plan.sets) {
      expect(set.weight).toBe(185);
    }
  });

  it('distributes total reps evenly across sets', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ sets: 4, reps: 20 }));
    for (const set of plan.sets) {
      expect(set.targetReps).toBe(5);
    }
  });

  it('rounds reps when total does not divide evenly', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ sets: 3, reps: 25 }));
    // 25/3 ≈ 8.33 → rounds to 8
    for (const set of plan.sets) {
      expect(set.targetReps).toBe(8);
    }
  });

  it('marks all sets as working (not warmup)', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner());
    for (const set of plan.sets) {
      expect(set.isWarmup).toBe(false);
    }
  });

  it('uses the exercise ID from the banner', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ exerciseId: 'squat' }));
    expect(plan.exerciseId).toBe('squat');
  });

  it('assigns sequential set numbers', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ sets: 3 }));
    expect(plan.sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it('produces an empty plan when the banner has zero sets', () => {
    const plan = buildRepeatLastSessionPlan(makeBanner({ sets: 0, reps: 0 }));
    expect(plan.sets).toHaveLength(0);
  });
});
