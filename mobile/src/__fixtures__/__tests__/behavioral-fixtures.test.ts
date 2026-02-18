/**
 * Behavioral Fixtures Tests
 *
 * Validates that behavioral fixtures produce realistic data with correct
 * phase structures and physics parameters.
 *
 * Key validation criteria:
 * - Completed rep behaviors produce samples with both concentric and eccentric phases
 * - Failed rep behaviors produce only concentric samples (no eccentric)
 * - Physics parameters match expected velocity ranges
 * - Set compositions process correctly through the library pipeline
 *
 * Note: Rep detection is now internal to the @voltras/workout-analytics library.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRepSamples,
  generateExplosiveRep,
  generateNormalRep,
  generateFatiguingRep,
  generateGrindingRep,
  generateFailedRep,
  generatePartialRep,
  REP_BEHAVIOR_PHYSICS,
  type RepBehavior,
} from '../generators/rep-behaviors';
import { generateSetFromBehaviors, setPresets, sets } from '../generators/set-compositions';
import { MovementPhase } from '@/domain/workout';

// =============================================================================
// Rep Behavior Validation
// =============================================================================

describe('Rep Behavior Fixtures', () => {
  describe('generateExplosiveRep()', () => {
    it('produces samples with concentric and eccentric phases', () => {
      const { samples } = generateExplosiveRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('has peak velocity matching explosive physics', () => {
      const { samples } = generateExplosiveRep();
      const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);
      const peakVelocity = Math.max(...concentricSamples.map((s) => s.velocity));

      expect(peakVelocity).toBeGreaterThanOrEqual(0.8);
      expect(peakVelocity).toBeLessThanOrEqual(1.1);
    });

    it('has shorter concentric duration than normal rep', () => {
      const { samples: explosiveSamples } = generateExplosiveRep();
      const { samples: normalSamples } = generateNormalRep();

      const explosiveConcentric = explosiveSamples.filter(
        (s) => s.phase === MovementPhase.CONCENTRIC
      );
      const normalConcentric = normalSamples.filter((s) => s.phase === MovementPhase.CONCENTRIC);

      expect(explosiveConcentric.length).toBeLessThan(normalConcentric.length);
    });
  });

  describe('generateNormalRep()', () => {
    it('produces samples with concentric and eccentric phases', () => {
      const { samples } = generateNormalRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('has peak velocity in normal range', () => {
      const { samples } = generateNormalRep();
      const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);
      const peakVelocity = Math.max(...concentricSamples.map((s) => s.velocity));

      expect(peakVelocity).toBeGreaterThanOrEqual(0.5);
      expect(peakVelocity).toBeLessThanOrEqual(0.85);
    });
  });

  describe('generateFatiguingRep()', () => {
    it('produces samples with concentric and eccentric phases', () => {
      const { samples } = generateFatiguingRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('has lower peak velocity than normal rep', () => {
      const { samples: fatiguingSamples } = generateFatiguingRep();
      const { samples: normalSamples } = generateNormalRep();

      const fatiguingPeak = Math.max(
        ...fatiguingSamples
          .filter((s) => s.phase === MovementPhase.CONCENTRIC)
          .map((s) => s.velocity)
      );
      const normalPeak = Math.max(
        ...normalSamples.filter((s) => s.phase === MovementPhase.CONCENTRIC).map((s) => s.velocity)
      );

      expect(fatiguingPeak).toBeLessThan(normalPeak);
    });
  });

  describe('generateGrindingRep()', () => {
    it('produces samples with concentric and eccentric phases', () => {
      const { samples } = generateGrindingRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('has very low peak velocity', () => {
      const { samples } = generateGrindingRep();
      const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);
      const peakVelocity = Math.max(...concentricSamples.map((s) => s.velocity));

      expect(peakVelocity).toBeGreaterThanOrEqual(0.15);
      expect(peakVelocity).toBeLessThanOrEqual(0.5);
    });

    it('has longer concentric duration (grinding)', () => {
      const { samples: grindingSamples } = generateGrindingRep();
      const { samples: normalSamples } = generateNormalRep();

      const grindingConcentric = grindingSamples.filter(
        (s) => s.phase === MovementPhase.CONCENTRIC
      );
      const normalConcentric = normalSamples.filter((s) => s.phase === MovementPhase.CONCENTRIC);

      expect(grindingConcentric.length).toBeGreaterThan(normalConcentric.length);
    });
  });

  describe('generateFailedRep()', () => {
    it('does NOT produce a complete rep (no eccentric phase)', () => {
      const { samples } = generateFailedRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(false);
    });

    it('has no eccentric samples', () => {
      const { samples } = generateFailedRep();
      const eccentricSamples = samples.filter((s) => s.phase === MovementPhase.ECCENTRIC);

      expect(eccentricSamples.length).toBe(0);
    });

    it('ends in IDLE phase (gave up)', () => {
      const { samples } = generateFailedRep();
      const lastSample = samples[samples.length - 1];

      expect(lastSample.phase).toBe(MovementPhase.IDLE);
    });

    it('velocity drops to near zero during concentric', () => {
      const { samples } = generateFailedRep();
      const concentricSamples = samples.filter((s) => s.phase === MovementPhase.CONCENTRIC);

      // Last few concentric samples should have very low velocity
      const lastConcentricVelocities = concentricSamples.slice(-3).map((s) => s.velocity);
      const minVelocity = Math.min(...lastConcentricVelocities);

      expect(minVelocity).toBeLessThan(0.1);
    });
  });

  describe('generatePartialRep()', () => {
    it('produces samples with concentric and eccentric phases', () => {
      const { samples } = generatePartialRep();
      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('has reduced range of motion', () => {
      const { samples: partialSamples } = generatePartialRep();
      const { samples: normalSamples } = generateNormalRep();

      const partialMaxPosition = Math.max(
        ...partialSamples.filter((s) => s.phase !== MovementPhase.IDLE).map((s) => s.position)
      );
      const normalMaxPosition = Math.max(
        ...normalSamples.filter((s) => s.phase !== MovementPhase.IDLE).map((s) => s.position)
      );

      expect(partialMaxPosition).toBeLessThan(normalMaxPosition);
      expect(partialMaxPosition).toBeLessThanOrEqual(0.8);
    });
  });

  describe('generateRepSamples() unified entry point', () => {
    const behaviors: RepBehavior[] = ['explosive', 'normal', 'fatiguing', 'grinding', 'partial'];

    it.each(behaviors)('generates valid samples for %s behavior', (behavior) => {
      const { samples } = generateRepSamples(behavior);
      const phases = new Set(samples.map((s) => s.phase));

      // All behaviors except 'failed' should have both concentric and eccentric
      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('failed behavior produces no eccentric phase', () => {
      const { samples } = generateRepSamples('failed');
      const eccentricSamples = samples.filter((s) => s.phase === MovementPhase.ECCENTRIC);

      expect(eccentricSamples.length).toBe(0);
    });
  });
});

// =============================================================================
// Physics Constants Validation
// =============================================================================

describe('Rep Behavior Physics Constants', () => {
  it('explosive has highest peak velocity', () => {
    const { explosive, normal, fatiguing, grinding } = REP_BEHAVIOR_PHYSICS;

    expect(explosive.peakVelocity).toBeGreaterThan(normal.peakVelocity);
    expect(normal.peakVelocity).toBeGreaterThan(fatiguing.peakVelocity);
    expect(fatiguing.peakVelocity).toBeGreaterThan(grinding.peakVelocity);
  });

  it('explosive has shortest concentric duration', () => {
    const { explosive, normal, fatiguing, grinding } = REP_BEHAVIOR_PHYSICS;

    expect(explosive.concentricDuration).toBeLessThan(normal.concentricDuration);
    expect(normal.concentricDuration).toBeLessThan(fatiguing.concentricDuration);
    expect(fatiguing.concentricDuration).toBeLessThan(grinding.concentricDuration);
  });
});

// =============================================================================
// Set Composition Validation
// =============================================================================

describe('Set Composition Fixtures', () => {
  describe('generateSetFromBehaviors()', () => {
    it('generates correct number of completed reps', () => {
      const behaviors: RepBehavior[] = ['normal', 'normal', 'fatiguing'];
      const { completedRepCount } = generateSetFromBehaviors(behaviors);

      expect(completedRepCount).toBe(3); // All complete
    });

    it('failed rep in composition does not count as completed', () => {
      const behaviors: RepBehavior[] = ['normal', 'normal', 'failed'];
      const { completedRepCount } = generateSetFromBehaviors(behaviors);

      expect(completedRepCount).toBe(2); // Failed doesn't count
    });

    it('produces samples with correct phases', () => {
      const { samples } = generateSetFromBehaviors(['normal', 'normal']);

      const phases = new Set(samples.map((s) => s.phase));

      expect(phases.has(MovementPhase.IDLE)).toBe(true);
      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('processes through aggregators when requested', () => {
      const { set, completedRepCount } = generateSetFromBehaviors(['normal', 'normal', 'normal'], {
        processWithAggregators: true,
        weight: 100,
      });

      expect(set).toBeDefined();
      expect(set!.data.reps.length).toBe(completedRepCount);
      expect(set!.weight).toBe(100);
    });
  });

  describe('setPresets', () => {
    it('warmupEasy has all explosive reps', () => {
      expect(setPresets.warmupEasy.every((b) => b === 'explosive')).toBe(true);
    });

    it('toFailure ends with failed rep', () => {
      expect(setPresets.toFailure[setPresets.toFailure.length - 1]).toBe('failed');
    });

    it('toFailure has reasonable progression', () => {
      const { toFailure } = setPresets;

      // Should start with normal/easy reps and progress to harder
      expect(toFailure[0]).toBe('normal');
      expect(toFailure.includes('fatiguing')).toBe(true);
      expect(toFailure.includes('grinding')).toBe(true);
    });
  });

  describe('sets convenience functions', () => {
    it('warmupEasy generates explosive set at given weight', () => {
      const { completedRepCount, behaviors } = sets.warmupEasy(50);

      expect(completedRepCount).toBe(5);
      expect(behaviors.every((b) => b === 'explosive')).toBe(true);
    });

    it('toFailure generates set ending in failure', () => {
      const { completedRepCount, behaviors } = sets.toFailure(100);

      // Should have 7 completed reps (last one fails)
      expect(completedRepCount).toBe(7);
      expect(behaviors[behaviors.length - 1]).toBe('failed');
    });
  });
});

// Note: Rep detection is now internal to the @voltras/workout-analytics library pipeline.
// The library's createSet/addSampleToSet/completeSet functions handle rep detection internally.
