/**
 * Rep Aggregator Tests
 *
 * Tests for rep aggregation from phases.
 */

import { describe, it, expect } from 'vitest';
import { aggregateRep, computeRepMetrics } from '../rep-aggregator';
import { aggregatePhase } from '../phase-aggregator';
import { MovementPhase } from '@/domain/workout';
import type { Phase } from '@/domain/workout/models/phase';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockConcentricPhase(
  options: {
    duration?: number;
    meanVelocity?: number;
    peakVelocity?: number;
    peakForce?: number;
    endPosition?: number;
  } = {}
): Phase {
  const {
    duration = 0.8,
    meanVelocity = 0.5,
    peakVelocity = 0.7,
    peakForce = 150,
    endPosition = 1,
  } = options;

  return {
    type: MovementPhase.CONCENTRIC,
    timestamp: { start: 1000, end: 1000 + duration * 1000 },
    samples: [],
    metrics: {
      duration,
      meanVelocity,
      peakVelocity,
      meanForce: peakForce * 0.8,
      peakForce,
      startPosition: 0,
      endPosition,
    },
  };
}

function createMockEccentricPhase(
  options: {
    duration?: number;
    meanVelocity?: number;
    peakVelocity?: number;
    peakForce?: number;
    startPosition?: number;
  } = {}
): Phase {
  const {
    duration = 1.5,
    meanVelocity = 0.3,
    peakVelocity = 0.4,
    peakForce = 120,
    startPosition = 1,
  } = options;

  return {
    type: MovementPhase.ECCENTRIC,
    timestamp: { start: 2000, end: 2000 + duration * 1000 },
    samples: [],
    metrics: {
      duration,
      meanVelocity,
      peakVelocity,
      meanForce: peakForce * 0.7,
      peakForce,
      startPosition,
      endPosition: 0,
    },
  };
}

function createMockHoldPhase(
  options: {
    duration?: number;
    position?: number;
  } = {}
): Phase {
  const { duration = 0.15, position = 1 } = options;

  return {
    type: MovementPhase.HOLD,
    timestamp: { start: 1800, end: 1800 + duration * 1000 },
    samples: [],
    metrics: {
      duration,
      meanVelocity: 0,
      peakVelocity: 0,
      meanForce: 80,
      peakForce: 80,
      startPosition: position,
      endPosition: position,
    },
  };
}

// =============================================================================
// aggregateRep() Tests
// =============================================================================

describe('aggregateRep()', () => {
  it('creates rep with correct rep number', () => {
    const concentric = createMockConcentricPhase();
    const eccentric = createMockEccentricPhase();
    const rep = aggregateRep(3, concentric, eccentric, null, null);

    expect(rep.repNumber).toBe(3);
  });

  it('includes all phases in rep', () => {
    const concentric = createMockConcentricPhase();
    const eccentric = createMockEccentricPhase();
    const holdTop = createMockHoldPhase();
    const rep = aggregateRep(1, concentric, eccentric, holdTop, null);

    expect(rep.concentric).toBe(concentric);
    expect(rep.eccentric).toBe(eccentric);
    expect(rep.holdAtTop).toBe(holdTop);
    expect(rep.holdAtBottom).toBeNull();
  });

  it('computes metrics correctly', () => {
    const concentric = createMockConcentricPhase({ duration: 0.8 });
    const eccentric = createMockEccentricPhase({ duration: 1.5 });
    const rep = aggregateRep(1, concentric, eccentric, null, null);

    expect(rep.metrics.concentricDuration).toBe(0.8);
    expect(rep.metrics.eccentricDuration).toBe(1.5);
    expect(rep.metrics.totalDuration).toBe(2.3);
  });
});

// =============================================================================
// computeRepMetrics() Tests
// =============================================================================

