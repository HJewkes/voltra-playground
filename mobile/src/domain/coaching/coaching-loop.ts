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
import { getCoachingCue } from './claude-api';
import { buildCoachingContext } from './coaching-context-builder';

/**
 * Execute one iteration of the coaching feedback loop.
 *
 * Called after each set completes, during the rest period.
 * Non-blocking: failures are swallowed since coaching is supplementary.
 */
export async function executeCoachingLoop(
  session: ExerciseSession,
  autoRegulation: AutoRegulationState | null,
  coachingStore: CoachingStoreApi,
  apiConfig: ClaudeApiConfig
): Promise<void> {
  const state = coachingStore.getState();
  if (!state.isEnabled) return;

  coachingStore.getState().setLoading(true);

  try {
    const reactedCues = state.getReactedCues();
    const context = buildCoachingContext(session, reactedCues, autoRegulation);
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
