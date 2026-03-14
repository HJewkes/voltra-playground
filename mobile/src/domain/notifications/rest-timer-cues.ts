/**
 * Rest Timer Cues
 *
 * Orchestrates haptic and audio feedback during rest timer countdown.
 * Fires at configurable thresholds (default: 30s, 10s, 0s remaining).
 */

import { triggerHaptic, triggerNotificationHaptic } from './haptic-service';
import { playAudioCue } from './audio-cue-service';

// =============================================================================
// Types
// =============================================================================

export interface RestTimerCueSettings {
  /** Enable haptic feedback during rest timer */
  hapticEnabled: boolean;
  /** Enable audio cues during rest timer */
  audioEnabled: boolean;
}

export interface CueThreshold {
  /** Seconds remaining that triggers this cue */
  seconds: number;
  /** Type of cue: warning (approaching end) or complete (rest done) */
  type: 'warning' | 'complete';
}

// =============================================================================
// Constants
// =============================================================================

/** Default thresholds for rest timer cues */
export const DEFAULT_CUE_THRESHOLDS: readonly CueThreshold[] = [
  { seconds: 30, type: 'warning' },
  { seconds: 10, type: 'warning' },
  { seconds: 0, type: 'complete' },
] as const;

const DEFAULT_SETTINGS: RestTimerCueSettings = {
  hapticEnabled: true,
  audioEnabled: true,
};

// =============================================================================
// Core Logic
// =============================================================================

/**
 * Check if the given countdown value matches any cue threshold.
 * Returns the matching threshold, or null if no match.
 */
export function getMatchingThreshold(
  secondsRemaining: number,
  thresholds: readonly CueThreshold[] = DEFAULT_CUE_THRESHOLDS
): CueThreshold | null {
  return thresholds.find((t) => t.seconds === secondsRemaining) ?? null;
}

/**
 * Fire the appropriate cues for a rest timer tick.
 *
 * Call this on every rest timer tick. It checks the countdown value against
 * thresholds and fires haptic/audio cues as configured.
 *
 * @param secondsRemaining - Current rest countdown value (after decrement)
 * @param settings - User's haptic/audio preferences
 * @param thresholds - Cue thresholds (injectable for testing)
 */
export async function fireRestTimerCues(
  secondsRemaining: number,
  settings: RestTimerCueSettings = DEFAULT_SETTINGS,
  thresholds: readonly CueThreshold[] = DEFAULT_CUE_THRESHOLDS
): Promise<void> {
  const threshold = getMatchingThreshold(secondsRemaining, thresholds);
  if (!threshold) return;

  const promises: Promise<void>[] = [];

  if (settings.hapticEnabled) {
    if (threshold.type === 'warning') {
      promises.push(triggerHaptic('light'));
    } else {
      promises.push(triggerNotificationHaptic('success'));
    }
  }

  if (settings.audioEnabled) {
    promises.push(playAudioCue(threshold.type));
  }

  await Promise.all(promises);
}
