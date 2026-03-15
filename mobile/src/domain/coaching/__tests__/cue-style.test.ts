/**
 * Cue Style Tests
 *
 * Verifies that the coaching system correctly selects 'brief' vs 'detailed'
 * cue styles based on rest elapsed time, and that the style propagates
 * through context building and prompt generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveCueStyle, BRIEF_CUE_THRESHOLD_MS, executeCoachingLoop } from '../coaching-loop';
import { buildCoachingContext, toPrompt } from '../coaching-context-builder';
import { createCoachingStore } from '../coaching-store';
import { mockCompletedSet, createTestExercise, planBuilder } from '@/__fixtures__/generators';
import { createExerciseSession, addCompletedSet } from '@/domain/workout';

// =============================================================================
// Helpers
// =============================================================================

function buildTestSession() {
  const exercise = createTestExercise({ id: 'squat', name: 'Squat' });
  const plan = planBuilder()
    .exerciseId('squat')
    .sets([{ weight: 100, targetReps: 5, rirTarget: 2, isWarmup: false, setNumber: 1 }])
    .build();

  let session = createExerciseSession(exercise, plan);
  const set = mockCompletedSet({ exerciseId: 'squat', weight: 100, velocities: [0.6, 0.58, 0.55] });
  session = addCompletedSet(session, set);
  return session;
}

// =============================================================================
// resolveCueStyle
// =============================================================================

describe('resolveCueStyle', () => {
  it('returns "brief" immediately after set completion (0ms)', () => {
    expect(resolveCueStyle(0)).toBe('brief');
  });

  it('returns "brief" just before the threshold', () => {
    expect(resolveCueStyle(BRIEF_CUE_THRESHOLD_MS - 1)).toBe('brief');
  });

  it('returns "detailed" at the threshold', () => {
    expect(resolveCueStyle(BRIEF_CUE_THRESHOLD_MS)).toBe('detailed');
  });

  it('returns "detailed" well into the rest period', () => {
    expect(resolveCueStyle(60_000)).toBe('detailed');
  });

  it('threshold is 10 seconds', () => {
    expect(BRIEF_CUE_THRESHOLD_MS).toBe(10_000);
  });
});

// =============================================================================
// buildCoachingContext — cueStyle propagation
// =============================================================================

describe('buildCoachingContext with cueStyle', () => {
  it('defaults cueStyle to "brief" when omitted', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null);
    expect(context.cueStyle).toBe('brief');
  });

  it('propagates "brief" when explicitly passed', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'brief');
    expect(context.cueStyle).toBe('brief');
  });

  it('propagates "detailed" when explicitly passed', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'detailed');
    expect(context.cueStyle).toBe('detailed');
  });
});

// =============================================================================
// toPrompt — style-specific instructions
// =============================================================================

describe('toPrompt with cueStyle', () => {
  it('includes brief directive for "brief" style', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'brief');
    const prompt = toPrompt(context);

    expect(prompt).toContain('3-5 words');
    expect(prompt).toContain('directive');
  });

  it('does not include sentence limit for "brief" style', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'brief');
    const prompt = toPrompt(context);

    expect(prompt).not.toContain('2 sentences');
  });

  it('includes sentence guidance for "detailed" style', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'detailed');
    const prompt = toPrompt(context);

    expect(prompt).toContain('2 sentences');
  });

  it('does not include word limit for "detailed" style', () => {
    const session = buildTestSession();
    const context = buildCoachingContext(session, [], null, 'detailed');
    const prompt = toPrompt(context);

    expect(prompt).not.toContain('3-5 words');
  });
});

// =============================================================================
// executeCoachingLoop — cue style selection
// =============================================================================

describe('executeCoachingLoop cue style', () => {
  const mockApiConfig = { apiKey: 'test-key' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses "brief" style when restElapsedMs is 0 (default)', async () => {
    const session = buildTestSession();
    const store = createCoachingStore();

    let capturedBody = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : '';
      return new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'Drive faster.' }] }),
        { status: 200 },
      );
    });

    await executeCoachingLoop(session, null, store, mockApiConfig);

    const body = JSON.parse(capturedBody);
    const userMessage: string = body.messages[0].content;
    expect(userMessage).toContain('3-5 words');
  });

  it('uses "brief" style when restElapsedMs is below threshold', async () => {
    const session = buildTestSession();
    const store = createCoachingStore();

    let capturedBody = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : '';
      return new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'Lock hips.' }] }),
        { status: 200 },
      );
    });

    await executeCoachingLoop(session, null, store, mockApiConfig, 5_000);

    const body = JSON.parse(capturedBody);
    const userMessage: string = body.messages[0].content;
    expect(userMessage).toContain('3-5 words');
  });

  it('uses "detailed" style when restElapsedMs meets or exceeds threshold', async () => {
    const session = buildTestSession();
    const store = createCoachingStore();

    let capturedBody = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : '';
      return new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'Good velocity, drop 5 lbs next set.' }] }),
        { status: 200 },
      );
    });

    await executeCoachingLoop(session, null, store, mockApiConfig, 30_000);

    const body = JSON.parse(capturedBody);
    const userMessage: string = body.messages[0].content;
    expect(userMessage).toContain('2 sentences');
  });
});
