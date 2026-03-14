/**
 * Exercise Picker History Service Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractPickerSummary,
  buildPickerSummaryMap,
  formatTimeAgo,
} from '../exercise-picker-history';
import { generateStoredSession } from '@/__fixtures__/generators/session-generator';

// =============================================================================
// extractPickerSummary
// =============================================================================

describe('extractPickerSummary', () => {
  it('returns null for session with no completed sets', () => {
    const session = generateStoredSession({ setCount: 0 });
    // setCount: 0 generates an empty completedSets array
    session.completedSets = [];
    expect(extractPickerSummary(session)).toBeNull();
  });

  it('extracts working weight as max weight across working sets', () => {
    const session = generateStoredSession({ weight: 120, setCount: 3 });
    const summary = extractPickerSummary(session);
    expect(summary).not.toBeNull();
    expect(summary!.workingWeight).toBe(120);
  });

  it('extracts best mean velocity from working sets', () => {
    const session = generateStoredSession({ weight: 100, setCount: 3 });
    const summary = extractPickerSummary(session);
    expect(summary).not.toBeNull();
    // First set has highest velocity (no fatigue multiplier)
    expect(summary!.bestMeanVelocity).toBeGreaterThan(0);
    expect(summary!.bestMeanVelocity).toBe(
      Math.max(...session.completedSets.map((s) => s.meanVelocity)),
    );
  });

  it('uses session startTime as lastPerformedAt', () => {
    const session = generateStoredSession({ daysAgo: 5 });
    const summary = extractPickerSummary(session);
    expect(summary).not.toBeNull();
    expect(summary!.lastPerformedAt).toBe(session.startTime);
  });

  it('sets exerciseId from the session', () => {
    const session = generateStoredSession({ exerciseId: 'lat_pulldown' });
    const summary = extractPickerSummary(session);
    expect(summary).not.toBeNull();
    expect(summary!.exerciseId).toBe('lat_pulldown');
  });
});

// =============================================================================
// buildPickerSummaryMap
// =============================================================================

describe('buildPickerSummaryMap', () => {
  it('returns empty map for no sessions', () => {
    const map = buildPickerSummaryMap([]);
    expect(map.size).toBe(0);
  });

  it('groups by exercise and uses most recent session', () => {
    const older = generateStoredSession({
      exerciseId: 'cable_row',
      weight: 80,
      daysAgo: 10,
    });
    const newer = generateStoredSession({
      exerciseId: 'cable_row',
      weight: 100,
      daysAgo: 2,
    });
    const map = buildPickerSummaryMap([older, newer]);

    expect(map.size).toBe(1);
    expect(map.get('cable_row')!.workingWeight).toBe(100);
  });

  it('includes multiple exercises', () => {
    const row = generateStoredSession({ exerciseId: 'cable_row' });
    const curl = generateStoredSession({ exerciseId: 'cable_curl' });
    const map = buildPickerSummaryMap([row, curl]);

    expect(map.size).toBe(2);
    expect(map.has('cable_row')).toBe(true);
    expect(map.has('cable_curl')).toBe(true);
  });

  it('skips in-progress sessions', () => {
    const session = generateStoredSession({ exerciseId: 'cable_row' });
    session.status = 'in_progress';
    const map = buildPickerSummaryMap([session]);

    expect(map.size).toBe(0);
  });

  it('skips abandoned sessions', () => {
    const session = generateStoredSession({ exerciseId: 'cable_row' });
    session.status = 'abandoned';
    const map = buildPickerSummaryMap([session]);

    expect(map.size).toBe(0);
  });
});

// =============================================================================
// formatTimeAgo
// =============================================================================

describe('formatTimeAgo', () => {
  const NOW = 1_700_000_000_000;

  it('returns "just now" for timestamps less than a minute ago', () => {
    expect(formatTimeAgo(NOW - 30_000, NOW)).toBe('just now');
  });

  it('returns minutes for recent timestamps', () => {
    expect(formatTimeAgo(NOW - 5 * 60_000, NOW)).toBe('5m ago');
  });

  it('returns hours for same-day timestamps', () => {
    expect(formatTimeAgo(NOW - 3 * 60 * 60_000, NOW)).toBe('3h ago');
  });

  it('returns "yesterday" for 1 day ago', () => {
    expect(formatTimeAgo(NOW - 24 * 60 * 60_000, NOW)).toBe('yesterday');
  });

  it('returns days for recent past', () => {
    expect(formatTimeAgo(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe('3d ago');
  });

  it('returns weeks for 1-4 weeks ago', () => {
    expect(formatTimeAgo(NOW - 14 * 24 * 60 * 60_000, NOW)).toBe('2 weeks ago');
  });

  it('returns months for longer periods', () => {
    expect(formatTimeAgo(NOW - 60 * 24 * 60 * 60_000, NOW)).toBe('2 months ago');
  });

  it('handles future timestamps gracefully', () => {
    expect(formatTimeAgo(NOW + 60_000, NOW)).toBe('just now');
  });
});
