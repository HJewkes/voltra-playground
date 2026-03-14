/**
 * Claude API Types
 *
 * Response types for coaching cues and API configuration.
 */

// =============================================================================
// Coaching Cue Types
// =============================================================================

export interface TextCue {
  type: 'text';
  message: string;
}

export interface LoadAdjustmentCue {
  type: 'load_adjustment';
  message: string;
  suggestedLoad: number;
  direction: 'increase' | 'decrease' | 'maintain';
}

export interface EncouragementCue {
  type: 'encouragement';
  message: string;
}

export type CoachingCue = TextCue | LoadAdjustmentCue | EncouragementCue;

// =============================================================================
// API Configuration
// =============================================================================

export interface CoachingApiConfig {
  /** Anthropic API key for direct calls. Not needed when using proxyUrl. */
  apiKey: string;

  /**
   * Optional proxy URL. When set, requests go to this URL instead of
   * the Anthropic API directly. The proxy should forward to Claude
   * and handle authentication server-side.
   *
   * For production, use a thin edge function (Cloudflare Worker,
   * Supabase Edge Function, Expo API Route) that holds the API key.
   */
  proxyUrl?: string;

  /** Claude model to use. Defaults to claude-sonnet-4-20250514. */
  model?: string;

  /** Max tokens for the response. Defaults to 512. */
  maxTokens?: number;

  /** Request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;

  /** Called with token usage after each successful request. */
  onTokenUsage?: (usage: TokenUsage) => void;

  /** Called on API errors (after fallback is returned). */
  onError?: (message: string) => void;
}

// =============================================================================
// Token Usage
// =============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}
