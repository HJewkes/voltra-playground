/**
 * Readiness Assessment Tests
 *
 * Tests for warmup velocity readiness check logic.
 */

import { describe, it, expect } from 'vitest';
import {
  assessReadiness,
  assessReadinessAuto,
  applyReadinessWeightAdjustment,
  deriveIntensityAdjustment,
  isReadinessCheckCandidate,
} from '../readiness';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';
import type { VelocityBaseline } from '@/domain/history/models';

// =============================================================================
// Test Helpers
// =============================================================================

function createBaseline(
  exerciseId: string,
  dataPoints: Array<{ weight: number; velocity: number }>,
): VelocityBaseline {
  return {
    exerciseId,
    dataPoints: dataPoints.map((dp) => ({
      ...dp,
      timestamp: Date.now(),
    })),
    lastUpdated: Date.now(),
  };
}

// =============================================================================
// deriveIntensityAdjustment
// =============================================================================

describe('deriveIntensityAdjustment()', () => {
  it('returns no change for green zone', () => {
    const result = deriveIntensityAdjustment('green', 0.98);
    expect(result.loadMultiplier).toBe(1.0);
    expect(result.suggestion).toContain('proceed as planned');
  });

  it('suggests 5% reduction for yellow zone', () => {
    const result = deriveIntensityAdjustment('yellow', 0.9);
    expect(result.loadMultiplier).toBe(0.95);
    expect(result.suggestion).toContain('reducing load 5%');
    expect(result.suggestion).toContain('10%');
  });

  it('suggests 10% reduction for red zone', () => {
    const result = deriveIntensityAdjustment('red', 0.8);
    expect(result.loadMultiplier).toBe(0.9);
    expect(result.suggestion).toContain('reduce load 10%');
    expect(result.suggestion).toContain('20%');
  });
});

// =============================================================================
// assessReadiness
// =============================================================================

describe('assessReadiness()', () => {
  it('returns green when velocity matches baseline', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadiness(set, baseline);

    expect(result).not.toBeNull();
    expect(result!.estimate.zone).toBe('green');
    expect(result!.estimate.velocityRatio).toBeCloseTo(1.0, 1);
    expect(result!.hasBaseline).toBe(true);
    expect(result!.adjustment.loadMultiplier).toBe(1.0);
  });

  it('returns yellow when velocity is 90% of baseline', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.54, 0.5] });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadiness(set, baseline);

    expect(result).not.toBeNull();
    expect(result!.estimate.zone).toBe('yellow');
    expect(result!.adjustment.loadMultiplier).toBe(0.95);
  });

  it('returns red when velocity is well below baseline', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.48, 0.44] });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadiness(set, baseline);

    expect(result).not.toBeNull();
    expect(result!.estimate.zone).toBe('red');
    expect(result!.adjustment.loadMultiplier).toBe(0.9);
  });

  it('returns null when set has no reps', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 0 });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadiness(set, baseline);
    expect(result).toBeNull();
  });

  it('returns low-confidence result when baseline has no data', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] });
    const baseline = createBaseline('bench', []);

    const result = assessReadiness(set, baseline);

    expect(result).not.toBeNull();
    expect(result!.hasBaseline).toBe(false);
    expect(result!.estimate.confidence).toBe(0);
    expect(result!.adjustment.suggestion).toContain('No baseline data');
  });

  it('interpolates baseline velocity for intermediate weights', () => {
    const set = mockCompletedSet({ weight: 150, velocities: [0.5, 0.45] });
    const baseline = createBaseline('bench', [
      { weight: 135, velocity: 0.6 },
      { weight: 185, velocity: 0.4 },
    ]);

    const result = assessReadiness(set, baseline);

    expect(result).not.toBeNull();
    expect(result!.hasBaseline).toBe(true);
    // 150 is 30% between 135 and 185, so expected ~0.54
    // actual is 0.5, ratio ~0.93 -> yellow
    expect(result!.estimate.zone).toBe('yellow');
  });
});

// =============================================================================
// isReadinessCheckCandidate
// =============================================================================

describe('isReadinessCheckCandidate()', () => {
  it('returns true for first set with reps and baseline', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 3 });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    expect(isReadinessCheckCandidate(0, set, baseline)).toBe(true);
  });

  it('returns false for non-first sets', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 3 });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    expect(isReadinessCheckCandidate(1, set, baseline)).toBe(false);
    expect(isReadinessCheckCandidate(2, set, baseline)).toBe(false);
  });

  it('returns false when set has no reps', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 0 });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    expect(isReadinessCheckCandidate(0, set, baseline)).toBe(false);
  });

  it('returns false when no baseline data exists', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 3 });

    expect(isReadinessCheckCandidate(0, set, null)).toBe(false);
    expect(isReadinessCheckCandidate(0, set, createBaseline('bench', []))).toBe(false);
  });
});

