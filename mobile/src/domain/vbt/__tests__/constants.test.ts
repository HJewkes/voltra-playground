/**
 * VBT Constants and Utilities Tests
 *
 * Tests for velocity-based training constants and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  VELOCITY_AT_PERCENT_1RM,
  MINIMUM_VELOCITY_THRESHOLD,
  TRAINING_ZONES,
  REP_RANGES,
  VELOCITY_LOSS_TARGETS,
  VELOCITY_RIR_MAP,
  DISCOVERY_START_PERCENTAGES,
  PROFILE_CONFIDENCE_REQUIREMENTS,
  estimatePercent1RMFromVelocity,
  getTargetVelocityForGoal,
  categorizeVelocity,
  suggestNextWeight,
} from '../constants';
import { TrainingGoal } from '@/domain/planning/types';

// =============================================================================
// Constants Tests
// =============================================================================

describe('VELOCITY_AT_PERCENT_1RM', () => {
  it('has 100% as minimum velocity threshold', () => {
    expect(VELOCITY_AT_PERCENT_1RM[100]).toBe(MINIMUM_VELOCITY_THRESHOLD);
  });

  it('velocity decreases as %1RM increases', () => {
    const v50 = VELOCITY_AT_PERCENT_1RM[50];
    const v75 = VELOCITY_AT_PERCENT_1RM[75];
    const v100 = VELOCITY_AT_PERCENT_1RM[100];

    expect(v50).toBeGreaterThan(v75);
    expect(v75).toBeGreaterThan(v100);
  });

  it('has reasonable velocity values', () => {
    // All velocities should be between 0.1 and 1.5 m/s
    Object.values(VELOCITY_AT_PERCENT_1RM).forEach((v) => {
      expect(v).toBeGreaterThan(0.1);
      expect(v).toBeLessThan(1.5);
    });
  });

  it('has common percentages defined', () => {
    expect(VELOCITY_AT_PERCENT_1RM[50]).toBeDefined();
    expect(VELOCITY_AT_PERCENT_1RM[75]).toBeDefined();
    expect(VELOCITY_AT_PERCENT_1RM[85]).toBeDefined();
    expect(VELOCITY_AT_PERCENT_1RM[100]).toBeDefined();
  });
});

describe('TRAINING_ZONES', () => {
  it('has zones for all training goals', () => {
    expect(TRAINING_ZONES[TrainingGoal.STRENGTH]).toBeDefined();
    expect(TRAINING_ZONES[TrainingGoal.HYPERTROPHY]).toBeDefined();
    expect(TRAINING_ZONES[TrainingGoal.ENDURANCE]).toBeDefined();
  });

  it('strength uses highest %1RM range', () => {
    const strength = TRAINING_ZONES[TrainingGoal.STRENGTH];
    const hypertrophy = TRAINING_ZONES[TrainingGoal.HYPERTROPHY];

    expect(strength.min).toBeGreaterThan(hypertrophy.max);
  });

  it('endurance uses lowest %1RM range', () => {
    const endurance = TRAINING_ZONES[TrainingGoal.ENDURANCE];
    const hypertrophy = TRAINING_ZONES[TrainingGoal.HYPERTROPHY];

    expect(endurance.max).toBeLessThanOrEqual(hypertrophy.min);
  });

  it('each zone has min < optimal < max', () => {
    Object.values(TRAINING_ZONES).forEach((zone) => {
      expect(zone.min).toBeLessThan(zone.optimal);
      expect(zone.optimal).toBeLessThan(zone.max);
    });
  });
});

describe('REP_RANGES', () => {
  it('has ranges for all training goals', () => {
    expect(REP_RANGES[TrainingGoal.STRENGTH]).toBeDefined();
    expect(REP_RANGES[TrainingGoal.HYPERTROPHY]).toBeDefined();
    expect(REP_RANGES[TrainingGoal.ENDURANCE]).toBeDefined();
  });

  it('strength has lowest rep range', () => {
    const [, strMax] = REP_RANGES[TrainingGoal.STRENGTH];
    const [hypMin] = REP_RANGES[TrainingGoal.HYPERTROPHY];

    expect(strMax).toBeLessThan(hypMin);
  });

  it('endurance has highest rep range', () => {
    const [, hypMax] = REP_RANGES[TrainingGoal.HYPERTROPHY];
    const [endMin] = REP_RANGES[TrainingGoal.ENDURANCE];

    expect(endMin).toBeGreaterThan(hypMax);
  });
});

describe('VELOCITY_LOSS_TARGETS', () => {
  it('strength has tightest velocity loss target', () => {
    expect(VELOCITY_LOSS_TARGETS.STRENGTH.max).toBeLessThan(VELOCITY_LOSS_TARGETS.HYPERTROPHY.min);
  });

  it('endurance allows most velocity loss', () => {
    expect(VELOCITY_LOSS_TARGETS.ENDURANCE.max).toBeGreaterThan(
      VELOCITY_LOSS_TARGETS.HYPERTROPHY.max
    );
  });

  it('each target has min < max', () => {
    Object.values(VELOCITY_LOSS_TARGETS).forEach((target) => {
      expect(target.min).toBeLessThan(target.max);
    });
  });
});

describe('VELOCITY_RIR_MAP', () => {
  it('RIR decreases as velocity loss increases', () => {
    for (let i = 1; i < VELOCITY_RIR_MAP.length; i++) {
      const [, prevRir] = VELOCITY_RIR_MAP[i - 1];
      const [, currRir] = VELOCITY_RIR_MAP[i];

      expect(currRir).toBeLessThanOrEqual(prevRir);
    }
  });

  it('RPE increases as velocity loss increases', () => {
    for (let i = 1; i < VELOCITY_RIR_MAP.length; i++) {
      const [, , prevRpe] = VELOCITY_RIR_MAP[i - 1];
      const [, , currRpe] = VELOCITY_RIR_MAP[i];

      expect(currRpe).toBeGreaterThanOrEqual(prevRpe);
    }
  });

  it('100% loss maps to RIR 0 and RPE 10', () => {
    const maxEntry = VELOCITY_RIR_MAP.find(([loss]) => loss === 100);

    expect(maxEntry).toBeDefined();
    expect(maxEntry![1]).toBe(0);
    expect(maxEntry![2]).toBe(10);
  });
});

describe('DISCOVERY_START_PERCENTAGES', () => {
  it('starts with low percentage', () => {
    expect(DISCOVERY_START_PERCENTAGES[0]).toBeLessThanOrEqual(35);
  });

  it('ends with higher percentage', () => {
    expect(DISCOVERY_START_PERCENTAGES[DISCOVERY_START_PERCENTAGES.length - 1]).toBeGreaterThan(80);
  });

  it('is sorted in ascending order', () => {
    for (let i = 1; i < DISCOVERY_START_PERCENTAGES.length; i++) {
      expect(DISCOVERY_START_PERCENTAGES[i]).toBeGreaterThan(DISCOVERY_START_PERCENTAGES[i - 1]);
    }
  });
});

describe('PROFILE_CONFIDENCE_REQUIREMENTS', () => {
  it('high confidence has strictest requirements', () => {
    const { high, medium } = PROFILE_CONFIDENCE_REQUIREMENTS;

    expect(high.minPoints).toBeGreaterThan(medium.minPoints);
    expect(high.minRSquared).toBeGreaterThan(medium.minRSquared);
  });

  it('low confidence has minimal requirements', () => {
    const { low } = PROFILE_CONFIDENCE_REQUIREMENTS;

    expect(low.minPoints).toBe(1);
    expect(low.minRSquared).toBe(0);
  });
});

// =============================================================================
// estimatePercent1RMFromVelocity() Tests
// =============================================================================

describe('estimatePercent1RMFromVelocity()', () => {
  it('estimates high %1RM for slow velocity', () => {
    const percent = estimatePercent1RMFromVelocity(0.2);

    expect(percent).toBeGreaterThanOrEqual(90);
  });

  it('estimates low %1RM for fast velocity', () => {
    const percent = estimatePercent1RMFromVelocity(1.1);

    expect(percent).toBeLessThanOrEqual(55);
  });

  it('estimates moderate %1RM for moderate velocity', () => {
    const percent = estimatePercent1RMFromVelocity(0.55);

    // Library uses linear interpolation between reference points
    expect(percent).toBeGreaterThanOrEqual(70);
    expect(percent).toBeLessThanOrEqual(80);
  });

  it('returns interpolated value for intermediate velocity', () => {
    const percent = estimatePercent1RMFromVelocity(0.72);

    // Library interpolates between reference points rather than snapping
    expect(percent).toBeGreaterThanOrEqual(60);
    expect(percent).toBeLessThanOrEqual(70);
  });
});

// =============================================================================
// getTargetVelocityForGoal() Tests
// =============================================================================

describe('getTargetVelocityForGoal()', () => {
  it('returns velocity range for strength', () => {
    const range = getTargetVelocityForGoal(TrainingGoal.STRENGTH);

    expect(range.min).toBeDefined();
    expect(range.max).toBeDefined();
    expect(range.min).toBeLessThan(range.max);
  });

  it('strength has lower velocities than hypertrophy', () => {
    const strength = getTargetVelocityForGoal(TrainingGoal.STRENGTH);
    const hypertrophy = getTargetVelocityForGoal(TrainingGoal.HYPERTROPHY);

    // Higher %1RM = lower velocity, so strength max velocity should be lower
    // Actually, zone.max = highest %1RM which maps to LOWEST velocity
    // zone.min = lowest %1RM which maps to HIGHEST velocity
    // So getTargetVelocityForGoal returns:
    // min = velocity at zone.max (high %1RM = slow)
    // max = velocity at zone.min (low %1RM = fast)
    // Strength uses higher %1RM so lower velocities overall
    expect(strength.min).toBeLessThan(hypertrophy.min);
  });

  it('endurance has higher velocities than hypertrophy', () => {
    const endurance = getTargetVelocityForGoal(TrainingGoal.ENDURANCE);
    const hypertrophy = getTargetVelocityForGoal(TrainingGoal.HYPERTROPHY);

    expect(endurance.max).toBeGreaterThan(hypertrophy.max);
  });
});

// =============================================================================
// categorizeVelocity() Tests
// =============================================================================

describe('categorizeVelocity()', () => {
  it('categorizes > 0.75 as fast', () => {
    expect(categorizeVelocity(0.95)).toBe('fast');
    expect(categorizeVelocity(1.1)).toBe('fast');
    expect(categorizeVelocity(0.8)).toBe('fast');
  });

  it('categorizes ~0.5-0.75 as moderate', () => {
    expect(categorizeVelocity(0.6)).toBe('moderate');
    expect(categorizeVelocity(0.55)).toBe('moderate');
  });

  it('categorizes ~0.31-0.49 as slow', () => {
    expect(categorizeVelocity(0.35)).toBe('slow');
    expect(categorizeVelocity(0.45)).toBe('slow');
  });

  it('categorizes <= 0.3 as grinding', () => {
    expect(categorizeVelocity(0.2)).toBe('grinding');
    expect(categorizeVelocity(0.15)).toBe('grinding');
  });

  it('handles boundary values correctly', () => {
    expect(categorizeVelocity(0.76)).toBe('fast');
    expect(categorizeVelocity(0.75)).toBe('moderate');
    expect(categorizeVelocity(0.5)).toBe('slow');
    expect(categorizeVelocity(0.3)).toBe('grinding');
  });
});

// =============================================================================
// suggestNextWeight() Tests
// =============================================================================

describe('suggestNextWeight()', () => {
  describe('when velocity is above target', () => {
    it('suggests increasing weight', () => {
      const result = suggestNextWeight(100, 1.0, TrainingGoal.HYPERTROPHY);

      expect(result.direction).toBe('up');
      expect(result.weight).toBe(105);
    });

    it('uses custom increment', () => {
      const result = suggestNextWeight(100, 1.0, TrainingGoal.HYPERTROPHY, 10);

      expect(result.weight).toBe(110);
    });
  });

  describe('when velocity is below target', () => {
    it('suggests decreasing weight', () => {
      const result = suggestNextWeight(100, 0.3, TrainingGoal.HYPERTROPHY);

      expect(result.direction).toBe('down');
      expect(result.weight).toBe(95);
    });

    it('enforces minimum weight of 5', () => {
      const result = suggestNextWeight(10, 0.2, TrainingGoal.HYPERTROPHY, 10);

      expect(result.weight).toBeGreaterThanOrEqual(5);
    });
  });

  describe('when velocity is in target range', () => {
    it('suggests keeping same weight', () => {
      // For hypertrophy, target is ~0.62-0.82 m/s based on TRAINING_ZONES
      const result = suggestNextWeight(100, 0.7, TrainingGoal.HYPERTROPHY);

      expect(result.direction).toBe('same');
      expect(result.weight).toBe(100);
    });
  });

  describe('reason messages', () => {
    it('includes velocity in reason', () => {
      const result = suggestNextWeight(100, 0.8, TrainingGoal.STRENGTH);

      expect(result.reason).toContain('0.80');
    });
  });
});
