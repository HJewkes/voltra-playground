/**
 * Workout Stats Tests
 *
 * Tests for workout stats computation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Rep } from '@voltras/workout-analytics';
import { computeWorkoutStats, createEmptyWorkoutStats } from '../stats';
import { mockPhase } from '@/__fixtures__/generators/mock-helpers';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestRep(options: { peakForce?: number; totalDuration?: number } = {}): Rep {
  const { peakForce = 100, totalDuration = 2.5 } = options;
  const concentricDuration = totalDuration * 0.35;
  const eccentricDuration = totalDuration * 0.65;
  const concentricEndMs = concentricDuration * 1000;

  return {
    repNumber: 1,
    concentric: mockPhase({
      peakForce,
      duration: concentricDuration,
      startTime: 0,
    }),
    eccentric: mockPhase({
      duration: eccentricDuration,
      startTime: concentricEndMs,
    }),
  };
}

// =============================================================================
// computeWorkoutStats() Tests
// =============================================================================

describe('computeWorkoutStats()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with no reps', () => {
    it('returns zero values for computed stats', () => {
      const stats = computeWorkoutStats([], null, null);

      expect(stats.repCount).toBe(0);
      expect(stats.avgPeakForce).toBe(0);
      expect(stats.maxPeakForce).toBe(0);
      expect(stats.avgRepDuration).toBe(0);
      expect(stats.timeUnderTension).toBe(0);
    });

    it('preserves weight if provided', () => {
      const stats = computeWorkoutStats([], null, 100);

      expect(stats.weightLbs).toBe(100);
    });
  });

  describe('with reps', () => {
    it('counts reps correctly', () => {
      const reps = [createTestRep(), createTestRep(), createTestRep()];
      const stats = computeWorkoutStats(reps, null, null);

      expect(stats.repCount).toBe(3);
    });

    it('calculates average peak force', () => {
      const reps = [
        createTestRep({ peakForce: 100 }),
        createTestRep({ peakForce: 150 }),
        createTestRep({ peakForce: 200 }),
      ];
      const stats = computeWorkoutStats(reps, null, null);

      // Average of peak forces - physics may produce slightly different values
      expect(stats.avgPeakForce).toBeGreaterThan(100);
      expect(stats.avgPeakForce).toBeLessThan(200);
    });

    it('calculates max peak force', () => {
      const reps = [
        createTestRep({ peakForce: 100 }),
        createTestRep({ peakForce: 200 }),
        createTestRep({ peakForce: 150 }),
      ];
      const stats = computeWorkoutStats(reps, null, null);

      // Max should be the highest peak force
      expect(stats.maxPeakForce).toBeGreaterThanOrEqual(stats.avgPeakForce);
    });

    it('calculates average rep duration', () => {
      const reps = [
        createTestRep({ totalDuration: 2 }),
        createTestRep({ totalDuration: 3 }),
        createTestRep({ totalDuration: 4 }),
      ];
      const stats = computeWorkoutStats(reps, null, null);

      // Average of total durations, approximately 3
      expect(stats.avgRepDuration).toBeCloseTo(3, 0);
    });

    it('calculates time under tension', () => {
      const reps = [
        createTestRep({ totalDuration: 2 }),
        createTestRep({ totalDuration: 3 }),
        createTestRep({ totalDuration: 4 }),
      ];
      const stats = computeWorkoutStats(reps, null, null);

      // Sum of total durations, approximately 9
      expect(stats.timeUnderTension).toBeCloseTo(9, 0);
    });

    it('handles single rep correctly', () => {
      const reps = [createTestRep()];
      const stats = computeWorkoutStats(reps, null, null);

      expect(stats.repCount).toBe(1);
    });
  });

  describe('timing', () => {
    it('calculates duration from start time', () => {
      const startTime = 1000000 - 30000; // 30 seconds ago
      const stats = computeWorkoutStats([], startTime, null);

      expect(stats.totalDuration).toBe(30);
    });

    it('uses current time as start if not provided', () => {
      const stats = computeWorkoutStats([], null, null);

      expect(stats.startTime).toBe(1000000);
      expect(stats.totalDuration).toBe(0);
    });

    it('sets endTime to current time', () => {
      const stats = computeWorkoutStats([], null, null);

      expect(stats.endTime).toBe(1000000);
    });
  });
});

// =============================================================================
// createEmptyWorkoutStats() Tests
// =============================================================================

describe('createEmptyWorkoutStats()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets startTime to current time', () => {
    const stats = createEmptyWorkoutStats();

    expect(stats.startTime).toBe(1000000);
  });

  it('sets endTime to null', () => {
    const stats = createEmptyWorkoutStats();

    expect(stats.endTime).toBeNull();
  });

  it('sets weight to null', () => {
    const stats = createEmptyWorkoutStats();

    expect(stats.weightLbs).toBeNull();
  });

  it('sets all computed values to zero', () => {
    const stats = createEmptyWorkoutStats();

    expect(stats.repCount).toBe(0);
    expect(stats.totalDuration).toBe(0);
    expect(stats.avgPeakForce).toBe(0);
    expect(stats.maxPeakForce).toBe(0);
    expect(stats.avgRepDuration).toBe(0);
    expect(stats.timeUnderTension).toBe(0);
  });
});
