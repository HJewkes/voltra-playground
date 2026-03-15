import { describe, it, expect } from 'vitest';

import { getPacingState, getFillPct, TEMPO_PACING } from '../TempoBar';

describe('getPacingState', () => {
  it('returns none when no target', () => {
    expect(getPacingState(1000, null)).toBe('none');
  });

  it('returns none when target is below minPhaseDurationMs', () => {
    expect(getPacingState(200, TEMPO_PACING.minPhaseDurationMs - 1)).toBe('none');
  });

  it('returns on-pace when elapsed is within threshold', () => {
    const targetMs = 3000;
    const elapsed = targetMs * (1 + TEMPO_PACING.behindThresholdPct);
    expect(getPacingState(elapsed, targetMs)).toBe('on-pace');
  });

  it('returns on-pace when elapsed is well under target', () => {
    expect(getPacingState(1000, 3000)).toBe('on-pace');
  });

  it('returns behind when elapsed exceeds threshold', () => {
    const targetMs = 3000;
    const elapsed = targetMs * (1 + TEMPO_PACING.behindThresholdPct) + 1;
    expect(getPacingState(elapsed, targetMs)).toBe('behind');
  });

  it('returns on-pace at exactly the target duration', () => {
    expect(getPacingState(3000, 3000)).toBe('on-pace');
  });
});

describe('getFillPct', () => {
  it('returns 100 when no target', () => {
    expect(getFillPct(1500, null)).toBe(100);
  });

  it('returns correct percentage for partial fill', () => {
    expect(getFillPct(1500, 3000)).toBe(50);
  });

  it('caps at 100 when elapsed exceeds target', () => {
    expect(getFillPct(5000, 3000)).toBe(100);
  });

  it('returns 0 when elapsed is 0', () => {
    expect(getFillPct(0, 3000)).toBe(0);
  });

  it('returns exact percentage for known ratio', () => {
    expect(getFillPct(750, 3000)).toBe(25);
  });
});
