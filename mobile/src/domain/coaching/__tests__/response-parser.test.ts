/**
 * Response Parser Tests
 *
 * Verifies that Claude's raw text responses are correctly parsed
 * into typed CoachingCue objects, with fallback behavior for
 * malformed or non-JSON responses.
 */

import { describe, it, expect } from 'vitest';
import { parseCoachingResponse, createFallbackCue } from '../response-parser';
import type { CoachingContext } from '../types';

// =============================================================================
// Helpers
// =============================================================================

function createMinimalContext(
  overrides: Partial<CoachingContext> = {},
): CoachingContext {
  return {
    currentSet: {
      exerciseName: 'Bench Press',
      exerciseId: 'bench_press',
      setNumber: 3,
      load: 185,
      reps: 8,
      meanVelocity: 0.45,
      peakVelocity: 0.72,
      velocityLossPercent: 18,
      estimatedRPE: 8,
      estimatedRIR: 2,
    },
    session: {
      exerciseName: 'Bench Press',
      setsCompleted: 3,
      setsPlanned: 5,
      sessionDurationMinutes: 12,
      fatigueTrend: {
        velocityRecoveryPercent: 85,
        repDropPercent: 10,
        isJunkVolume: false,
        fatigueLevel: 0.4,
      },
      trainingGoal: 'strength',
    },
    athleteHistory: {
      recentSessions: [],
      baselineVelocityAtLoad: null,
      personalRecords: [],
      sessionCount: 0,
    },
    autoRegulation: {
      readinessZone: 'green',
      readinessConfidence: 0.8,
      velocityWarningSeverity: null,
      velocityWarningMessage: null,
      junkVolumeDetected: false,
      loadSuggestion: null,
    },
    previousCues: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// parseCoachingResponse
// =============================================================================

describe('parseCoachingResponse', () => {
  describe('valid JSON responses', () => {
    it('parses a text cue', () => {
      const raw = '{"type":"text","message":"Focus on controlled eccentric."}';
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'text',
        message: 'Focus on controlled eccentric.',
      });
    });

    it('parses a load adjustment cue', () => {
      const raw = JSON.stringify({
        type: 'load_adjustment',
        message: 'Drop the weight for better velocity.',
        suggestedLoad: 155,
        direction: 'decrease',
      });
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'load_adjustment',
        message: 'Drop the weight for better velocity.',
        suggestedLoad: 155,
        direction: 'decrease',
      });
    });

    it('parses an encouragement cue', () => {
      const raw =
        '{"type":"encouragement","message":"Strong set! Velocity is holding well."}';
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'encouragement',
        message: 'Strong set! Velocity is holding well.',
      });
    });

    it('handles whitespace around JSON', () => {
      const raw = '  \n{"type":"text","message":"Good pace."}\n  ';
      const result = parseCoachingResponse(raw);
      expect(result.type).toBe('text');
      expect(result.message).toBe('Good pace.');
    });
  });

  describe('load adjustment validation', () => {
    it('falls back to text when suggestedLoad is missing', () => {
      const raw = JSON.stringify({
        type: 'load_adjustment',
        message: 'Drop the weight.',
        direction: 'decrease',
      });
      const result = parseCoachingResponse(raw);
      expect(result.type).toBe('text');
      expect(result.message).toBe('Drop the weight.');
    });

    it('falls back to text when suggestedLoad is zero', () => {
      const raw = JSON.stringify({
        type: 'load_adjustment',
        message: 'Adjust load.',
        suggestedLoad: 0,
        direction: 'decrease',
      });
      const result = parseCoachingResponse(raw);
      expect(result.type).toBe('text');
    });

    it('falls back to text when direction is invalid', () => {
      const raw = JSON.stringify({
        type: 'load_adjustment',
        message: 'Adjust load.',
        suggestedLoad: 135,
        direction: 'up',
      });
      const result = parseCoachingResponse(raw);
      expect(result.type).toBe('text');
    });
  });

  describe('fallback behavior', () => {
    it('wraps plain text as a text cue', () => {
      const raw = 'Great set, keep it up!';
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'text',
        message: 'Great set, keep it up!',
      });
    });

    it('extracts JSON embedded in markdown', () => {
      const raw =
        'Here is my coaching:\n```json\n{"type":"text","message":"Focus on tempo."}\n```';
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'text',
        message: 'Focus on tempo.',
      });
    });

    it('truncates long plain text responses', () => {
      const raw = 'A'.repeat(400);
      const result = parseCoachingResponse(raw);
      expect(result.message.length).toBeLessThanOrEqual(300);
      expect(result.message).toContain('...');
    });

    it('handles empty message field gracefully', () => {
      const raw = '{"type":"text","message":""}';
      const result = parseCoachingResponse(raw);
      expect(result.type).toBe('text');
    });

    it('handles unknown type as text', () => {
      const raw = '{"type":"tactical","message":"Try a wider grip."}';
      const result = parseCoachingResponse(raw);
      expect(result).toEqual({
        type: 'text',
        message: 'Try a wider grip.',
      });
    });
  });
});

// =============================================================================
// createFallbackCue
// =============================================================================

describe('createFallbackCue', () => {
  it('warns about junk volume when detected', () => {
    const context = createMinimalContext({
      autoRegulation: {
        readinessZone: 'red',
        readinessConfidence: 0.9,
        velocityWarningSeverity: null,
        velocityWarningMessage: null,
        junkVolumeDetected: true,
        loadSuggestion: null,
      },
    });
    const cue = createFallbackCue(context);
    expect(cue.message).toContain('wrapping up');
  });

  it('warns about critical velocity drop', () => {
    const context = createMinimalContext({
      autoRegulation: {
        readinessZone: 'red',
        readinessConfidence: 0.9,
        velocityWarningSeverity: 'critical',
        velocityWarningMessage: 'Velocity too low',
        junkVolumeDetected: false,
        loadSuggestion: null,
      },
    });
    const cue = createFallbackCue(context);
    expect(cue.message).toContain('dropped significantly');
  });

  it('suggests load adjustment when available', () => {
    const context = createMinimalContext({
      autoRegulation: {
        readinessZone: 'yellow',
        readinessConfidence: 0.7,
        velocityWarningSeverity: null,
        velocityWarningMessage: null,
        junkVolumeDetected: false,
        loadSuggestion: {
          currentWeight: 185,
          suggestedWeight: 165,
          direction: 'decrease',
          reason: 'velocity below target',
        },
      },
    });
    const cue = createFallbackCue(context);
    expect(cue.message).toContain('165');
  });

  it('provides a generic summary when no signals present', () => {
    const context = createMinimalContext();
    const cue = createFallbackCue(context);
    expect(cue.message).toContain('Set 3');
    expect(cue.message).toContain('0.45');
  });

  it('prioritizes junk volume over critical velocity', () => {
    const context = createMinimalContext({
      autoRegulation: {
        readinessZone: 'red',
        readinessConfidence: 0.9,
        velocityWarningSeverity: 'critical',
        velocityWarningMessage: 'Very low',
        junkVolumeDetected: true,
        loadSuggestion: null,
      },
    });
    const cue = createFallbackCue(context);
    expect(cue.message).toContain('wrapping up');
  });
});
