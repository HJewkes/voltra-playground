/**
 * Mock Rep Plan Generator - regression tests for IDLE buffer and rep count accuracy.
 */

import { describe, it, expect } from 'vitest';
import { generateMockRepPlan } from '../mock-rep-plan';
import type { ExercisePlan } from '@/domain/workout';

function makePlan(targetReps: number, setCount = 1): ExercisePlan {
  return {
    exerciseId: 'test',
    defaultRestSeconds: 90,
    generatedAt: Date.now(),
    generatedBy: 'manual',
    sets: Array.from({ length: setCount }, (_, i) => ({
      setNumber: i + 1,
      weight: 50,
      targetReps,
      rirTarget: 0,
      isWarmup: false,
      restSeconds: 90,
    })),
  };
}

describe('generateMockRepPlan', () => {
  it('prepends an IDLE-only buffer rep as the first entry', () => {
    const plan = makePlan(3);
    const reps = generateMockRepPlan(plan);

    const buffer = reps[0];
    expect(buffer.conSeconds).toBe(0);
    expect(buffer.holdSeconds).toBe(0);
    expect(buffer.eccSeconds).toBe(0);
    expect(buffer.idleSeconds).toBe(0.5);
    expect(buffer.romMm).toBe(0);
  });

  it('produces targetReps + 1 entries for a single set (buffer + N reps)', () => {
    const targetReps = 5;
    const plan = makePlan(targetReps);
    const reps = generateMockRepPlan(plan);

    expect(reps).toHaveLength(targetReps + 1);
  });

  it('actual rep entries have non-zero concentric and eccentric durations', () => {
    const plan = makePlan(3);
    const reps = generateMockRepPlan(plan);

    for (const rep of reps.slice(1)) {
      expect(rep.conSeconds).toBeGreaterThan(0);
      expect(rep.eccSeconds).toBeGreaterThan(0);
      expect(rep.romMm).toBeGreaterThan(0);
    }
  });

  it('multi-set plan has buffer + sum of all set reps', () => {
    const plan = makePlan(4, 3);
    const reps = generateMockRepPlan(plan);
    expect(reps).toHaveLength(1 + 12);
  });
});
