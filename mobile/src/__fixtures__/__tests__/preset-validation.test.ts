/**
 * Preset Validation Tests
 *
 * Validates that set and session presets produce expected metrics.
 * These tests ensure presets model realistic workout scenarios.
 */

import { describe, it, expect } from 'vitest';
import { getRepMeanVelocity } from '@voltras/workout-analytics';
import { generateSetFromBehaviors, setPresets } from '../generators/set-compositions';
import {
  generateSessionFromComposition,
  sessionPresets,
  sessions,
} from '../generators/session-compositions';
import {
  generatePlanningContext,
  generateHistoricalMetrics,
  generateSessionMetrics,
  generateDiscoverySequence,
  generateLoadVelocityProfile,
} from '../generators/planning-fixtures';
import { TrainingGoal, TrainingLevel } from '@/domain/planning';

// =============================================================================
// Set Preset Validation
// =============================================================================

describe('Set Preset Validation', () => {
  describe('warmupEasy preset', () => {
    it('produces 5 completed reps', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.warmupEasy);
      expect(completedRepCount).toBe(5);
    });

    it('no failed reps', () => {
      const { behaviors } = generateSetFromBehaviors(setPresets.warmupEasy);
      expect(behaviors.includes('failed')).toBe(false);
    });
  });

  describe('productiveWorking preset', () => {
    it('produces 7 completed reps', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.productiveWorking);
      expect(completedRepCount).toBe(7);
    });

    it('shows velocity progression (explosive -> grinding)', () => {
      const { set } = generateSetFromBehaviors(setPresets.productiveWorking, {
        processWithAggregators: true,
        weight: 100,
      });

      expect(set).toBeDefined();
      if (set) {
        const velocities = set.data.reps.map((r) => getRepMeanVelocity(r));

        // First rep should be faster than last rep
        expect(velocities[0]).toBeGreaterThan(velocities[velocities.length - 1]);
      }
    });
  });

  describe('toFailure preset', () => {
    it('produces 7 completed reps (last one fails)', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.toFailure);
      expect(completedRepCount).toBe(7);
    });

    it('ends with failed behavior', () => {
      const { behaviors } = generateSetFromBehaviors(setPresets.toFailure);
      expect(behaviors[behaviors.length - 1]).toBe('failed');
    });

    it('shows significant velocity loss', () => {
      const { set } = generateSetFromBehaviors(setPresets.toFailure, {
        processWithAggregators: true,
        weight: 100,
      });

      expect(set).toBeDefined();
      if (set && set.data.reps.length >= 2) {
        const reps = set.data.reps;
        const firstRepVelocity = getRepMeanVelocity(reps[0]);
        const lastRepVelocity = getRepMeanVelocity(reps[reps.length - 1]);
        const velocityLoss = (firstRepVelocity - lastRepVelocity) / firstRepVelocity;

        // Should show meaningful velocity loss (>20%)
        expect(velocityLoss).toBeGreaterThan(0.2);
      }
    });
  });

  describe('junkVolume preset', () => {
    it('produces only 3 completed reps', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.junkVolume);
      expect(completedRepCount).toBe(3);
    });

    it('all non-failed reps are grinding', () => {
      const { behaviors } = generateSetFromBehaviors(setPresets.junkVolume);
      const nonFailed = behaviors.filter((b) => b !== 'failed');
      expect(nonFailed.every((b) => b === 'grinding')).toBe(true);
    });
  });

  describe('tooHeavy preset', () => {
    it('produces only 1 completed rep before failure', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.tooHeavy);
      expect(completedRepCount).toBe(1);
    });
  });

  describe('tooLight preset', () => {
    it('produces 10 completed reps', () => {
      const { completedRepCount } = generateSetFromBehaviors(setPresets.tooLight);
      expect(completedRepCount).toBe(10);
    });

    it('all reps are explosive', () => {
      const { behaviors } = generateSetFromBehaviors(setPresets.tooLight);
      expect(behaviors.every((b) => b === 'explosive')).toBe(true);
    });
  });
});

// =============================================================================
// Session Preset Validation
// =============================================================================

