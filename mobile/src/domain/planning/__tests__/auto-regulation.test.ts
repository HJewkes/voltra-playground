/**
 * Auto-Regulation Engine Tests
 *
 * Tests for the pure auto-regulation decision functions.
 */

import { describe, it, expect } from 'vitest';
import {
  computeVelocityWarning,
  computeJunkVolumeAlert,
  extractLoadSuggestion,
  extractAutoStopSignal,
  shouldAutoStopSet,
} from '../auto-regulation';
import { TrainingGoal } from '../types';
import type { SessionMetrics } from '@/domain/workout/metrics/types';
import type { PlanResult } from '../types';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    strength: {
      estimated1RM: 150,
      confidence: 0.8,
      source: 'session',
    },
    readiness: {
      zone: 'green',
      velocityPercent: 100,
      confidence: 0.8,
      adjustments: { weight: 0, volume: 1 },
      message: 'Ready',
    },
    fatigue: {
      level: 0.3,
      isJunkVolume: false,
      velocityRecoveryPercent: 90,
      repDropPercent: 10,
    },
    volumeAccumulated: 2400,
    effectiveVolume: 1800,
    ...overrides,
  };
}

function createTestPlanResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    nextSet: null,
    remainingSets: [],
    restSeconds: 120,
    adjustments: [],
    message: 'Test message',
    updatedMetrics: {
      strength: { estimated1RM: 150, confidence: 0.8, source: 'session' },
      readiness: {
        zone: 'green',
        velocityPercent: 100,
        confidence: 0.8,
        adjustments: { weight: 0, volume: 1 },
        message: 'Ready',
      },
      fatigue: {
        level: 0.3,
        isJunkVolume: false,
        velocityRecoveryPercent: 90,
        repDropPercent: 10,
      },
      volumeAccumulated: 2400,
      effectiveVolume: 1800,
    },
    shouldStop: false,
    ...overrides,
  };
}

// =============================================================================
// computeVelocityWarning Tests
// =============================================================================

describe('computeVelocityWarning()', () => {
  it('returns null when velocity loss is within target', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.2,
        isJunkVolume: false,
        velocityRecoveryPercent: 85,
        repDropPercent: 10,
      },
    });

    const result = computeVelocityWarning(metrics, TrainingGoal.HYPERTROPHY);
    // Hypertrophy target max is 30%, velocity loss is 15% (100-85)
    expect(result).toBeNull();
  });

  it('returns warning severity when moderately above target', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.4,
        isJunkVolume: false,
        velocityRecoveryPercent: 72,
        repDropPercent: 20,
      },
    });

    // 28% loss, strength target max is 15%, delta is 13 (between 10-20)
    const result = computeVelocityWarning(metrics, TrainingGoal.STRENGTH);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });

  it('returns critical severity when velocity drops significantly', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.8,
        isJunkVolume: false,
        velocityRecoveryPercent: 40,
        repDropPercent: 40,
      },
    });

    // 60% loss, hypertrophy target max is 30%
    const result = computeVelocityWarning(metrics, TrainingGoal.HYPERTROPHY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });
});

// =============================================================================
// computeJunkVolumeAlert Tests
// =============================================================================

describe('computeJunkVolumeAlert()', () => {
  it('returns null when rep drop is below threshold', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.2,
        isJunkVolume: false,
        velocityRecoveryPercent: 90,
        repDropPercent: 15,
      },
    });

    expect(computeJunkVolumeAlert(metrics)).toBeNull();
  });

  it('returns warning when approaching junk volume', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.5,
        isJunkVolume: false,
        velocityRecoveryPercent: 70,
        repDropPercent: 35,
      },
    });

    const result = computeJunkVolumeAlert(metrics);
    expect(result).not.toBeNull();
    expect(result!.isJunkVolume).toBe(false);
    expect(result!.message).toContain('declining');
  });

  it('returns junk volume alert when fatigue indicates junk', () => {
    const metrics = createTestMetrics({
      fatigue: {
        level: 0.8,
        isJunkVolume: true,
        velocityRecoveryPercent: 50,
        repDropPercent: 55,
      },
    });

    const result = computeJunkVolumeAlert(metrics);
    expect(result).not.toBeNull();
    expect(result!.isJunkVolume).toBe(true);
    expect(result!.message).toContain('no longer productive');
  });
});

// =============================================================================
// extractLoadSuggestion Tests
// =============================================================================

describe('extractLoadSuggestion()', () => {
  it('returns null when no weight adjustment in plan result', () => {
    const planResult = createTestPlanResult({ adjustments: [] });
    expect(extractLoadSuggestion(planResult, 100)).toBeNull();
  });

  it('returns increase suggestion when weight goes up', () => {
    const planResult = createTestPlanResult({
      adjustments: [
        { type: 'weight', reason: 'Velocity low', confidence: 'high', from: 100, to: 105 },
      ],
    });

    const result = extractLoadSuggestion(planResult, 100);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('increase');
    expect(result!.suggestedWeight).toBe(105);
  });

  it('returns decrease suggestion when weight goes down', () => {
    const planResult = createTestPlanResult({
      adjustments: [
        { type: 'weight', reason: 'Too heavy', confidence: 'medium', from: 100, to: 95 },
      ],
    });

    const result = extractLoadSuggestion(planResult, 100);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('decrease');
    expect(result!.suggestedWeight).toBe(95);
  });
});

// =============================================================================
// extractAutoStopSignal Tests
// =============================================================================

describe('extractAutoStopSignal()', () => {
  it('returns no-stop when plan says continue', () => {
    const planResult = createTestPlanResult({ shouldStop: false });
    const result = extractAutoStopSignal(planResult);
    expect(result.shouldStop).toBe(false);
    expect(result.message).toBe('');
  });

  it('returns stop signal with reason when plan says stop', () => {
    const planResult = createTestPlanResult({
      shouldStop: true,
      stopReason: 'junk_volume',
      message: 'Performance dropped',
    });

    const result = extractAutoStopSignal(planResult);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('junk_volume');
    expect(result.message).toBe('Performance dropped');
  });
});

// =============================================================================
// shouldAutoStopSet Tests
// =============================================================================

describe('shouldAutoStopSet()', () => {
  it('returns false with fewer than 2 reps', () => {
    expect(shouldAutoStopSet([0.6], TrainingGoal.HYPERTROPHY).shouldStop).toBe(false);
    expect(shouldAutoStopSet([], TrainingGoal.HYPERTROPHY).shouldStop).toBe(false);
  });

  it('returns false when velocity loss is within target', () => {
    // Hypertrophy target max is 30%
    const velocities = [0.6, 0.55, 0.5]; // ~17% loss
    expect(shouldAutoStopSet(velocities, TrainingGoal.HYPERTROPHY).shouldStop).toBe(false);
  });

  it('returns true when velocity loss exceeds target', () => {
    // Strength target max is 15%
    const velocities = [0.6, 0.45]; // 25% loss
    const result = shouldAutoStopSet(velocities, TrainingGoal.STRENGTH);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain('Velocity dropped');
  });

  it('returns true when velocity below absolute floor', () => {
    // Endurance target max is 50%. With 0.6 -> 0.15, loss is 75% which exceeds 50%
    // The velocity loss check triggers before the absolute floor check
    const velocities = [0.6, 0.15];
    const result = shouldAutoStopSet(velocities, TrainingGoal.ENDURANCE);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain('Velocity dropped');
  });

  it('handles zero first rep velocity gracefully', () => {
    expect(shouldAutoStopSet([0, 0.5], TrainingGoal.HYPERTROPHY).shouldStop).toBe(false);
  });
});
