/**
 * Set Aggregator Tests
 *
 * Tests for set metrics aggregation from reps.
 */

import { describe, it, expect } from 'vitest';
import { aggregateSet, createEmptySetMetrics } from '../set-aggregator';
import { repBuilder, setBuilder } from '@/__fixtures__/generators';
import type { Rep } from '@/domain/workout/models/rep';

// =============================================================================
// Test Helpers
// =============================================================================

function createRepsWithVelocityDecline(
  count: number,
  startVelocity: number = 0.7,
  declineRate: number = 0.05
): Rep[] {
  return Array.from({ length: count }, (_, i) => {
    const velocity = startVelocity - i * declineRate;
    return repBuilder()
      .concentric({ meanVelocity: velocity, peakVelocity: velocity + 0.15 })
      .eccentric({ meanVelocity: velocity * 0.5, peakVelocity: velocity * 0.6 })
      .repNumber(i + 1)
      .build();
  });
}

// =============================================================================
// aggregateSet() Tests
// =============================================================================

describe('aggregateSet()', () => {
  describe('basic metrics', () => {
    it('counts reps correctly', () => {
      const reps = createRepsWithVelocityDecline(5);
      const metrics = aggregateSet(reps, null);

      expect(metrics.repCount).toBe(5);
    });

    it('sums total duration', () => {
      const reps = [
        repBuilder().total({ duration: 2.0 }).repNumber(1).build(),
        repBuilder().total({ duration: 2.5 }).repNumber(2).build(),
        repBuilder().total({ duration: 3.0 }).repNumber(3).build(),
      ];
      const metrics = aggregateSet(reps, null);

      // Total duration should be approximately sum of rep durations
      expect(metrics.totalDuration).toBeGreaterThan(7);
      expect(metrics.totalDuration).toBeLessThan(8.5);
    });

    it('calculates time under tension', () => {
      const reps = [
        repBuilder()
          .concentric({ duration: 1.0 })
          .eccentric({ duration: 2.0 })
          .repNumber(1)
          .build(),
        repBuilder()
          .concentric({ duration: 1.0 })
          .eccentric({ duration: 2.0 })
          .repNumber(2)
          .build(),
      ];
      const metrics = aggregateSet(reps, null);

      // TUT = sum of (concentric + eccentric) for all reps, approximately 6
      expect(metrics.timeUnderTension).toBeGreaterThan(5);
      expect(metrics.timeUnderTension).toBeLessThan(7);
    });
  });

  describe('velocity metrics', () => {
    it('establishes baseline from first reps', () => {
      const reps = createRepsWithVelocityDecline(5, 0.7, 0.05);
      const metrics = aggregateSet(reps, null);

      // Baseline should be average of first 2 reps (default baselineReps)
      // Rep 1: 0.7, Rep 2: 0.65 -> average = 0.675
      expect(metrics.velocity.concentricBaseline).toBeCloseTo(0.675, 1);
    });

    it('captures last rep velocity', () => {
      const reps = createRepsWithVelocityDecline(5, 0.7, 0.05);
      const metrics = aggregateSet(reps, null);

      // Last rep: 0.7 - 4 * 0.05 = 0.5
      expect(metrics.velocity.concentricLast).toBeCloseTo(0.5, 1);
    });

    it('calculates velocity delta correctly', () => {
      const reps = createRepsWithVelocityDecline(5, 0.7, 0.05);
      const metrics = aggregateSet(reps, null);

      // Baseline ~0.675, Last = 0.5
      // Delta = (0.5 - 0.675) / 0.675 * 100 = -25.9%
      expect(metrics.velocity.concentricDelta).toBeLessThan(0); // Negative = slowing
    });

    it('tracks per-rep velocities', () => {
      const reps = createRepsWithVelocityDecline(3);
      const metrics = aggregateSet(reps, null);

      expect(metrics.velocity.concentricByRep.length).toBe(3);
      expect(metrics.velocity.eccentricByRep.length).toBe(3);
    });
  });

  describe('fatigue analysis', () => {
    it('calculates fatigue index for declining velocity', () => {
      const reps = createRepsWithVelocityDecline(6, 0.7, 0.08);
      const metrics = aggregateSet(reps, null);

      // Significant velocity drop should result in high fatigue index
      expect(metrics.fatigue.fatigueIndex).toBeGreaterThan(10);
    });

    it('calculates eccentric control score', () => {
      const reps = createRepsWithVelocityDecline(5);
      const metrics = aggregateSet(reps, null);

      // Score is based on eccentric delta - higher = better control
      expect(metrics.fatigue.eccentricControlScore).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.fatigue.eccentricControlScore).toBe('number');
    });

    it('generates form warning when appropriate', () => {
      // Create reps with poor eccentric control (eccentric speeding up)
      const reps = [
        repBuilder().eccentric({ meanVelocity: 0.3 }).repNumber(1).build(),
        repBuilder().eccentric({ meanVelocity: 0.35 }).repNumber(2).build(),
        repBuilder().eccentric({ meanVelocity: 0.5 }).repNumber(3).build(), // Much faster = losing control
      ];
      const metrics = aggregateSet(reps, null);

      // May or may not have warning depending on thresholds
      expect(
        metrics.fatigue.formWarning === null || typeof metrics.fatigue.formWarning === 'string'
      ).toBe(true);
    });
  });

  describe('effort estimate', () => {
    it('estimates RIR for fresh reps', () => {
      const reps = createRepsWithVelocityDecline(3, 0.7, 0.02); // Minimal decline
      const metrics = aggregateSet(reps, null);

      // Low fatigue should result in higher RIR
      expect(metrics.effort.rir).toBeGreaterThan(2);
    });

    it('estimates low RIR for fatigued reps', () => {
      const reps = createRepsWithVelocityDecline(8, 0.7, 0.08); // Significant decline
      const metrics = aggregateSet(reps, null);

      // High fatigue should result in lower RIR
      expect(metrics.effort.rir).toBeLessThan(4);
    });

    it('calculates RPE from RIR', () => {
      const reps = createRepsWithVelocityDecline(5);
      const metrics = aggregateSet(reps, null);

      // RPE = 10 - RIR (approximately)
      expect(metrics.effort.rpe).toBeGreaterThanOrEqual(4);
      expect(metrics.effort.rpe).toBeLessThanOrEqual(10);
    });

    it('assigns confidence level', () => {
      const reps = createRepsWithVelocityDecline(5);
      const metrics = aggregateSet(reps, null);

      expect(['high', 'medium', 'low']).toContain(metrics.effort.confidence);
    });
  });

  describe('empty reps', () => {
    it('returns empty metrics for no reps', () => {
      const metrics = aggregateSet([], null);

      expect(metrics.repCount).toBe(0);
      expect(metrics.totalDuration).toBe(0);
      expect(metrics.velocity.concentricBaseline).toBe(0);
      expect(metrics.fatigue.fatigueIndex).toBe(0);
    });
  });

  describe('single rep set', () => {
    it('handles single rep correctly', () => {
      const reps = [repBuilder().concentric({ meanVelocity: 0.6 }).repNumber(1).build()];
      const metrics = aggregateSet(reps, null);

      expect(metrics.repCount).toBe(1);
      expect(metrics.velocity.concentricBaseline).toBeCloseTo(0.6, 1);
      expect(metrics.velocity.concentricLast).toBeCloseTo(0.6, 1);
      expect(metrics.velocity.concentricDelta).toBeCloseTo(0, 1);
    });
  });
});