describe('Session Preset Validation', () => {
  describe('standardWorkout preset', () => {
    it('produces 5 sets total', () => {
      const { session } = generateSessionFromComposition(sessionPresets.standardWorkout, {
        workingWeight: 100,
      });

      expect(session.completedSets.length).toBe(5);
    });

    it('has 2 warmup sets and 3 working sets', () => {
      const { plan } = generateSessionFromComposition(sessionPresets.standardWorkout, {
        workingWeight: 100,
      });

      const warmupSets = plan.sets.filter((s) => s.isWarmup);
      const workingSets = plan.sets.filter((s) => !s.isWarmup);

      expect(warmupSets.length).toBe(2);
      expect(workingSets.length).toBe(3);
    });

    it('working sets are at 85% working weight', () => {
      const workingWeight = 100;
      const { plan } = generateSessionFromComposition(sessionPresets.standardWorkout, {
        workingWeight,
      });

      const workingSets = plan.sets.filter((s) => !s.isWarmup);

      // All working sets should be at 85% (rounded to nearest 5)
      const expectedWeight = Math.round((workingWeight * 0.85) / 5) * 5; // 85
      workingSets.forEach((set) => {
        expect(set.weight).toBe(expectedWeight);
      });
    });

    it('warmup weights progress correctly', () => {
      const workingWeight = 100;
      const { plan } = generateSessionFromComposition(sessionPresets.standardWorkout, {
        workingWeight,
      });

      const warmupSets = plan.sets.filter((s) => s.isWarmup);

      // First warmup at 50%, second at 75%
      expect(warmupSets[0].weight).toBe(50); // 50% of 100
      expect(warmupSets[1].weight).toBe(75); // 75% of 100
    });
  });

  describe('discoverySession preset', () => {
    it('is marked as discovery session', () => {
      const { session } = generateSessionFromComposition(sessionPresets.discoverySession, {
        workingWeight: 100,
        isDiscovery: true,
      });

      expect(session.plan.generatedBy).toBe('discovery');
    });

    it('has progressive weight increases', () => {
      const { plan } = generateSessionFromComposition(sessionPresets.discoverySession, {
        workingWeight: 100,
      });

      const weights = plan.sets.map((s) => s.weight);

      // Weights should increase progressively
      for (let i = 1; i < weights.length; i++) {
        expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
      }
    });
  });

  describe('junkVolumeSession preset', () => {
    it('produces session with junk volume pattern', () => {
      const { session } = generateSessionFromComposition(sessionPresets.junkVolumeSession, {
        workingWeight: 100,
      });

      expect(session.completedSets.length).toBe(3);

      // Later sets should have fewer reps (rep drop)
      const repCounts = session.completedSets.map((s) => s.data.reps.length);

      // First two sets should be productive, last should show drop
      expect(repCounts[2]).toBeLessThan(repCounts[0]);
    });
  });

  describe('sessions convenience functions', () => {
    it('sessions.standard() creates standard workout', () => {
      const { session, plan } = sessions.standard(100);

      expect(session.completedSets.length).toBe(5);
      expect(plan.generatedBy).toBe('standard');
    });

    it('sessions.discovery() creates discovery session', () => {
      const { plan } = sessions.discovery(100);

      expect(plan.generatedBy).toBe('discovery');
    });

    it('sessions.strength() uses strength goal', () => {
      const { plan } = sessions.strength(100);

      expect(plan.goal).toBe(TrainingGoal.STRENGTH);
    });
  });
});

// =============================================================================
// Planning Fixtures Validation
// =============================================================================

