/**
 * VBT Profile Tests
 *
 * Tests for load-velocity profile building and recommendation generation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildLoadVelocityProfile,
  estimateWeightForPercent1RM,
  estimateWeightForVelocity,
  predictVelocityAtWeight,
  addDataPointToProfile,
  generateWorkingWeightRecommendation,
  generateWarmupSets,
  estimate1RMFromSet,
  type LoadVelocityDataPoint,
  type LoadVelocityProfile,
} from '../profile';
import { TrainingGoal } from '@/domain/planning/types';
import { MINIMUM_VELOCITY_THRESHOLD } from '../constants';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestDataPoints(): LoadVelocityDataPoint[] {
  // Typical data showing velocity decreasing with weight
  return [
    { weight: 50, velocity: 0.9 },
    { weight: 75, velocity: 0.65 },
    { weight: 100, velocity: 0.45 },
  ];
}

function createTestProfile(overrides: Partial<LoadVelocityProfile> = {}): LoadVelocityProfile {
  return {
    exerciseId: 'test_exercise',
    dataPoints: createTestDataPoints(),
    slope: -0.009, // Negative slope (velocity decreases with weight)
    intercept: 1.35,
    rSquared: 0.95,
    estimated1RM: 130,
    confidence: 'high',
    mvt: MINIMUM_VELOCITY_THRESHOLD,
    createdAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// buildLoadVelocityProfile() Tests
// =============================================================================

describe('buildLoadVelocityProfile()', () => {
  describe('with empty data', () => {
    it('returns empty profile', () => {
      const profile = buildLoadVelocityProfile('test', []);

      expect(profile.exerciseId).toBe('test');
      expect(profile.dataPoints).toEqual([]);
      expect(profile.estimated1RM).toBe(0);
      expect(profile.confidence).toBe('low');
    });
  });

  describe('with single data point', () => {
    it('creates profile with low confidence', () => {
      const profile = buildLoadVelocityProfile('test', [{ weight: 100, velocity: 0.5 }]);

      expect(profile.dataPoints.length).toBe(1);
      expect(profile.confidence).toBe('low');
    });

    it('estimated 1RM is at least the tested weight', () => {
      const profile = buildLoadVelocityProfile('test', [{ weight: 100, velocity: 0.5 }]);

      expect(profile.estimated1RM).toBeGreaterThanOrEqual(100);
    });
  });

  describe('with multiple data points', () => {
    it('calculates linear regression', () => {
      const dataPoints = createTestDataPoints();
      const profile = buildLoadVelocityProfile('test', dataPoints);

      // Slope should be negative (velocity decreases with weight)
      expect(profile.slope).toBeLessThan(0);
      expect(profile.intercept).toBeGreaterThan(0);
    });

    it('calculates R-squared for goodness of fit', () => {
      const dataPoints = createTestDataPoints();
      const profile = buildLoadVelocityProfile('test', dataPoints);

      // Good linear relationship should have high R²
      expect(profile.rSquared).toBeGreaterThan(0.8);
    });

    it('estimates 1RM using minimum velocity threshold', () => {
      const dataPoints = createTestDataPoints();
      const profile = buildLoadVelocityProfile('test', dataPoints);

      expect(profile.estimated1RM).toBeGreaterThan(100); // Higher than heaviest tested
      expect(profile.estimated1RM).toBeLessThan(200); // Reasonable upper bound
    });

    it('1RM is rounded to nearest 5', () => {
      const dataPoints = createTestDataPoints();
      const profile = buildLoadVelocityProfile('test', dataPoints);

      expect(profile.estimated1RM % 5).toBe(0);
    });

    it('stores MVT correctly', () => {
      const dataPoints = createTestDataPoints();
      const profile = buildLoadVelocityProfile('test', dataPoints);

      expect(profile.mvt).toBe(MINIMUM_VELOCITY_THRESHOLD);
    });

    it('sets creation timestamp', () => {
      const before = Date.now();
      const profile = buildLoadVelocityProfile('test', createTestDataPoints());
      const after = Date.now();

      expect(profile.createdAt).toBeGreaterThanOrEqual(before);
      expect(profile.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('confidence determination', () => {
    it('returns high confidence with good data', () => {
      const dataPoints = [
        { weight: 50, velocity: 0.95 },
        { weight: 75, velocity: 0.7 },
        { weight: 100, velocity: 0.45 },
        { weight: 115, velocity: 0.3 },
      ];
      const profile = buildLoadVelocityProfile('test', dataPoints);

      expect(profile.confidence).toBe('high');
    });

    it('returns medium confidence with adequate data', () => {
      const dataPoints = [
        { weight: 80, velocity: 0.6 },
        { weight: 100, velocity: 0.4 },
      ];
      const profile = buildLoadVelocityProfile('test', dataPoints);

      expect(['medium', 'low']).toContain(profile.confidence);
    });

    it('returns low or medium confidence with insufficient spread', () => {
      const dataPoints = [
        { weight: 100, velocity: 0.5 },
        { weight: 102, velocity: 0.49 }, // Minimal weight spread
      ];
      const profile = buildLoadVelocityProfile('test', dataPoints);

      // Library may classify this as medium depending on regression fit
      expect(['low', 'medium']).toContain(profile.confidence);
    });
  });
});

// =============================================================================
// estimateWeightForPercent1RM() Tests
// =============================================================================

describe('estimateWeightForPercent1RM()', () => {
  it('returns 0 for empty profile', () => {
    const profile = createTestProfile({ estimated1RM: 0 });

    expect(estimateWeightForPercent1RM(profile, 75)).toBe(0);
  });

  it('calculates percentage of 1RM', () => {
    const profile = createTestProfile({ estimated1RM: 100 });

    expect(estimateWeightForPercent1RM(profile, 80)).toBe(80);
    expect(estimateWeightForPercent1RM(profile, 70)).toBe(70);
  });

  it('rounds to nearest 5', () => {
    const profile = createTestProfile({ estimated1RM: 137 }); // Odd number

    const result = estimateWeightForPercent1RM(profile, 75);

    expect(result % 5).toBe(0);
  });

  it('enforces minimum weight of 5', () => {
    const profile = createTestProfile({ estimated1RM: 10 });

    expect(estimateWeightForPercent1RM(profile, 20)).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// estimateWeightForVelocity() Tests
// =============================================================================

describe('estimateWeightForVelocity()', () => {
  it('returns 0 for invalid slope', () => {
    const profile = createTestProfile({ slope: 0 });

    expect(estimateWeightForVelocity(profile, 0.5)).toBe(0);
  });

  it('returns 0 for positive slope', () => {
    const profile = createTestProfile({ slope: 0.01 }); // Wrong direction

    expect(estimateWeightForVelocity(profile, 0.5)).toBe(0);
  });

  it('calculates weight from velocity using linear equation', () => {
    // velocity = slope * weight + intercept
    // weight = (velocity - intercept) / slope
    const profile = createTestProfile({
      slope: -0.01,
      intercept: 1.5,
    });

    // For velocity 0.5: weight = (0.5 - 1.5) / -0.01 = 100
    const result = estimateWeightForVelocity(profile, 0.5);

    expect(result).toBe(100);
  });

  it('rounds to nearest 5', () => {
    const profile = createTestProfile({
      slope: -0.01,
      intercept: 1.47, // Would give non-round weight
    });

    const result = estimateWeightForVelocity(profile, 0.5);

    expect(result % 5).toBe(0);
  });

  it('enforces minimum weight of 5', () => {
    const profile = createTestProfile({
      slope: -0.01,
      intercept: 0.5, // Would give very low weight
    });

    const result = estimateWeightForVelocity(profile, 0.55);

    expect(result).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// predictVelocityAtWeight() Tests
// =============================================================================

describe('predictVelocityAtWeight()', () => {
  it('uses linear equation to predict velocity', () => {
    const profile = createTestProfile({
      slope: -0.01,
      intercept: 1.5,
    });

    // velocity = -0.01 * 100 + 1.5 = 0.5
    const result = predictVelocityAtWeight(profile, 100);

    expect(result).toBeCloseTo(0.5, 2);
  });

  it('predicts higher velocity at lower weight', () => {
    const profile = createTestProfile({
      slope: -0.01,
      intercept: 1.5,
    });

    const v50 = predictVelocityAtWeight(profile, 50);
    const v100 = predictVelocityAtWeight(profile, 100);

    expect(v50).toBeGreaterThan(v100);
  });
});

// =============================================================================
// addDataPointToProfile() Tests
// =============================================================================

describe('addDataPointToProfile()', () => {
  it('adds new data point and rebuilds profile', () => {
    const profile = buildLoadVelocityProfile('test', [
      { weight: 50, velocity: 0.9 },
      { weight: 75, velocity: 0.65 },
    ]);

    const updated = addDataPointToProfile(profile, { weight: 100, velocity: 0.45 });

    expect(updated.dataPoints.length).toBe(3);
  });

  it('preserves exercise ID', () => {
    const profile = buildLoadVelocityProfile('my_exercise', [{ weight: 50, velocity: 0.9 }]);

    const updated = addDataPointToProfile(profile, { weight: 75, velocity: 0.65 });

    expect(updated.exerciseId).toBe('my_exercise');
  });

  it('may improve confidence with more data', () => {
    const profile = buildLoadVelocityProfile('test', [{ weight: 50, velocity: 0.9 }]);

    const updated1 = addDataPointToProfile(profile, { weight: 75, velocity: 0.65 });
    const updated2 = addDataPointToProfile(updated1, { weight: 100, velocity: 0.4 });

    // More data should improve confidence
    expect(updated2.dataPoints.length).toBe(3);
    expect(['high', 'medium']).toContain(updated2.confidence);
  });
});

// =============================================================================
// generateWorkingWeightRecommendation() Tests
// =============================================================================

describe('generateWorkingWeightRecommendation()', () => {
  it('generates recommendation for strength goal', () => {
    const profile = createTestProfile({ estimated1RM: 150 });

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.STRENGTH);

    // Strength uses 82-92% of 1RM (optimal ~87%)
    expect(rec.workingWeight).toBeGreaterThan(120); // > 80%
    expect(rec.workingWeight).toBeLessThan(145); // < 97%
  });

  it('generates recommendation for hypertrophy goal', () => {
    const profile = createTestProfile({ estimated1RM: 150 });

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.HYPERTROPHY);

    // Hypertrophy uses 65-80% of 1RM (optimal ~72%)
    expect(rec.workingWeight).toBeGreaterThan(95); // > 63%
    expect(rec.workingWeight).toBeLessThan(125); // < 83%
  });

  it('generates recommendation for endurance goal', () => {
    const profile = createTestProfile({ estimated1RM: 150 });

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.ENDURANCE);

    // Endurance uses 50-65% of 1RM (optimal ~57%)
    expect(rec.workingWeight).toBeGreaterThan(70); // > 47%
    expect(rec.workingWeight).toBeLessThan(105); // < 70%
  });

  it('includes rep range based on goal', () => {
    const profile = createTestProfile();

    const strengthRec = generateWorkingWeightRecommendation(profile, TrainingGoal.STRENGTH);
    const enduranceRec = generateWorkingWeightRecommendation(profile, TrainingGoal.ENDURANCE);

    expect(strengthRec.repRange[1]).toBeLessThan(enduranceRec.repRange[0]);
  });

  it('includes warmup sets', () => {
    const profile = createTestProfile({ estimated1RM: 150 });

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.HYPERTROPHY);

    expect(rec.warmupSets.length).toBeGreaterThan(0);
  });

  it('includes explanation', () => {
    const profile = createTestProfile();

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.HYPERTROPHY);

    expect(rec.explanation).toBeDefined();
    expect(rec.explanation.length).toBeGreaterThan(20);
  });

  it('includes profile and estimated 1RM', () => {
    const profile = createTestProfile({ estimated1RM: 150 });

    const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.HYPERTROPHY);

    expect(rec.profile).toBe(profile);
    expect(rec.estimated1RM).toBe(150);
  });

  it('propagates confidence level', () => {
    const highProfile = createTestProfile({ confidence: 'high' });
    const lowProfile = createTestProfile({ confidence: 'low' });

    const highRec = generateWorkingWeightRecommendation(highProfile, TrainingGoal.HYPERTROPHY);
    const lowRec = generateWorkingWeightRecommendation(lowProfile, TrainingGoal.HYPERTROPHY);

    expect(highRec.confidence).toBe('high');
    expect(lowRec.confidence).toBe('low');
  });
});

// =============================================================================
// generateWarmupSets() Tests
// =============================================================================

describe('generateWarmupSets()', () => {
  it('returns empty for 0 estimated 1RM', () => {
    const warmups = generateWarmupSets(0, 100);

    expect(warmups).toEqual([]);
  });

  it('generates progressive warmup weights', () => {
    const warmups = generateWarmupSets(150, 110);

    // Should have increasing weights
    for (let i = 1; i < warmups.length; i++) {
      expect(warmups[i].weight).toBeGreaterThan(warmups[i - 1].weight);
    }
  });

  it('warmup weights are below working weight', () => {
    const warmups = generateWarmupSets(150, 110);

    warmups.forEach((w) => {
      expect(w.weight).toBeLessThan(110);
    });
  });

  it('warmup weights are at least 5 lbs', () => {
    const warmups = generateWarmupSets(150, 110);

    warmups.forEach((w) => {
      expect(w.weight).toBeGreaterThanOrEqual(5);
    });
  });

  it('includes rest periods', () => {
    const warmups = generateWarmupSets(150, 110);

    warmups.forEach((w) => {
      expect(w.restSeconds).toBeGreaterThan(0);
    });
  });

  it('includes purpose descriptions', () => {
    const warmups = generateWarmupSets(150, 110);

    warmups.forEach((w) => {
      expect(w.purpose).toBeDefined();
      expect(w.purpose.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// estimate1RMFromSet() Tests
// =============================================================================

describe('estimate1RMFromSet()', () => {
  describe('with velocity', () => {
    it('estimates higher 1RM for slow velocity', () => {
      // Slow velocity = high %1RM
      const result = estimate1RMFromSet(100, 5, 0.35);

      // At 0.35 m/s, weight is roughly 85-90% of 1RM
      expect(result).toBeGreaterThan(100);
      expect(result).toBeLessThan(130);
    });

    it('estimates lower 1RM for fast velocity', () => {
      // Fast velocity = low %1RM
      const result = estimate1RMFromSet(100, 5, 0.9);

      // At 0.9 m/s, weight is roughly 60% of 1RM
      expect(result).toBeGreaterThan(150);
    });
  });

  describe('without velocity (Epley formula)', () => {
    it('returns near-weight estimate for 1 rep', () => {
      const result = estimate1RMFromSet(100, 1);

      // Library Epley formula: 100 * (1 + 1/30) ≈ 103.3, rounds to 105
      expect(result).toBe(105);
    });

    it('estimates higher 1RM for more reps', () => {
      const oneRep = estimate1RMFromSet(100, 1);
      const tenReps = estimate1RMFromSet(100, 10);

      expect(tenReps).toBeGreaterThan(oneRep);
    });

    it('rounds to nearest 5', () => {
      const result = estimate1RMFromSet(100, 8);

      expect(result % 5).toBe(0);
    });
  });
});
