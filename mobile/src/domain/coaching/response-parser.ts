/**
 * Response Parser
 *
 * Parses Claude's text response into typed CoachingCue objects.
 * Falls back to a text cue if the response isn't valid JSON.
 */

import type { CoachingContext } from './types';
import type { CoachingCue, TextCue } from './claude-api-types';

/**
 * Parse a raw text response from Claude into a typed CoachingCue.
 * If the response is not valid JSON or doesn't match the expected
 * shape, wraps it as a plain text cue.
 */
export function parseCoachingResponse(raw: string): CoachingCue {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return validateCue(parsed);
  } catch {
    return extractJsonFromText(trimmed);
  }
}

function extractJsonFromText(text: string): CoachingCue {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return validateCue(parsed);
    } catch {
      // fall through
    }
  }

  return { type: 'text', message: truncate(text, 300) };
}

function validateCue(parsed: Record<string, unknown>): CoachingCue {
  if (typeof parsed.message !== 'string' || parsed.message.length === 0) {
    throw new Error('Missing or empty message');
  }

  const message = truncate(parsed.message, 300);

  switch (parsed.type) {
    case 'load_adjustment':
      return validateLoadAdjustment(parsed, message);
    case 'encouragement':
      return { type: 'encouragement', message };
    case 'text':
    default:
      return { type: 'text', message };
  }
}

function validateLoadAdjustment(
  parsed: Record<string, unknown>,
  message: string,
): CoachingCue {
  const suggestedLoad = parsed.suggestedLoad;
  const direction = parsed.direction;

  if (
    typeof suggestedLoad !== 'number' ||
    suggestedLoad <= 0 ||
    !isValidDirection(direction)
  ) {
    return { type: 'text', message };
  }

  return {
    type: 'load_adjustment',
    message,
    suggestedLoad,
    direction,
  };
}

function isValidDirection(
  value: unknown,
): value is 'increase' | 'decrease' | 'maintain' {
  return value === 'increase' || value === 'decrease' || value === 'maintain';
}

/**
 * Create a context-aware fallback cue when the API call fails.
 */
export function createFallbackCue(context: CoachingContext): TextCue {
  const { autoRegulation, currentSet } = context;

  if (autoRegulation.junkVolumeDetected) {
    return {
      type: 'text',
      message:
        'Consider wrapping up — additional volume may not be productive.',
    };
  }

  if (autoRegulation.velocityWarningSeverity === 'critical') {
    return {
      type: 'text',
      message:
        'Velocity has dropped significantly. Consider reducing load or ending the set.',
    };
  }

  if (autoRegulation.loadSuggestion) {
    const ls = autoRegulation.loadSuggestion;
    return {
      type: 'text',
      message: `Consider adjusting load to ${ls.suggestedWeight} lbs (${ls.reason}).`,
    };
  }

  return {
    type: 'text',
    message: `Set ${currentSet.setNumber} complete: ${currentSet.meanVelocity} m/s avg velocity.`,
  };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
