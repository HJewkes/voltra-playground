/**
 * Phase Aggregator Tests
 *
 * Tests for phase aggregation from WorkoutSamples.
 */

import { describe, it, expect } from 'vitest';
import { aggregatePhase, computePhaseMetrics } from '../phase-aggregator';
import { MovementPhase, createSample } from '@/domain/workout';

// =============================================================================
// Test Helpers
// =============================================================================

function createConcentricSamples(
  count: number,
  options: {
    startTime?: number;
    peakVelocity?: number;
    baseForce?: number;
  } = {}
) {
  const { startTime = 1000, peakVelocity = 0.7, baseForce = 150 } = options;
  const samples = [];

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const timestamp = startTime + i * 90; // ~11Hz
    const position = progress;
    // Velocity follows sine curve (ramps up then down)
    const velocity = Math.sin(progress * Math.PI) * peakVelocity;
    const force = baseForce * (1 - progress * 0.3);

    samples.push(createSample(i, timestamp, MovementPhase.CONCENTRIC, position, velocity, force));
  }

  return samples;
}

function createEccentricSamples(
  count: number,
  options: {
    startTime?: number;
    peakVelocity?: number;
    baseForce?: number;
    startSequence?: number;
  } = {}
) {
  const { startTime = 1000, peakVelocity = 0.4, baseForce = 120, startSequence = 0 } = options;
  const samples = [];

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const timestamp = startTime + i * 90;
    const position = 1 - progress; // Goes from 1 to 0
    const velocity = Math.sin(progress * Math.PI) * peakVelocity;
    const force = baseForce * (1 - progress * 0.2);

    samples.push(
      createSample(startSequence + i, timestamp, MovementPhase.ECCENTRIC, position, velocity, force)
    );
  }

  return samples;
}

// =============================================================================
// aggregatePhase() Tests
// =============================================================================

describe('aggregatePhase()', () => {
  describe('with valid samples', () => {
    it('creates phase with correct type', () => {
      const samples = createConcentricSamples(10);
      const phase = aggregatePhase(MovementPhase.CONCENTRIC, samples);

      expect(phase.type).toBe(MovementPhase.CONCENTRIC);
    });

    it('captures timestamp range from samples', () => {
      const samples = createConcentricSamples(10, { startTime: 5000 });
      const phase = aggregatePhase(MovementPhase.CONCENTRIC, samples);

      expect(phase.timestamp.start).toBe(samples[0].timestamp);
      expect(phase.timestamp.end).toBe(samples[samples.length - 1].timestamp);
    });

    it('includes all samples', () => {
      const samples = createConcentricSamples(15);
      const phase = aggregatePhase(MovementPhase.CONCENTRIC, samples);

      expect(phase.samples.length).toBe(15);
      expect(phase.samples).toEqual(samples);
    });

    it('computes metrics correctly', () => {
      const samples = createConcentricSamples(10, { peakVelocity: 0.8, baseForce: 200 });
      const phase = aggregatePhase(MovementPhase.CONCENTRIC, samples);

      expect(phase.metrics.duration).toBeGreaterThan(0);
      expect(phase.metrics.meanVelocity).toBeGreaterThan(0);
      expect(phase.metrics.peakVelocity).toBeGreaterThan(0);
      expect(phase.metrics.meanForce).toBeGreaterThan(0);
      expect(phase.metrics.peakForce).toBeGreaterThan(0);
    });
  });

  describe('with empty samples', () => {
    it('returns empty phase with zeros', () => {
      const phase = aggregatePhase(MovementPhase.CONCENTRIC, []);

      expect(phase.type).toBe(MovementPhase.CONCENTRIC);
      expect(phase.samples).toEqual([]);
      expect(phase.timestamp.start).toBe(0);
      expect(phase.timestamp.end).toBe(0);
      expect(phase.metrics.duration).toBe(0);
      expect(phase.metrics.meanVelocity).toBe(0);
      expect(phase.metrics.peakVelocity).toBe(0);
    });
  });

  describe('with different phase types', () => {
    it('handles ECCENTRIC phase', () => {
      const samples = createEccentricSamples(10);
      const phase = aggregatePhase(MovementPhase.ECCENTRIC, samples);

      expect(phase.type).toBe(MovementPhase.ECCENTRIC);
      expect(phase.metrics.startPosition).toBe(1); // Starts at top
      expect(phase.metrics.endPosition).toBeLessThan(1); // Ends lower
    });

    it('handles HOLD phase', () => {
      const holdSamples = [
        createSample(0, 1000, MovementPhase.HOLD, 1, 0, 100),
        createSample(1, 1100, MovementPhase.HOLD, 1, 0, 100),
        createSample(2, 1200, MovementPhase.HOLD, 1, 0, 100),
      ];
      const phase = aggregatePhase(MovementPhase.HOLD, holdSamples);

      expect(phase.type).toBe(MovementPhase.HOLD);
      expect(phase.metrics.meanVelocity).toBe(0);
      expect(phase.metrics.startPosition).toBe(1);
      expect(phase.metrics.endPosition).toBe(1);
    });

    it('handles IDLE phase', () => {
      const idleSamples = [
        createSample(0, 1000, MovementPhase.IDLE, 0, 0, 0),
        createSample(1, 1100, MovementPhase.IDLE, 0, 0, 0),
      ];
      const phase = aggregatePhase(MovementPhase.IDLE, idleSamples);

      expect(phase.type).toBe(MovementPhase.IDLE);
      expect(phase.metrics.meanVelocity).toBe(0);
      expect(phase.metrics.meanForce).toBe(0);
    });
  });
});