describe('Planning Fixtures Validation', () => {
  describe('generatePlanningContext()', () => {
    it('creates valid planning context with defaults', () => {
      const context = generatePlanningContext();

      expect(context.exerciseId).toBe('test_exercise');
      expect(context.goal).toBe(TrainingGoal.HYPERTROPHY);
      expect(context.level).toBe(TrainingLevel.INTERMEDIATE);
      expect(context.exerciseType).toBe('compound');
      expect(context.completedSets).toEqual([]);
      expect(context.isDiscovery).toBe(false);
    });

    it('accepts custom options', () => {
      const context = generatePlanningContext({
        exerciseId: 'custom_exercise',
        goal: TrainingGoal.STRENGTH,
        level: TrainingLevel.ADVANCED,
        exerciseType: 'isolation',
        isDiscovery: true,
      });

      expect(context.exerciseId).toBe('custom_exercise');
      expect(context.goal).toBe(TrainingGoal.STRENGTH);
      expect(context.level).toBe(TrainingLevel.ADVANCED);
      expect(context.exerciseType).toBe('isolation');
      expect(context.isDiscovery).toBe(true);
    });

    it('resolves session metrics from options', () => {
      const context = generatePlanningContext({
        sessionMetrics: { fatigueLevel: 0.5 },
      });

      expect(context.sessionMetrics).not.toBeNull();
      expect(context.sessionMetrics!.fatigue.level).toBe(0.5);
    });

    it('resolves historical metrics from options', () => {
      const context = generatePlanningContext({
        historicalMetrics: { lastWorkingWeight: 150 },
      });

      expect(context.historicalMetrics).not.toBeNull();
      expect(context.historicalMetrics!.lastWorkingWeight).toBe(150);
    });
  });

  describe('generateHistoricalMetrics()', () => {
    it('creates metrics with reasonable defaults', () => {
      const metrics = generateHistoricalMetrics();

      expect(metrics.recentEstimated1RM).toBe(150);
      expect(metrics.lastWorkingWeight).toBe(100);
      expect(metrics.sessionCount).toBe(5);
      expect(metrics.trend).toBe('stable');
    });

    it('creates velocity baseline', () => {
      const metrics = generateHistoricalMetrics();

      expect(metrics.velocityBaseline).not.toBeNull();
      expect(Object.keys(metrics.velocityBaseline!).length).toBeGreaterThan(0);
    });
  });

  describe('generateSessionMetrics()', () => {
    it('creates metrics with reasonable defaults', () => {
      const metrics = generateSessionMetrics();

      expect(metrics.strength.estimated1RM).toBe(150);
      expect(metrics.readiness.zone).toBe('green');
      expect(metrics.fatigue.level).toBe(0.3);
      expect(metrics.volumeAccumulated).toBe(2000);
    });

    it('respects fatigue parameters', () => {
      const metrics = generateSessionMetrics({
        fatigueLevel: 0.8,
        isJunkVolume: true,
      });

      expect(metrics.fatigue.level).toBe(0.8);
      expect(metrics.fatigue.isJunkVolume).toBe(true);
    });

    it('respects readiness zone', () => {
      const metrics = generateSessionMetrics({ readinessZone: 'red' });

      expect(metrics.readiness.zone).toBe('red');
      expect(metrics.readiness.adjustments.weight).toBeLessThan(0);
    });
  });
});

// =============================================================================
// Discovery Fixtures Validation
// =============================================================================

describe('Discovery Fixtures Validation', () => {
  describe('generateDiscoverySequence()', () => {
    it('produces progressive weights', () => {
      const sequence = generateDiscoverySequence(40, 100, 4);

      expect(sequence.length).toBe(4);

      const weights = sequence.map((s) => s.weight);
      for (let i = 1; i < weights.length; i++) {
        expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
      }
    });

    it('velocity decreases with weight', () => {
      const sequence = generateDiscoverySequence(40, 100, 4);

      const velocities = sequence.map((s) => s.meanVelocity);
      for (let i = 1; i < velocities.length; i++) {
        expect(velocities[i]).toBeLessThanOrEqual(velocities[i - 1]);
      }
    });

    it('no failures in normal sequence', () => {
      const sequence = generateDiscoverySequence(40, 100, 4);

      expect(sequence.every((s) => !s.failed)).toBe(true);
    });
  });

  describe('generateLoadVelocityProfile()', () => {
    it('produces valid profile structure', () => {
      const profile = generateLoadVelocityProfile();

      expect(profile.dataPoints.length).toBeGreaterThan(0);
      expect(profile.slope).toBeLessThan(0); // Negative slope (velocity decreases with load)
      expect(profile.estimated1RM).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(profile.confidence);
    });

    it('high confidence has more data points', () => {
      const high = generateLoadVelocityProfile({ confidence: 'high', dataPointCount: 6 });
      const low = generateLoadVelocityProfile({ confidence: 'low', dataPointCount: 2 });

      expect(high.dataPoints.length).toBeGreaterThan(low.dataPoints.length);
    });

    it('velocity decreases with weight in data points', () => {
      const profile = generateLoadVelocityProfile();

      const sortedPoints = [...profile.dataPoints].sort((a, b) => a.weight - b.weight);

      for (let i = 1; i < sortedPoints.length; i++) {
        expect(sortedPoints[i].velocity).toBeLessThanOrEqual(sortedPoints[i - 1].velocity);
      }
    });
  });
});

// =============================================================================
// Volume Calculations
// =============================================================================

describe('Volume Calculations', () => {
  it('calculates total volume correctly', () => {
    const { totalVolume, session } = sessions.standard(100);

    // Verify volume calculation
    let expectedVolume = 0;
    for (const set of session.completedSets) {
      expectedVolume += set.weight * set.data.reps.length;
    }

    expect(totalVolume).toBe(expectedVolume);
  });

  it('calculates total reps correctly', () => {
    const { totalReps, session } = sessions.standard(100);

    let expectedReps = 0;
    for (const set of session.completedSets) {
      expectedReps += set.data.reps.length;
    }

    expect(totalReps).toBe(expectedReps);
  });
});