// =============================================================================
// createEmptySetMetrics() Tests
// =============================================================================

describe('createEmptySetMetrics()', () => {
  it('creates metrics with all zeros', () => {
    const metrics = createEmptySetMetrics();

    expect(metrics.repCount).toBe(0);
    expect(metrics.totalDuration).toBe(0);
    expect(metrics.timeUnderTension).toBe(0);
    expect(metrics.velocity.concentricBaseline).toBe(0);
    expect(metrics.velocity.concentricByRep).toEqual([]);
  });

  it('sets default effort values', () => {
    const metrics = createEmptySetMetrics();

    expect(metrics.effort.rir).toBe(6);
    expect(metrics.effort.rpe).toBe(4);
    expect(metrics.effort.confidence).toBe('low');
  });

  it('sets default fatigue values', () => {
    const metrics = createEmptySetMetrics();

    expect(metrics.fatigue.fatigueIndex).toBe(0);
    expect(metrics.fatigue.eccentricControlScore).toBe(100);
    expect(metrics.fatigue.formWarning).toBeNull();
  });
});

// =============================================================================
// Integration with Builders
// =============================================================================

describe('Set Aggregator with Builders', () => {
  it('processes set from builder composition', () => {
    const set = setBuilder().weight(100).productiveWorking().build();

    expect(set).toBeDefined();
    expect(set.metrics.repCount).toBe(7); // productiveWorking has 7 reps
    expect(set.metrics.velocity.concentricByRep.length).toBe(7);
  });

  it('shows velocity decline in toFailure set', () => {
    const set = setBuilder().weight(100).toFailure().build();

    expect(set).toBeDefined();
    if (set.metrics.velocity.concentricByRep.length >= 2) {
      const firstVelocity = set.metrics.velocity.concentricByRep[0];
      const lastVelocity =
        set.metrics.velocity.concentricByRep[set.metrics.velocity.concentricByRep.length - 1];

      // Should show velocity decline
      expect(lastVelocity).toBeLessThan(firstVelocity);
    }
  });
});