describe('computeRepMetrics()', () => {
  describe('duration calculations', () => {
    it('calculates total duration without holds', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.totalDuration).toBe(3.0);
    });

    it('includes top hold in total duration', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const holdTop = createMockHoldPhase({ duration: 0.5 });
      const metrics = computeRepMetrics(concentric, eccentric, holdTop, null);

      expect(metrics.totalDuration).toBe(3.5);
      expect(metrics.topPauseTime).toBe(0.5);
    });

    it('includes bottom hold in total duration', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const holdBottom = createMockHoldPhase({ duration: 0.3, position: 0 });
      const metrics = computeRepMetrics(concentric, eccentric, null, holdBottom);

      expect(metrics.totalDuration).toBe(3.3);
      expect(metrics.bottomPauseTime).toBe(0.3);
    });

    it('includes both holds in total duration', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const holdTop = createMockHoldPhase({ duration: 0.5 });
      const holdBottom = createMockHoldPhase({ duration: 0.3, position: 0 });
      const metrics = computeRepMetrics(concentric, eccentric, holdTop, holdBottom);

      expect(metrics.totalDuration).toBe(3.8);
    });
  });

  describe('velocity metrics', () => {
    it('captures concentric velocities', () => {
      const concentric = createMockConcentricPhase({
        meanVelocity: 0.6,
        peakVelocity: 0.85,
      });
      const eccentric = createMockEccentricPhase();
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.concentricMeanVelocity).toBe(0.6);
      expect(metrics.concentricPeakVelocity).toBe(0.85);
    });

    it('captures eccentric velocities', () => {
      const concentric = createMockConcentricPhase();
      const eccentric = createMockEccentricPhase({
        meanVelocity: 0.35,
        peakVelocity: 0.45,
      });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.eccentricMeanVelocity).toBe(0.35);
      expect(metrics.eccentricPeakVelocity).toBe(0.45);
    });
  });

  describe('force metrics', () => {
    it('captures peak force from concentric when higher', () => {
      const concentric = createMockConcentricPhase({ peakForce: 200 });
      const eccentric = createMockEccentricPhase({ peakForce: 150 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.peakForce).toBe(200);
    });

    it('captures peak force from eccentric when higher', () => {
      const concentric = createMockConcentricPhase({ peakForce: 150 });
      const eccentric = createMockEccentricPhase({ peakForce: 180 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.peakForce).toBe(180);
    });
  });

  describe('range of motion', () => {
    it('calculates ROM from phase positions', () => {
      const concentric = createMockConcentricPhase({ endPosition: 0.95 });
      const eccentric = createMockEccentricPhase({ startPosition: 0.95 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.rangeOfMotion).toBe(0.95);
    });

    it('handles full range of motion', () => {
      const concentric = createMockConcentricPhase({ endPosition: 1.0 });
      const eccentric = createMockEccentricPhase({ startPosition: 1.0 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      expect(metrics.rangeOfMotion).toBe(1.0);
    });
  });

  describe('tempo formatting', () => {
    it('formats standard tempo correctly', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      // Format: "eccentric-topPause-concentric-bottomPause"
      expect(metrics.tempo).toBe('2-0-1-0');
    });

    it('includes hold times in tempo', () => {
      const concentric = createMockConcentricPhase({ duration: 1.0 });
      const eccentric = createMockEccentricPhase({ duration: 2.0 });
      const holdTop = createMockHoldPhase({ duration: 0.5 });
      const holdBottom = createMockHoldPhase({ duration: 1.0, position: 0 });
      const metrics = computeRepMetrics(concentric, eccentric, holdTop, holdBottom);

      expect(metrics.tempo).toBe('2-0.5-1-1');
    });

    it('rounds tempo values to nearest 0.5', () => {
      const concentric = createMockConcentricPhase({ duration: 0.8 });
      const eccentric = createMockEccentricPhase({ duration: 1.7 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      // 1.7 rounds to 1.5, 0.8 rounds to 1
      expect(metrics.tempo).toBe('1.5-0-1-0');
    });

    it('handles very short durations', () => {
      const concentric = createMockConcentricPhase({ duration: 0.3 });
      const eccentric = createMockEccentricPhase({ duration: 0.6 });
      const metrics = computeRepMetrics(concentric, eccentric, null, null);

      // 0.3 rounds to 0.5, 0.6 rounds to 0.5
      expect(metrics.tempo).toBe('0.5-0-0.5-0');
    });
  });
});

// =============================================================================
// Integration with Behavioral Fixtures
// =============================================================================

describe('Rep Aggregator with Behavioral Fixtures', () => {
  it('aggregates phases from explosive rep correctly', async () => {
    const { generateExplosiveRep } = await import('@/__fixtures__/generators');
    const { samples } = generateExplosiveRep();

    const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);
    const eccentricSamples = samples.filter((s) => s.phase === MovementPhase.ECCENTRIC);
    const holdSamples = samples.filter((s) => s.phase === MovementPhase.HOLD);

    const concentric = aggregatePhase(MovementPhase.CONCENTRIC, concentricSamples);
    const eccentric = aggregatePhase(MovementPhase.ECCENTRIC, eccentricSamples);
    const holdTop = holdSamples.length > 0 ? aggregatePhase(MovementPhase.HOLD, holdSamples) : null;

    const rep = aggregateRep(1, concentric, eccentric, holdTop, null);

    expect(rep.repNumber).toBe(1);
    expect(rep.metrics.concentricPeakVelocity).toBeGreaterThan(0.7);
    expect(rep.metrics.totalDuration).toBeGreaterThan(0);
    expect(rep.metrics.rangeOfMotion).toBeGreaterThan(0);
  });

  it('shows velocity differences between explosive and grinding reps', async () => {
    const { generateExplosiveRep, generateGrindingRep } = await import('@/__fixtures__/generators');

    const { samples: explosiveSamples } = generateExplosiveRep();
    const { samples: grindingSamples } = generateGrindingRep();

    // Process explosive rep
    const explosiveConcentric = aggregatePhase(
      MovementPhase.CONCENTRIC,
      explosiveSamples.filter((s) => s.phase === MovementPhase.CONCENTRIC)
    );
    const explosiveEccentric = aggregatePhase(
      MovementPhase.ECCENTRIC,
      explosiveSamples.filter((s) => s.phase === MovementPhase.ECCENTRIC)
    );
    const explosiveRep = aggregateRep(1, explosiveConcentric, explosiveEccentric, null, null);

    // Process grinding rep
    const grindingConcentric = aggregatePhase(
      MovementPhase.CONCENTRIC,
      grindingSamples.filter((s) => s.phase === MovementPhase.CONCENTRIC)
    );
    const grindingEccentric = aggregatePhase(
      MovementPhase.ECCENTRIC,
      grindingSamples.filter((s) => s.phase === MovementPhase.ECCENTRIC)
    );
    const grindingRep = aggregateRep(1, grindingConcentric, grindingEccentric, null, null);

    // Explosive should be faster
    expect(explosiveRep.metrics.concentricPeakVelocity).toBeGreaterThan(
      grindingRep.metrics.concentricPeakVelocity
    );

    // Grinding should take longer
    expect(grindingRep.metrics.concentricDuration).toBeGreaterThan(
      explosiveRep.metrics.concentricDuration
    );
  });
});
