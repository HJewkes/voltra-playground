/**
 * Metrics Types Tests
 *
 * Tests for session metrics factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyStrengthEstimate,
  createDefaultReadinessEstimate,
  createEmptyFatigueEstimate,
  createEmptySessionMetrics,
  READINESS_THRESHOLDS,
  EXPECTED_REP_DROP,
  JUNK_VOLUME_THRESHOLD,
  VELOCITY_GRINDING_THRESHOLD,
} from '../types';

// =============================================================================
// Factory Functions Tests
// =============================================================================

describe('Metrics Factory Functions', () => {
  describe('createEmptyStrengthEstimate()', () => {
    it('returns estimate with zero 1RM', () => {
      const estimate = createEmptyStrengthEstimate();

      expect(estimate.estimated1RM).toBe(0);
    });

    it('returns estimate with zero confidence', () => {
      const estimate = createEmptyStrengthEstimate();

      expect(estimate.confidence).toBe(0);
    });

    it('returns session as source', () => {
      const estimate = createEmptyStrengthEstimate();

      expect(estimate.source).toBe('session');
    });
  });

  describe('createDefaultReadinessEstimate()', () => {
    it('returns green zone', () => {
      const estimate = createDefaultReadinessEstimate();

      expect(estimate.zone).toBe('green');
    });

    it('returns 100% velocity', () => {
      const estimate = createDefaultReadinessEstimate();

      expect(estimate.velocityPercent).toBe(100);
    });

    it('returns zero confidence', () => {
      const estimate = createDefaultReadinessEstimate();

      expect(estimate.confidence).toBe(0);
    });

    it('returns neutral adjustments', () => {
      const estimate = createDefaultReadinessEstimate();

      expect(estimate.adjustments.weight).toBe(0);
      expect(estimate.adjustments.volume).toBe(1.0);
    });

    it('includes no-baseline message', () => {
      const estimate = createDefaultReadinessEstimate();

      expect(estimate.message).toContain('No baseline');
    });
  });

  describe('createEmptyFatigueEstimate()', () => {
    it('returns zero fatigue level', () => {
      const estimate = createEmptyFatigueEstimate();

      expect(estimate.level).toBe(0);
    });

    it('returns false for junk volume', () => {
      const estimate = createEmptyFatigueEstimate();

      expect(estimate.isJunkVolume).toBe(false);
    });

    it('returns 100% velocity recovery', () => {
      const estimate = createEmptyFatigueEstimate();

      expect(estimate.velocityRecoveryPercent).toBe(100);
    });

    it('returns zero rep drop', () => {
      const estimate = createEmptyFatigueEstimate();

      expect(estimate.repDropPercent).toBe(0);
    });
  });

  describe('createEmptySessionMetrics()', () => {
    it('combines all empty estimates', () => {
      const metrics = createEmptySessionMetrics();

      // Strength
      expect(metrics.strength.estimated1RM).toBe(0);
      expect(metrics.strength.confidence).toBe(0);

      // Readiness
      expect(metrics.readiness.zone).toBe('green');
      expect(metrics.readiness.velocityPercent).toBe(100);

      // Fatigue
      expect(metrics.fatigue.level).toBe(0);
      expect(metrics.fatigue.isJunkVolume).toBe(false);
    });

    it('returns zero volume', () => {
      const metrics = createEmptySessionMetrics();

      expect(metrics.volumeAccumulated).toBe(0);
      expect(metrics.effectiveVolume).toBe(0);
    });
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Metrics Constants', () => {
  describe('READINESS_THRESHOLDS', () => {
    it('excellent > normal > fatigued > red', () => {
      expect(READINESS_THRESHOLDS.excellent).toBeGreaterThan(READINESS_THRESHOLDS.normal);
      expect(READINESS_THRESHOLDS.normal).toBeGreaterThan(READINESS_THRESHOLDS.fatigued);
      expect(READINESS_THRESHOLDS.fatigued).toBeGreaterThanOrEqual(READINESS_THRESHOLDS.red);
    });

    it('excellent is above 100%', () => {
      expect(READINESS_THRESHOLDS.excellent).toBeGreaterThan(1);
    });

    it('red is below 90%', () => {
      expect(READINESS_THRESHOLDS.red).toBeLessThan(0.9);
    });
  });

  describe('EXPECTED_REP_DROP', () => {
    it('longer rest has lower expected drop', () => {
      expect(EXPECTED_REP_DROP[180]).toBeLessThan(EXPECTED_REP_DROP[120]);
      expect(EXPECTED_REP_DROP[120]).toBeLessThan(EXPECTED_REP_DROP[60]);
    });

    it('has common rest periods', () => {
      expect(EXPECTED_REP_DROP[60]).toBeDefined();
      expect(EXPECTED_REP_DROP[120]).toBeDefined();
      expect(EXPECTED_REP_DROP[180]).toBeDefined();
    });
  });

  describe('JUNK_VOLUME_THRESHOLD', () => {
    it('is 50%', () => {
      expect(JUNK_VOLUME_THRESHOLD).toBe(0.5);
    });
  });

  describe('VELOCITY_GRINDING_THRESHOLD', () => {
    it('is 0.3 m/s', () => {
      expect(VELOCITY_GRINDING_THRESHOLD).toBe(0.3);
    });
  });
});

// =============================================================================
// Integration with Fixtures
// =============================================================================

describe('Metrics with Fixtures', () => {
  it('fixture generators produce valid SessionMetrics structure', async () => {
    const { generateSessionMetrics } = await import('@/__fixtures__/generators');

    const metrics = generateSessionMetrics();

    // Verify structure matches interface
    expect(metrics.strength).toBeDefined();
    expect(metrics.strength.estimated1RM).toBeGreaterThan(0);
    expect(metrics.readiness).toBeDefined();
    expect(['green', 'yellow', 'red']).toContain(metrics.readiness.zone);
    expect(metrics.fatigue).toBeDefined();
    expect(metrics.fatigue.level).toBeGreaterThanOrEqual(0);
    expect(metrics.volumeAccumulated).toBeGreaterThan(0);
  });

  it('fixture can generate junk volume metrics', async () => {
    const { generateJunkVolumeSessionMetrics } = await import('@/__fixtures__/generators');

    const metrics = generateJunkVolumeSessionMetrics();

    expect(metrics.fatigue.isJunkVolume).toBe(true);
    expect(metrics.fatigue.level).toBeGreaterThan(0.7);
    expect(metrics.fatigue.repDropPercent).toBeGreaterThan(JUNK_VOLUME_THRESHOLD * 100);
  });
});