// =============================================================================
// assessReadinessAuto
// =============================================================================


describe('assessReadinessAuto()', () => {
  it('returns seeded result with no zone comparison when baseline is null', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] });

    const result = assessReadinessAuto(set, null);

    expect(result.seededBaseline).toBe(true);
    expect(result.seededDataPoint).toEqual({ weight: 135, velocity: 0.6 });
    expect(result.assessment).not.toBeNull();
    expect(result.assessment!.hasBaseline).toBe(false);
    expect(result.assessment!.adjustment.suggestion).toContain('baseline saved');
  });

  it('returns seeded result when baseline has no data points', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] });
    const baseline = createBaseline('bench', []);

    const result = assessReadinessAuto(set, baseline);

    expect(result.seededBaseline).toBe(true);
    expect(result.seededDataPoint).not.toBeNull();
    expect(result.seededDataPoint!.weight).toBe(135);
  });

  it('returns null assessment when set has no measurable velocity', () => {
    const set = mockCompletedSet({ weight: 135, repCount: 0 });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadinessAuto(set, baseline);

    expect(result.assessment).toBeNull();
    expect(result.seededBaseline).toBe(false);
  });

  it('delegates to assessReadiness when baseline has data', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadinessAuto(set, baseline);

    expect(result.seededBaseline).toBe(false);
    expect(result.seededDataPoint).toBeNull();
    expect(result.assessment).not.toBeNull();
    expect(result.assessment!.hasBaseline).toBe(true);
    expect(result.assessment!.estimate.zone).toBe('green');
  });

  it('returns red zone when velocity is well below baseline', () => {
    const set = mockCompletedSet({ weight: 135, velocities: [0.48, 0.44] });
    const baseline = createBaseline('bench', [{ weight: 135, velocity: 0.6 }]);

    const result = assessReadinessAuto(set, baseline);

    expect(result.assessment!.estimate.zone).toBe('red');
    expect(result.seededBaseline).toBe(false);
  });
});

// =============================================================================
// applyReadinessWeightAdjustment
// =============================================================================

describe('applyReadinessWeightAdjustment()', () => {
  it('returns current weight unchanged for green zone', () => {
    const assessment = {
      estimate: { zone: 'green' as const, velocityRatio: 0.98, confidence: 0.9 },
      adjustment: { loadMultiplier: 1.0, suggestion: 'proceed as planned' },
      hasBaseline: true,
    };

    expect(applyReadinessWeightAdjustment(200, assessment)).toBe(200);
  });

  it('returns current weight unchanged for yellow zone', () => {
    const assessment = {
      estimate: { zone: 'yellow' as const, velocityRatio: 0.9, confidence: 0.8 },
      adjustment: { loadMultiplier: 0.95, suggestion: 'consider reducing 5%' },
      hasBaseline: true,
    };

    expect(applyReadinessWeightAdjustment(200, assessment)).toBe(200);
  });

  it('reduces weight by 10% and rounds to nearest 5 lbs for red zone', () => {
    const assessment = {
      estimate: { zone: 'red' as const, velocityRatio: 0.8, confidence: 0.7 },
      adjustment: { loadMultiplier: 0.9, suggestion: 'reduce load 10%' },
      hasBaseline: true,
    };

    // 200 * 0.9 = 180 → rounds to 180
    expect(applyReadinessWeightAdjustment(200, assessment)).toBe(180);
  });

  it('rounds to nearest 5 lbs', () => {
    const assessment = {
      estimate: { zone: 'red' as const, velocityRatio: 0.75, confidence: 0.7 },
      adjustment: { loadMultiplier: 0.9, suggestion: 'reduce load 10%' },
      hasBaseline: true,
    };

    // 155 * 0.9 = 139.5 → rounds to 140
    expect(applyReadinessWeightAdjustment(155, assessment)).toBe(140);
  });

  it('floors at 45 lbs (empty bar) for very light starting weight', () => {
    const assessment = {
      estimate: { zone: 'red' as const, velocityRatio: 0.75, confidence: 0.7 },
      adjustment: { loadMultiplier: 0.9, suggestion: 'reduce load 10%' },
      hasBaseline: true,
    };

    expect(applyReadinessWeightAdjustment(45, assessment)).toBe(45);
  });
});
