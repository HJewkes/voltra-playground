/**
 * Claude API Service Tests
 *
 * Verifies that the Claude API service correctly calls the API,
 * handles responses, manages errors, and tracks token usage.
 * All network calls are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCoachingCue, DEFAULT_MODEL } from '../claude-api';
import type { CoachingContext } from '../types';
import type { CoachingApiConfig } from '../claude-api-types';

// =============================================================================
// Mocks
// =============================================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../coaching-context-builder', () => ({
  toPrompt: (ctx: CoachingContext) => ({
    system: 'You are a strength coach.',
    user: `Set ${ctx.currentSet.setNumber}: ${ctx.currentSet.meanVelocity} m/s`,
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

function createContext(
  overrides: Partial<CoachingContext> = {},
): CoachingContext {
  return {
    currentSet: {
      exerciseName: 'Squat',
      exerciseId: 'squat',
      setNumber: 2,
      load: 225,
      reps: 5,
      meanVelocity: 0.5,
      peakVelocity: 0.8,
      velocityLossPercent: 12,
      estimatedRPE: 7.5,
      estimatedRIR: 2.5,
    },
    session: {
      exerciseName: 'Squat',
      setsCompleted: 2,
      setsPlanned: 5,
      sessionDurationMinutes: 10,
      fatigueTrend: {
        velocityRecoveryPercent: 90,
        repDropPercent: 5,
        isJunkVolume: false,
        fatigueLevel: 0.3,
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

function createConfig(
  overrides: Partial<CoachingApiConfig> = {},
): CoachingApiConfig {
  return {
    apiKey: 'test-api-key',
    ...overrides,
  };
}

function mockApiResponse(
  content: string,
  usage = { input_tokens: 100, output_tokens: 50 },
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: content }],
      usage,
      model: DEFAULT_MODEL,
    }),
  });
}

function mockApiError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('getCoachingCue', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('successful API calls', () => {
    it('returns a parsed text cue from valid JSON response', async () => {
      mockApiResponse(
        '{"type":"text","message":"Good velocity, keep it up."}',
      );

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result).toEqual({
        type: 'text',
        message: 'Good velocity, keep it up.',
      });
    });

    it('returns a parsed load adjustment cue', async () => {
      const response = JSON.stringify({
        type: 'load_adjustment',
        message: 'Drop weight for better speed.',
        suggestedLoad: 205,
        direction: 'decrease',
      });
      mockApiResponse(response);

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result).toEqual({
        type: 'load_adjustment',
        message: 'Drop weight for better speed.',
        suggestedLoad: 205,
        direction: 'decrease',
      });
    });

    it('returns a parsed encouragement cue', async () => {
      mockApiResponse('{"type":"encouragement","message":"Crushing it!"}');

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result).toEqual({
        type: 'encouragement',
        message: 'Crushing it!',
      });
    });

    it('falls back to text cue for non-JSON response', async () => {
      mockApiResponse('Keep pushing through, great form!');

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result).toEqual({
        type: 'text',
        message: 'Keep pushing through, great form!',
      });
    });
  });

  describe('API request format', () => {
    it('sends correct headers for direct API calls', async () => {
      mockApiResponse('{"type":"text","message":"ok"}');

      await getCoachingCue(createContext(), createConfig());

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.headers['x-api-key']).toBe('test-api-key');
      expect(options.headers['anthropic-version']).toBe('2023-06-01');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('sends to proxy URL when configured', async () => {
      mockApiResponse('{"type":"text","message":"ok"}');

      await getCoachingCue(
        createContext(),
        createConfig({
          proxyUrl: 'https://my-proxy.example.com/coaching',
        }),
      );

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://my-proxy.example.com/coaching');
      expect(options.headers['x-api-key']).toBeUndefined();
      expect(options.headers['anthropic-version']).toBeUndefined();
    });

    it('includes model and max_tokens in request body', async () => {
      mockApiResponse('{"type":"text","message":"ok"}');

      await getCoachingCue(
        createContext(),
        createConfig({
          model: 'claude-haiku-4-20250514',
          maxTokens: 256,
        }),
      );

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe('claude-haiku-4-20250514');
      expect(body.max_tokens).toBe(256);
    });

    it('uses default model when not specified', async () => {
      mockApiResponse('{"type":"text","message":"ok"}');

      await getCoachingCue(createContext(), createConfig());

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe(DEFAULT_MODEL);
    });

    it('includes system and user messages in body', async () => {
      mockApiResponse('{"type":"text","message":"ok"}');

      await getCoachingCue(createContext(), createConfig());

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.system).toContain('strength coach');
      expect(body.system).toContain('RESPONSE FORMAT');
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
    });
  });

  describe('token usage tracking', () => {
    it('calls onTokenUsage with usage data', async () => {
      mockApiResponse('{"type":"text","message":"ok"}', {
        input_tokens: 250,
        output_tokens: 75,
      });

      const onTokenUsage = vi.fn();
      await getCoachingCue(
        createContext(),
        createConfig({ onTokenUsage }),
      );

      expect(onTokenUsage).toHaveBeenCalledWith({
        inputTokens: 250,
        outputTokens: 75,
        model: DEFAULT_MODEL,
      });
    });

    it('handles missing usage gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: '{"type":"text","message":"ok"}' },
          ],
          model: DEFAULT_MODEL,
        }),
      });

      const onTokenUsage = vi.fn();
      await getCoachingCue(
        createContext(),
        createConfig({ onTokenUsage }),
      );

      expect(onTokenUsage).toHaveBeenCalledWith({
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
      });
    });
  });

  describe('error handling', () => {
    it('returns fallback cue on API error', async () => {
      mockApiError(429, 'Rate limited');

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result.type).toBe('text');
      expect(result.message).toContain('Set 2');
    });

    it('calls onError callback on failure', async () => {
      mockApiError(500, 'Internal Server Error');

      const onError = vi.fn();
      await getCoachingCue(createContext(), createConfig({ onError }));

      expect(onError).toHaveBeenCalledWith(
        'Claude API 500: Internal Server Error',
      );
    });

    it('returns fallback cue on network error', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result.type).toBe('text');
    });

    it('returns fallback cue on malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: 'format' }),
      });

      const result = await getCoachingCue(createContext(), createConfig());

      expect(result.type).toBe('text');
    });

    it('returns fallback with junk volume warning when detected', async () => {
      mockApiError(500, 'error');

      const context = createContext({
        autoRegulation: {
          readinessZone: 'red',
          readinessConfidence: 0.9,
          velocityWarningSeverity: null,
          velocityWarningMessage: null,
          junkVolumeDetected: true,
          loadSuggestion: null,
        },
      });

      const result = await getCoachingCue(context, createConfig());

      expect(result.message).toContain('wrapping up');
    });

    it('returns fallback on request abort', async () => {
      mockFetch.mockImplementation(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            if (opts.signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            opts.signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const result = await getCoachingCue(
        createContext(),
        createConfig({ timeoutMs: 1 }),
      );

      expect(result.type).toBe('text');
    });
  });
});
