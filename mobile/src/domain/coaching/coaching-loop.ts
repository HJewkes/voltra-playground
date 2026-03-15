/**
 * Coaching Feedback Loop
 *
 * Orchestrates the full coaching cycle:
 * set completes → build context (with feedback) → call Claude → enqueue cue
 *
 * This is the integration point that wires the context builder,
 * Claude API, and coaching store together.
 */

import type { ExerciseSession } from '@/domain/workout';
import type { AutoRegulationState } from '@/domain/planning/auto-regulation';
import type { CoachingStoreApi } from './coaching-store';
import type { ClaudeApiConfig } from './claude-api';
import type { CueStyle } from './types';
import { getCoachingCue } from './claude-api';
import { buildCoachingContext } from './coaching-context-builder';

/**
 * Rest duration threshold in milliseconds.
 * Cues delivered before this threshold are 'brief'; after are 'detailed'.
 */
export const BRIEF_CUE_THRESHOLD_MS = 10_000;

/**
 * Determine cue style based on how long into the rest period we are.
 *
 * Right after set completion (< 10s), use brief 3-5 word directives.
 * During extended rest (>= 10s), use detailed 1-2 sentence coaching.
 */
export function resolveCueStyle(restElapsedMs: number): CueStyle {
  return restElapsedMs < BRIEF_CUE_THRESHOLD_MS ? 'brief' : 'detailed';
}

/**
 * Execute one iteration of the coaching feedback loop.
 *
 * Called after each set completes, during the rest period.
 * Non-blocking: failures are swallowed since coaching is supplementary.
 *
 * @param restElapsedMs - Milliseconds elapsed since the set ended.
 *   Pass 0 (or omit) for an immediate post-set cue; pass the elapsed
 *   rest time for a mid-rest detailed cue.
 */
export async function executeCoachingLoop(
  session: ExerciseSession,
  autoRegulation: AutoRegulationState | null,
  coachingStore: CoachingStoreApi,
  apiConfig: ClaudeApiConfig,
  restElapsedMs = 0
): Promise<void> {
  const state = coachingStore.getState();
  if (!state.isEnabled) return;

  coachingStore.getState().setLoading(true);

  const cueStyle = resolveCueStyle(restElapsedMs);

  try {
    const reactedCues = state.getReactedCues();
    const context = buildCoachingContext(
      session,
      reactedCues,
      autoRegulation,
      cueStyle
    );
    const cue = await getCoachingCue(context, apiConfig);

    if (cue) {
      coachingStore.getState().enqueueCue(cue);
    } else {
      coachingStore.getState().setLoading(false);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    coachingStore.getState().setError(message);
  }
}
