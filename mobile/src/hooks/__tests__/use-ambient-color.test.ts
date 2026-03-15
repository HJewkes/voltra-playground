import { describe, it, expect } from 'vitest';
import { lossToProgress } from '../use-ambient-color';

describe('lossToProgress', () => {
  it('returns 0 for zero velocity loss', () => {
    expect(lossToProgress(0)).toBe(0);
  });

  it('returns ~0.57 for 20% loss (yellow threshold)', () => {
    // 0.20 / 0.35 ≈ 0.571
    expect(lossToProgress(0.2)).toBeCloseTo(0.571, 2);
  });

  it('returns 1 for 35% loss (red threshold)', () => {
    expect(lossToProgress(0.35)).toBe(1);
  });

  it('clamps at 1 for loss beyond 35%', () => {
    expect(lossToProgress(0.5)).toBe(1);
    expect(lossToProgress(1.0)).toBe(1);
  });

  it('clamps at 0 for negative loss', () => {
    expect(lossToProgress(-0.1)).toBe(0);
  });

  it('interpolates linearly between 0% and 35%', () => {
    // At 17.5% loss (midpoint), progress should be ~0.5
    expect(lossToProgress(0.175)).toBeCloseTo(0.5, 5);
  });
});
