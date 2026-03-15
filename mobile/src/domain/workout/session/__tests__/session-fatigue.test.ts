/**
 * Session Fatigue Tests
 */

import { describe, it, expect } from 'vitest';
import { computeSessionFatigue } from '../session-fatigue';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';

// =============================================================================
// computeSessionFatigue
// =============================================================================

describe('computeSessionFatigue()', () => {
  it('returns null when fewer than two sets are provided', () => {
    expect(computeSessionFatigue([])).toBeNull();
    expect(computeSessionFatigue([mockCompletedSet({ weight: 135 })])).toBeNull();
  });

  it('returns null when only one set exists at a given weight', () => {
    // Two sets at different weights — no comparable pair
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.55] }),
      mockCompletedSet({ weight: 185, velocities: [0.4, 0.35] }),
    ];
    expect(computeSessionFatigue(sets)).toBeNull();
  });

  it('reports zero fatigue when velocity is unchanged', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.fatigueScore).toBeCloseTo(0, 1);
    expect(result!.velocityDecline).toBeCloseTo(0, 3);
    expect(result!.trend).toBe('fresh');
  });

  it('scores moderate fatigue for a 25% velocity drop', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.45, 0.45] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    // 25% decline → score ~25 → moderate
    expect(result!.fatigueScore).toBeCloseTo(25, 0);
    expect(result!.trend).toBe('moderate');
  });

  it('scores fatigued for a 50% velocity drop', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.3, 0.3] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.fatigueScore).toBeCloseTo(50, 0);
    expect(result!.trend).toBe('fatigued');
  });

  it('scores exhausted for a 75% velocity drop', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.15, 0.15] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.fatigueScore).toBeCloseTo(75, 0);
    expect(result!.trend).toBe('exhausted');
  });

  it('clamps score to 0 when latest velocity exceeds first (warm-up effect)', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.5, 0.5] }),
      mockCompletedSet({ weight: 135, velocities: [0.65, 0.65] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.fatigueScore).toBe(0);
    expect(result!.trend).toBe('fresh');
  });

  it('clamps score to 100 when velocity is completely lost', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.0, 0.0] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.fatigueScore).toBe(100);
    expect(result!.trend).toBe('exhausted');
  });

  it('matches by weight tolerance band — treats sets within ±2.5 lbs as same load', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      // 136.5 is within 2.5 lbs of 135
      mockCompletedSet({ weight: 136.5, velocities: [0.48, 0.48] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    // decline from ~0.6 to ~0.48 ≈ 20%
    expect(result!.fatigueScore).toBeGreaterThan(0);
  });

  it('ignores earlier sets at different weights and uses same-load baseline', () => {
    const sets = [
      // Warmup at different weight — should not be used as baseline
      mockCompletedSet({ weight: 95, velocities: [0.8, 0.8] }),
      // First working set at 135 — this is the baseline
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      // Latest at 135 — this is compared against the 0.6 baseline
      mockCompletedSet({ weight: 135, velocities: [0.42, 0.42] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    // 30% decline from 0.6 → 0.42
    expect(result!.fatigueScore).toBeCloseTo(30, 0);
    expect(result!.trend).toBe('moderate');
  });

  it('uses the latest set as comparison when multiple same-weight sets exist', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.55, 0.55] }),
      mockCompletedSet({ weight: 135, velocities: [0.45, 0.45] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    // Compares first (0.6) to last (0.45): 25% decline
    expect(result!.fatigueScore).toBeCloseTo(25, 0);
  });

  it('returns correct velocityDecline in m/s', () => {
    const sets = [
      mockCompletedSet({ weight: 135, velocities: [0.6, 0.6] }),
      mockCompletedSet({ weight: 135, velocities: [0.48, 0.48] }),
    ];
    const result = computeSessionFatigue(sets);
    expect(result).not.toBeNull();
    expect(result!.velocityDecline).toBeCloseTo(0.12, 2);
  });
});
