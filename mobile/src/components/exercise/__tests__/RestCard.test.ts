import { describe, it, expect } from 'vitest';

import { formatTime, getProgress, isOvershot } from '../CircularTimer';

describe('formatTime', () => {
  it('formats 0ms as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 47 seconds correctly', () => {
    expect(formatTime(47000)).toBe('0:47');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatTime(90000)).toBe('1:30');
  });

  it('formats 125 seconds as 2:05', () => {
    expect(formatTime(125000)).toBe('2:05');
  });

  it('floors partial seconds', () => {
    expect(formatTime(47999)).toBe('0:47');
  });
});

describe('getProgress', () => {
  it('returns 0 at 0ms elapsed', () => {
    expect(getProgress(0, 60000)).toBe(0);
  });

  it('returns 0.5 at half target', () => {
    expect(getProgress(30000, 60000)).toBe(0.5);
  });

  it('returns 1 at target', () => {
    expect(getProgress(60000, 60000)).toBe(1);
  });

  it('caps at 1 past target', () => {
    expect(getProgress(90000, 60000)).toBe(1);
  });
});

describe('isOvershot', () => {
  it('returns false when elapsed equals target', () => {
    expect(isOvershot(60000, 60000)).toBe(false);
  });

  it('returns false when elapsed is under target', () => {
    expect(isOvershot(30000, 60000)).toBe(false);
  });

  it('returns true when elapsed exceeds target', () => {
    expect(isOvershot(60001, 60000)).toBe(true);
  });
});
