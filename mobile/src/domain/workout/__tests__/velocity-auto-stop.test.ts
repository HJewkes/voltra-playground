/**
 * Velocity Auto-Stop Tests
 *
 * Verifies the auto-stop detection logic: threshold checks, consecutive rep
 * requirement, warmup guards, and minimum rep count.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateAutoStop,
  createAutoStopTracker,
  type VelocityAutoStopConfig,
  type VelocityAutoStopTracker,
} from '../velocity-auto-stop';
import { mockAnalyticsSet, mockRep } from '@/__fixtures__/generators';

// =============================================================================
// Helpers
// =============================================================================

function enabledConfig(thresholdPct = 20): VelocityAutoStopConfig {
  return { enabled: true, thresholdPct };
}

function disabledConfig(): VelocityAutoStopConfig {
  return { enabled: false, thresholdPct: 20 };
}

// =============================================================================
// Tests
// =============================================================================

describe('evaluateAutoStop', () => {
  let tracker: VelocityAutoStopTracker;

  beforeEach(() => {
    tracker = createAutoStopTracker();
  });

  describe('guards', () => {
    it('never triggers when disabled', () => {
      const set = mockAnalyticsSet({
        velocities: [0.8, 0.7, 0.6, 0.5, 0.4],
      });
      const result = evaluateAutoStop(set, tracker, disabledConfig(), false);
      expect(result.shouldStop).toBe(false);
    });

    it('never triggers on warmup sets', () => {
      const set = mockAnalyticsSet({
        velocities: [0.8, 0.7, 0.6, 0.5, 0.4],
      });
      const result = evaluateAutoStop(set, tracker, enabledConfig(), true);
      expect(result.shouldStop).toBe(false);
    });

    it('never triggers with fewer than 3 reps', () => {
      const set = mockAnalyticsSet({ velocities: [0.8, 0.3] });
      const result = evaluateAutoStop(set, tracker, enabledConfig(), false);
      expect(result.shouldStop).toBe(false);
    });

    it('does not trigger on first rep over threshold (needs 2 consecutive)', () => {
      // 3 reps, third rep drops 37% from first
      const set = mockAnalyticsSet({ velocities: [0.8, 0.7, 0.5] });
      const result = evaluateAutoStop(set, tracker, enabledConfig(20), false);
      expect(result.shouldStop).toBe(false);
      expect(result.consecutiveRepsOverThreshold).toBe(1);
    });
  });

  describe('threshold detection', () => {
    it('triggers after 2 consecutive reps over threshold', () => {
      // Simulate rep-by-rep evaluation
      // Rep 3: velocity 0.6 vs first 0.8 = 25% drop
      const set3 = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6] });
      const r3 = evaluateAutoStop(set3, tracker, enabledConfig(20), false);
      expect(r3.shouldStop).toBe(false);
      expect(r3.consecutiveRepsOverThreshold).toBe(1);

      // Rep 4: velocity 0.55 vs first 0.8 = 31% drop
      const set4 = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6, 0.55] });
      const r4 = evaluateAutoStop(set4, tracker, enabledConfig(20), false);
      expect(r4.shouldStop).toBe(true);
      expect(r4.consecutiveRepsOverThreshold).toBe(2);
    });

    it('resets counter when a rep comes back under threshold', () => {
      // Rep 3: 25% drop - over threshold
      const set3 = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6] });
      evaluateAutoStop(set3, tracker, enabledConfig(20), false);
      expect(tracker.consecutiveRepsOverThreshold).toBe(1);

      // Rep 4: 6% drop (0.75 relative to 0.8) - under threshold
      const set4 = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6, 0.75] });
      evaluateAutoStop(set4, tracker, enabledConfig(20), false);
      expect(tracker.consecutiveRepsOverThreshold).toBe(0);
    });

    it('respects custom threshold', () => {
      // With 40% threshold, 25% drop should not trigger
      const set3 = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6] });
      const r3 = evaluateAutoStop(set3, tracker, enabledConfig(40), false);
      expect(r3.shouldStop).toBe(false);
      expect(r3.consecutiveRepsOverThreshold).toBe(0);
    });

    it('triggers with steep velocity decline', () => {
      // Dramatic decline: each rep loses significant velocity
      const set3 = mockAnalyticsSet({ velocities: [1.0, 0.9, 0.7] });
      evaluateAutoStop(set3, tracker, enabledConfig(20), false);

      const set4 = mockAnalyticsSet({ velocities: [1.0, 0.9, 0.7, 0.6] });
      const r4 = evaluateAutoStop(set4, tracker, enabledConfig(20), false);
      expect(r4.shouldStop).toBe(true);
    });
  });

  describe('velocity loss reporting', () => {
    it('reports current set velocity loss percentage', () => {
      const set = mockAnalyticsSet({ velocities: [0.8, 0.75, 0.6] });
      const result = evaluateAutoStop(set, tracker, enabledConfig(), false);
      expect(result.velocityLossPct).toBeGreaterThan(0);
    });
  });
});
