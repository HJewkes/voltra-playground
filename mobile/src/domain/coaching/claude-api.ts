/**
 * Claude API Service
 *
 * Calls the Anthropic Messages API to generate coaching cues from
 * CoachingContext. Uses fetch() directly (no SDK) for React Native
 * compatibility. Supports both direct API calls and proxy URLs.
 *
 * Production note: For production deployment, replace the direct API
 * call with a thin proxy (e.g., Expo API route, Cloudflare Worker,
 * or Supabase Edge Function) that holds the API key server-side.
 * The proxy URL can be set via COACHING_API_URL config.
 */

import type { CoachingContext } from './types';
import type {
  CoachingCue,
  CoachingApiConfig,
  TokenUsage,
} from './claude-api-types';
import { parseCoachingResponse, createFallbackCue } from './response-parser';
import { toPrompt } from './coaching-context-builder';

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch a coaching cue from the Claude API.
 *
 * Fails gracefully -- coaching is optional and must never block
 * the workout. Returns a fallback text cue on any error.
 */
export async function getCoachingCue(
  context: CoachingContext,
  config: CoachingApiConfig,
): Promise<CoachingCue> {
  try {
    return await callClaudeApi(context, config);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    config.onError?.(message);
    return createFallbackCue(context);
  }
}

async function callClaudeApi(
  context: CoachingContext,
  config: CoachingApiConfig,
): Promise<CoachingCue> {
  const { system, user } = buildApiPrompt(context);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = config.model ?? DEFAULT_MODEL;

  const body = {
    model,
    max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const url = resolveApiUrl(config);

  if (!config.proxyUrl) {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`Claude API ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const textContent = extractTextContent(data);
    const usage = extractUsage(data);

    config.onTokenUsage?.(usage);

    return parseCoachingResponse(textContent);
  } finally {
    clearTimeout(timeout);
  }
}

function resolveApiUrl(config: CoachingApiConfig): string {
  if (config.proxyUrl) return config.proxyUrl;
  return 'https://api.anthropic.com/v1/messages';
}

function extractTextContent(data: Record<string, unknown>): string {
  const content = data.content as
    | Array<{ type: string; text?: string }>
    | undefined;
  if (!Array.isArray(content)) {
    throw new Error('Unexpected API response: missing content array');
  }

  const textBlock = content.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Unexpected API response: no text block');
  }

  return textBlock.text;
}

function extractUsage(data: Record<string, unknown>): TokenUsage {
  const usage = data.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    model: (data.model as string) ?? 'unknown',
  };
}

// =============================================================================
// Prompt Construction
// =============================================================================

function buildApiPrompt(context: CoachingContext): {
  system: string;
  user: string;
} {
  const base = toPrompt(context);

  const systemWithFormat = [
    base.system,
    '',
    'RESPONSE FORMAT:',
    'Respond with a JSON object matching one of these types:',
    '',
    '1. Text coaching cue:',
    '{"type":"text","message":"Your coaching message here"}',
    '',
    '2. Load adjustment cue:',
    '{"type":"load_adjustment","message":"Explanation","suggestedLoad":135,"direction":"decrease"}',
    '',
    '3. Encouragement cue:',
    '{"type":"encouragement","message":"Great work! ..."}',
    '',
    'Rules:',
    '- Return ONLY the JSON object, no markdown or extra text',
    '- Use "load_adjustment" when the data clearly indicates a load change is needed',
    '- Use "encouragement" when performance is strong or a PR is hit',
    '- Use "text" for general coaching advice',
    '- Keep messages under 200 characters',
  ].join('\n');

  return { system: systemWithFormat, user: base.user };
}
