/**
 * Claude API Service
 *
 * Calls the Anthropic Claude API to generate coaching cues.
 * Handles API communication, retry logic, and response parsing.
 */

import type { CoachingContext, CoachingCue } from './types';
import { toPrompt } from './coaching-context-builder';

// =============================================================================
// Configuration
// =============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 256;
const TEMPERATURE = 0.7;
const REQUEST_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = [
  'You are a concise VBT (velocity-based training) coach embedded in a workout app.',
  'Your role is to give brief, actionable cues between sets.',
  'Focus on load adjustments, technique reminders, and motivation.',
  'Reference the athlete\'s previous compliance with your suggestions when relevant.',
  'If the athlete ignored your advice and performance declined, gently reinforce the suggestion.',
  'If they followed your advice and improved, acknowledge it briefly.',
  'Never exceed 2 sentences. Use specific numbers (weights, velocities) when available.',
].join(' ');

// =============================================================================
// Types
// =============================================================================

export interface ClaudeApiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface ClaudeApiResponse {
  content: Array<{ type: string; text?: string }>;
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Call Claude API to generate a coaching cue.
 *
 * Throws on network/API failures so the caller can handle error state.
 * Returns null only when the API returns no usable text content.
 */
export async function getCoachingCue(
  context: CoachingContext,
  config: ClaudeApiConfig
): Promise<CoachingCue | null> {
  const prompt = toPrompt(context);
  const response = await callClaudeApi(prompt, config);
  if (!response) return null;

  return parseCoachingResponse(response, context.currentSetIndex);
}

async function callClaudeApi(
  userMessage: string,
  config: ClaudeApiConfig
): Promise<string | null> {
  const baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
  const model = config.model ?? CLAUDE_MODEL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[ClaudeAPI] HTTP error:', response.status);
      return null;
    }

    const data = (await response.json()) as ClaudeApiResponse;
    const textBlock = data.content.find((c) => c.type === 'text');
    return textBlock?.text ?? null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// Response Parsing
// =============================================================================

const WEIGHT_PATTERN = /(\d+)\s*(?:lbs?|pounds?)/i;
const DIRECTION_PATTERNS = {
  decrease: /(?:drop|reduce|lower|decrease|go down|take off|remove)\b/i,
  increase: /(?:add|increase|raise|bump|go up|put on)\b/i,
};

/**
 * Parse Claude's text response into a structured CoachingCue.
 * Extracts weight suggestions from natural language.
 */
export function parseCoachingResponse(
  text: string,
  afterSetIndex: number
): CoachingCue {
  const weightMatch = text.match(WEIGHT_PATTERN);
  let suggestedWeight: number | null = null;
  let suggestedLoadDelta = 0;

  if (weightMatch) {
    suggestedWeight = parseInt(weightMatch[1], 10);
  }

  if (DIRECTION_PATTERNS.decrease.test(text)) {
    suggestedLoadDelta = suggestedWeight !== null ? -Math.abs(suggestedLoadDelta) : -5;
  } else if (DIRECTION_PATTERNS.increase.test(text)) {
    suggestedLoadDelta = suggestedWeight !== null ? Math.abs(suggestedLoadDelta) : 5;
  }

  return {
    id: `cue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message: text.trim(),
    suggestedLoadDelta,
    suggestedWeight,
    afterSetIndex,
    generatedAt: Date.now(),
  };
}
