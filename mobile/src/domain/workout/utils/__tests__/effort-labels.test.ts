/**
 * Effort Labels Tests
 *
 * Tests for RIR/RPE label generation and UI helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  getEffortLabel,
  getRIRDescription,
  getEffortBar,
  getRPEColor,
  getLiveEffortMessage,
} from '../effort-labels';

// =============================================================================
// getEffortLabel() Tests
// =============================================================================

describe('getEffortLabel()', () => {
  it('returns Easy for RPE 5 and below', () => {
    expect(getEffortLabel(3)).toBe('Easy');
    expect(getEffortLabel(5)).toBe('Easy');
  });

  it('returns Moderate for RPE 6', () => {
    expect(getEffortLabel(6)).toBe('Moderate');
  });

  it('returns Challenging for RPE 7', () => {
    expect(getEffortLabel(7)).toBe('Challenging');
  });

  it('returns Hard for RPE 8', () => {
    expect(getEffortLabel(8)).toBe('Hard');
  });

  it('returns Very Hard for RPE 9', () => {
    expect(getEffortLabel(9)).toBe('Very Hard');
  });

  it('returns Max Effort for RPE 10', () => {
    expect(getEffortLabel(10)).toBe('Max Effort');
  });
});

// =============================================================================
// getRIRDescription() Tests
// =============================================================================

describe('getRIRDescription()', () => {
  it('returns 5+ reps for RIR 5 and above', () => {
    expect(getRIRDescription(5)).toBe('5+ reps left');
    expect(getRIRDescription(7)).toBe('5+ reps left');
  });

  it('returns correct description for RIR 1-4', () => {
    expect(getRIRDescription(4)).toBe('4 reps left');
    expect(getRIRDescription(3)).toBe('3 reps left');
    expect(getRIRDescription(2)).toBe('2 reps left');
    expect(getRIRDescription(1)).toBe('1 rep left');
  });

  it('returns At failure for RIR 0', () => {
    expect(getRIRDescription(0)).toBe('At failure');
  });

  it('handles fractional RIR', () => {
    expect(getRIRDescription(2.5)).toBe('2 reps left');
    expect(getRIRDescription(0.5)).toBe('At failure');
  });
});

// =============================================================================
// getEffortBar() Tests
// =============================================================================

describe('getEffortBar()', () => {
  it('generates bar with default width', () => {
    const bar = getEffortBar(5);

    expect(bar.length).toBe(10);
  });

  it('generates bar with custom width', () => {
    const bar = getEffortBar(5, 20);

    expect(bar.length).toBe(20);
  });

  it('shows correct filled proportion', () => {
    const bar80 = getEffortBar(8);
    const filled = (bar80.match(/█/g) || []).length;

    expect(filled).toBe(8); // 80% of 10
  });

  it('shows empty for RPE 0', () => {
    const bar = getEffortBar(0);

    expect(bar).toBe('░░░░░░░░░░');
  });

  it('shows full for RPE 10', () => {
    const bar = getEffortBar(10);

    expect(bar).toBe('██████████');
  });
});

// =============================================================================
// getRPEColor() Tests
// =============================================================================

describe('getRPEColor()', () => {
  it('returns green for RPE 6 and below', () => {
    expect(getRPEColor(5)).toBe('#22c55e');
    expect(getRPEColor(6)).toBe('#22c55e');
  });

  it('returns lime for RPE 7', () => {
    expect(getRPEColor(7)).toBe('#84cc16');
  });

  it('returns yellow for RPE 8', () => {
    expect(getRPEColor(8)).toBe('#eab308');
  });

  it('returns orange for RPE 9', () => {
    expect(getRPEColor(9)).toBe('#f97316');
  });

  it('returns red for RPE 10', () => {
    expect(getRPEColor(10)).toBe('#ef4444');
  });
});

// =============================================================================
// getLiveEffortMessage() Tests
// =============================================================================

describe('getLiveEffortMessage()', () => {
  it('returns keep going for first rep', () => {
    expect(getLiveEffortMessage(5, 1)).toBe('Keep going...');
  });

  it('returns light feedback for low RPE', () => {
    const message = getLiveEffortMessage(5, 3);

    expect(message.toLowerCase()).toContain('light');
  });

  it('returns moderate feedback for medium RPE', () => {
    const message = getLiveEffortMessage(7, 5);

    expect(message.toLowerCase()).toContain('good');
  });

  it('returns hard feedback for high RPE', () => {
    const message = getLiveEffortMessage(8, 5);

    expect(message.toLowerCase()).toContain('hard');
  });

  it('returns warning for very high RPE', () => {
    const message = getLiveEffortMessage(9, 5);

    expect(message.toLowerCase()).toContain('high');
  });

  it('returns maximum warning for RPE 10', () => {
    const message = getLiveEffortMessage(10, 5);

    expect(message.toLowerCase()).toContain('maximum');
  });
});