// =============================================================================
// computePhaseMetrics() Tests
// =============================================================================

describe('computePhaseMetrics()', () => {
  describe('duration calculation', () => {
    it('calculates duration in seconds', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100),
        createSample(1, 1500, MovementPhase.CONCENTRIC, 0.5, 0.7, 100),
        createSample(2, 2000, MovementPhase.CONCENTRIC, 1, 0.5, 100),
      ];
      const metrics = computePhaseMetrics(samples);

      expect(metrics.duration).toBe(1); // 2000 - 1000 = 1000ms = 1s
    });

    it('returns 0 for single sample', () => {
      const samples = [createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100)];
      const metrics = computePhaseMetrics(samples);

      expect(metrics.duration).toBe(0);
    });
  });

  describe('velocity calculations', () => {
    it('calculates mean velocity', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.2, 100),
        createSample(1, 1100, MovementPhase.CONCENTRIC, 0.5, 0.6, 100),
        createSample(2, 1200, MovementPhase.CONCENTRIC, 1, 0.4, 100),
      ];
      const metrics = computePhaseMetrics(samples);

      // Mean of 0.2, 0.6, 0.4 = 0.4
      expect(metrics.meanVelocity).toBeCloseTo(0.4, 5);
    });

    it('calculates peak velocity', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.2, 100),
        createSample(1, 1100, MovementPhase.CONCENTRIC, 0.5, 0.8, 100),
        createSample(2, 1200, MovementPhase.CONCENTRIC, 1, 0.4, 100),
      ];
      const metrics = computePhaseMetrics(samples);

      expect(metrics.peakVelocity).toBe(0.8);
    });
  });

  describe('force calculations', () => {
    it('calculates mean force', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100),
        createSample(1, 1100, MovementPhase.CONCENTRIC, 0.5, 0.5, 150),
        createSample(2, 1200, MovementPhase.CONCENTRIC, 1, 0.5, 200),
      ];
      const metrics = computePhaseMetrics(samples);

      // Mean of 100, 150, 200 = 150
      expect(metrics.meanForce).toBe(150);
    });

    it('calculates peak force', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100),
        createSample(1, 1100, MovementPhase.CONCENTRIC, 0.5, 0.5, 250),
        createSample(2, 1200, MovementPhase.CONCENTRIC, 1, 0.5, 150),
      ];
      const metrics = computePhaseMetrics(samples);

      expect(metrics.peakForce).toBe(250);
    });
  });

  describe('position tracking', () => {
    it('captures start and end positions', () => {
      const samples = [
        createSample(0, 1000, MovementPhase.CONCENTRIC, 0.1, 0.5, 100),
        createSample(1, 1100, MovementPhase.CONCENTRIC, 0.5, 0.5, 100),
        createSample(2, 1200, MovementPhase.CONCENTRIC, 0.9, 0.5, 100),
      ];
      const metrics = computePhaseMetrics(samples);

      expect(metrics.startPosition).toBe(0.1);
      expect(metrics.endPosition).toBe(0.9);
    });
  });

  describe('empty samples', () => {
    it('returns zeros for empty array', () => {
      const metrics = computePhaseMetrics([]);

      expect(metrics.duration).toBe(0);
      expect(metrics.meanVelocity).toBe(0);
      expect(metrics.peakVelocity).toBe(0);
      expect(metrics.meanForce).toBe(0);
      expect(metrics.peakForce).toBe(0);
      expect(metrics.startPosition).toBe(0);
      expect(metrics.endPosition).toBe(0);
    });
  });
});

// =============================================================================
// Integration with Real Fixture Data
// =============================================================================

describe('Phase Aggregator with Behavioral Fixtures', () => {
  it('correctly aggregates concentric samples from explosive rep', async () => {
    const { generateExplosiveRep } = await import('@/__fixtures__/generators');
    const { samples } = generateExplosiveRep();

    const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);
    const phase = aggregatePhase(MovementPhase.CONCENTRIC, concentricSamples);

    // Explosive reps should have high peak velocity
    expect(phase.metrics.peakVelocity).toBeGreaterThan(0.7);
    expect(phase.metrics.duration).toBeGreaterThan(0);
  });

  it('correctly aggregates eccentric samples from grinding rep', async () => {
    const { generateGrindingRep } = await import('@/__fixtures__/generators');
    const { samples } = generateGrindingRep();

    const eccentricSamples = samples.filter((s) => s.phase === MovementPhase.ECCENTRIC);
    const phase = aggregatePhase(MovementPhase.ECCENTRIC, eccentricSamples);

    // Eccentric should have lower velocity
    expect(phase.metrics.peakVelocity).toBeLessThan(0.5);
    expect(phase.metrics.startPosition).toBeGreaterThan(phase.metrics.endPosition);
  });
});
