/**
 * Coaching Feedback Loop Tests
 *
 * Tests the full coaching feedback cycle:
 * - Compliance assessment (did athlete follow advice?)
 * - Context building (with previous cue feedback)
 * - Coaching store (cue management, reactions)
 * - Response parsing (extracting weight suggestions from text)
 * - Loop orchestration (end-to-end flow)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assessCompliance,
  buildComplianceRecord,
  buildCoachingContext,
  toPrompt,
} from '../coaching-context-builder';
import { parseCoachingResponse } from '../claude-api';
import { createCoachingStore } from '../coaching-store';
import { executeCoachingLoop } from '../coaching-loop';
import type { ReactedCue, CoachingCue } from '../types';
import { mockCompletedSet, createTestExercise, planBuilder } from '@/__fixtures__/generators';
import { createExerciseSession, addCompletedSet, type ExerciseSession } from '@/domain/workout';

// =============================================================================
// Helpers
// =============================================================================

function createCue(overrides: Partial<CoachingCue> = {}): CoachingCue {
  return {
    id: 'cue-1',
    message: 'Drop to 80kg for better velocity',
    suggestedLoadDelta: -5,
    suggestedWeight: 80,
    afterSetIndex: 0,
    generatedAt: 1000,
    ...overrides,
  };
}

function createReactedCue(overrides: Partial<ReactedCue> = {}): ReactedCue {
  return {
    ...createCue(),
    reaction: 'thumbs_up',
    reactedAt: 1500,
    ...overrides,
  };
}

function buildTestSession(weights: number[], velocities: number[][]): ExerciseSession {
  const exercise = createTestExercise({ id: 'bench', name: 'Bench Press' });
  const plan = planBuilder()
    .exerciseId('bench')
    .sets(weights.map((w, i) => ({ weight: w, targetReps: 5, rirTarget: 2, isWarmup: false, setNumber: i + 1 })))
    .build();

  let session = createExerciseSession(exercise, plan);

  for (let i = 0; i < weights.length && i < velocities.length; i++) {
    const set = mockCompletedSet({
      exerciseId: 'bench',
      weight: weights[i],
      velocities: velocities[i],
    });
    session = addCompletedSet(session, set);
  }

  return session;
}

// =============================================================================
// Compliance Assessment
// =============================================================================

describe('assessCompliance', () => {
  it('returns unknown when no actual weight is available', () => {
    const cue = createReactedCue({ suggestedLoadDelta: -5, suggestedWeight: 80 });
    expect(assessCompliance(cue, null, 85)).toBe('unknown');
  });

  it('returns followed when athlete used the suggested weight', () => {
    const cue = createReactedCue({ suggestedLoadDelta: -5, suggestedWeight: 80 });
    expect(assessCompliance(cue, 80, 85)).toBe('followed');
  });

  it('returns followed when weight is within tolerance', () => {
    const cue = createReactedCue({ suggestedLoadDelta: -5, suggestedWeight: 80 });
    expect(assessCompliance(cue, 82, 85)).toBe('followed');
  });

  it('returns followed when delta is zero (maintain weight)', () => {
    const cue = createReactedCue({ suggestedLoadDelta: 0, suggestedWeight: null });
    expect(assessCompliance(cue, 85, 85)).toBe('followed');
  });

  it('returns partial when athlete moved toward suggestion but not fully', () => {
    const cue = createReactedCue({ suggestedLoadDelta: -10, suggestedWeight: 75 });
    expect(assessCompliance(cue, 80, 85)).toBe('partial');
  });

  it('returns ignored when athlete did not follow the suggestion', () => {
    const cue = createReactedCue({ suggestedLoadDelta: -5, suggestedWeight: 80 });
    expect(assessCompliance(cue, 85, 85)).toBe('ignored');
  });

  it('handles increase suggestions correctly', () => {
    const cue = createReactedCue({ suggestedLoadDelta: 5, suggestedWeight: 90 });
    expect(assessCompliance(cue, 90, 85)).toBe('followed');
  });
});

// =============================================================================
// Compliance Records
// =============================================================================

describe('buildComplianceRecord', () => {
  it('builds a record when athlete followed advice and velocity improved', () => {
    const session = buildTestSession(
      [85, 80],
      [[0.42, 0.40, 0.38], [0.51, 0.49, 0.47]]
    );

    const cue = createReactedCue({
      afterSetIndex: 0,
      suggestedLoadDelta: -5,
      suggestedWeight: 80,
      message: 'Drop to 80lbs',
    });

    const record = buildComplianceRecord(cue, session);

    expect(record.compliance).toBe('followed');
    expect(record.actualWeight).toBe(80);
    expect(record.actualVelocity).toBeGreaterThan(0);
    expect(record.previousVelocity).toBeGreaterThan(0);
    expect(record.summary).toContain('followed');
    expect(record.summary).toContain('80lbs');
  });

  it('builds a record when no follow-up set exists', () => {
    const session = buildTestSession([85], [[0.42, 0.40, 0.38]]);

    const cue = createReactedCue({
      afterSetIndex: 0,
      suggestedLoadDelta: -5,
      suggestedWeight: 80,
      message: 'Drop to 80lbs',
    });

    const record = buildComplianceRecord(cue, session);

    expect(record.compliance).toBe('unknown');
    expect(record.actualWeight).toBeNull();
    expect(record.summary).toContain('No follow-up set');
  });
});

// =============================================================================
// Context Building
// =============================================================================

describe('buildCoachingContext', () => {
  it('builds context with no previous cues', () => {
    const session = buildTestSession([85], [[0.55, 0.52, 0.50]]);
    const context = buildCoachingContext(session, [], null);

    expect(context.exerciseName).toBe('Bench Press');
    expect(context.currentSetIndex).toBe(1);
    expect(context.completedSetsSummary).toHaveLength(1);
    expect(context.previousCueFeedback).toHaveLength(0);
  });

  it('includes previous cue feedback with compliance info', () => {
    const session = buildTestSession(
      [85, 80],
      [[0.42, 0.40], [0.51, 0.49]]
    );

    const cue = createReactedCue({
      afterSetIndex: 0,
      suggestedLoadDelta: -5,
      suggestedWeight: 80,
      message: 'Drop to 80lbs',
      reaction: 'thumbs_up',
    });

    const context = buildCoachingContext(session, [cue], null);

    expect(context.previousCueFeedback).toHaveLength(1);
    expect(context.previousCueFeedback[0]).toContain('followed');
    expect(context.previousCueFeedback[0]).toContain('thumbs_up');
  });

  it('includes auto-regulation context when available', () => {
    const session = buildTestSession([85], [[0.55, 0.52]]);
    const autoReg = {
      loadSuggestion: {
        currentWeight: 85,
        suggestedWeight: 80,
        direction: 'decrease' as const,
        reason: 'velocity declining',
        confidence: 'high' as const,
      },
      velocityWarning: null,
      junkVolumeAlert: null,
      autoStopSignal: { shouldStop: false, reason: undefined, message: '' },
      planResult: null,
      restSeconds: 120,
      message: '',
    };

    const context = buildCoachingContext(session, [], autoReg);

    expect(context.autoRegulationContext).toContain('decrease');
    expect(context.autoRegulationContext).toContain('80lbs');
  });
});

// =============================================================================
// Prompt Generation
// =============================================================================

describe('toPrompt', () => {
  it('generates a structured prompt string', () => {
    const session = buildTestSession([85], [[0.55, 0.52]]);
    const context = buildCoachingContext(session, [], null);
    const prompt = toPrompt(context);

    expect(prompt).toContain('Bench Press');
    expect(prompt).toContain('Set 1 of');
    expect(prompt).toContain('85lbs');
    expect(prompt).toContain('actionable coaching cue');
  });

  it('includes previous feedback in prompt', () => {
    const session = buildTestSession(
      [85, 80],
      [[0.42, 0.40], [0.51, 0.49]]
    );

    const cue = createReactedCue({
      afterSetIndex: 0,
      message: 'Drop to 80lbs',
      reaction: 'thumbs_up',
    });

    const context = buildCoachingContext(session, [cue], null);
    const prompt = toPrompt(context);

    expect(prompt).toContain('Previous coaching feedback');
    expect(prompt).toContain('thumbs_up');
  });
});

// =============================================================================
// Response Parsing
// =============================================================================

describe('parseCoachingResponse', () => {
  it('extracts weight suggestion from decrease advice', () => {
    const cue = parseCoachingResponse('Drop to 80 lbs for better bar speed.', 1);

    expect(cue.message).toBe('Drop to 80 lbs for better bar speed.');
    expect(cue.suggestedWeight).toBe(80);
    expect(cue.suggestedLoadDelta).toBeLessThanOrEqual(0);
    expect(cue.afterSetIndex).toBe(1);
  });

  it('extracts weight suggestion from increase advice', () => {
    const cue = parseCoachingResponse('Add weight, go to 90 lbs next set.', 2);

    expect(cue.suggestedWeight).toBe(90);
    expect(cue.suggestedLoadDelta).toBeGreaterThanOrEqual(0);
    expect(cue.afterSetIndex).toBe(2);
  });

  it('handles response with no weight suggestion', () => {
    const cue = parseCoachingResponse('Great tempo! Keep that same intensity.', 0);

    expect(cue.suggestedWeight).toBeNull();
    expect(cue.suggestedLoadDelta).toBe(0);
  });

  it('generates a unique ID', () => {
    const cue1 = parseCoachingResponse('Test 1', 0);
    const cue2 = parseCoachingResponse('Test 2', 0);

    expect(cue1.id).not.toBe(cue2.id);
  });
});

// =============================================================================
// Coaching Store
// =============================================================================

describe('coaching store', () => {
  let store: ReturnType<typeof createCoachingStore>;

  beforeEach(() => {
    store = createCoachingStore();
  });

  it('starts with empty state', () => {
    const state = store.getState();
    expect(state.cues).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.isEnabled).toBe(true);
  });

  it('enqueues a cue with null reaction', () => {
    const cue = createCue();
    store.getState().enqueueCue(cue);

    const state = store.getState();
    expect(state.cues).toHaveLength(1);
    expect(state.cues[0].reaction).toBeNull();
    expect(state.cues[0].reactedAt).toBeNull();
  });

  it('records athlete reaction to a cue', () => {
    const cue = createCue({ id: 'cue-42' });
    store.getState().enqueueCue(cue);
    store.getState().reactToCue('cue-42', 'thumbs_up');

    const state = store.getState();
    expect(state.cues[0].reaction).toBe('thumbs_up');
    expect(state.cues[0].reactedAt).toBeGreaterThan(0);
  });

  it('returns only reacted cues via getReactedCues', () => {
    store.getState().enqueueCue(createCue({ id: 'cue-1' }));
    store.getState().enqueueCue(createCue({ id: 'cue-2' }));
    store.getState().reactToCue('cue-1', 'thumbs_down');

    const reacted = store.getState().getReactedCues();
    expect(reacted).toHaveLength(1);
    expect(reacted[0].id).toBe('cue-1');
  });

  it('returns latest cue', () => {
    store.getState().enqueueCue(createCue({ id: 'cue-1', afterSetIndex: 0 }));
    store.getState().enqueueCue(createCue({ id: 'cue-2', afterSetIndex: 1 }));

    const latest = store.getState().getLatestCue();
    expect(latest?.id).toBe('cue-2');
  });

  it('returns cue for a specific set index', () => {
    store.getState().enqueueCue(createCue({ id: 'cue-1', afterSetIndex: 0 }));
    store.getState().enqueueCue(createCue({ id: 'cue-2', afterSetIndex: 2 }));

    expect(store.getState().getCueForSet(2)?.id).toBe('cue-2');
    expect(store.getState().getCueForSet(1)).toBeNull();
  });

  it('resets to initial state', () => {
    store.getState().enqueueCue(createCue());
    store.getState().setError('test error');
    store.getState().reset();

    const state = store.getState();
    expect(state.cues).toHaveLength(0);
    expect(state.error).toBeNull();
  });

  it('returns null for latest cue when empty', () => {
    expect(store.getState().getLatestCue()).toBeNull();
  });
});

// =============================================================================
// Coaching Loop (Integration)
// =============================================================================

describe('executeCoachingLoop', () => {
  const mockApiConfig = { apiKey: 'test-key' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when coaching is disabled', async () => {
    const session = buildTestSession([85], [[0.5, 0.48]]);
    const store = createCoachingStore();
    store.getState().setEnabled(false);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await executeCoachingLoop(session, null, store, mockApiConfig);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(store.getState().cues).toHaveLength(0);
  });

  it('enqueues cue on successful API response', async () => {
    const session = buildTestSession([85], [[0.5, 0.48]]);
    const store = createCoachingStore();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Great speed! Maintain 85 lbs.' }],
        }),
        { status: 200 }
      )
    );

    await executeCoachingLoop(session, null, store, mockApiConfig);

    expect(store.getState().cues).toHaveLength(1);
    expect(store.getState().cues[0].message).toContain('Great speed');
    expect(store.getState().isLoading).toBe(false);
  });

  it('handles API failure gracefully', async () => {
    const session = buildTestSession([85], [[0.5, 0.48]]);
    const store = createCoachingStore();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await executeCoachingLoop(session, null, store, mockApiConfig);

    expect(store.getState().cues).toHaveLength(0);
    expect(store.getState().error).toBe('Network error');
    expect(store.getState().isLoading).toBe(false);
  });

  it('includes reacted cues in context for multi-turn coherence', async () => {
    const session = buildTestSession(
      [85, 80, 80],
      [[0.42, 0.40], [0.51, 0.49], [0.50, 0.48]]
    );

    const store = createCoachingStore();
    store.getState().enqueueCue(createCue({
      id: 'cue-first',
      afterSetIndex: 0,
      message: 'Drop to 80lbs',
    }));
    store.getState().reactToCue('cue-first', 'thumbs_up');

    let capturedBody = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : '';
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Good compliance. Stay at 80 lbs.' }],
        }),
        { status: 200 }
      );
    });

    await executeCoachingLoop(session, null, store, mockApiConfig);

    const parsedBody = JSON.parse(capturedBody);
    const userMessage: string = parsedBody.messages[0].content;
    expect(userMessage).toContain('Previous coaching feedback');
    expect(userMessage).toContain('thumbs_up');
  });
});
