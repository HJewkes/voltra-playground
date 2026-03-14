/**
 * Rest Timer Cues
 *
 * Orchestrates haptic and audio feedback during rest timer countdown.
 */

import { triggerHaptic, triggerNotificationHaptic } from './haptic-service';
import { playAudioCue } from './audio-cue-service';

export interface RestTimerCueSettings { hapticEnabled: boolean; audioEnabled: boolean; }
export interface CueThreshold { seconds: number; type: 'warning' | 'complete'; }

export const DEFAULT_CUE_THRESHOLDS: readonly CueThreshold[] = [
  { seconds: 30, type: 'warning' },
  { seconds: 10, type: 'warning' },
  { seconds: 0, type: 'complete' },
] as const;

const DEFAULT_SETTINGS: RestTimerCueSettings = { hapticEnabled: true, audioEnabled: true };

export function getMatchingThreshold(
  secondsRemaining: number,
  thresholds: readonly CueThreshold[] = DEFAULT_CUE_THRESHOLDS
): CueThreshold | null {
  return thresholds.find((t) => t.seconds === secondsRemaining) ?? null;
}

export async function fireRestTimerCues(
  secondsRemaining: number,
  settings: RestTimerCueSettings = DEFAULT_SETTINGS,
  thresholds: readonly CueThreshold[] = DEFAULT_CUE_THRESHOLDS
): Promise<void> {
  const threshold = getMatchingThreshold(secondsRemaining, thresholds);
  if (!threshold) return;
  const promises: Promise<void>[] = [];
  if (settings.hapticEnabled) {
    promises.push(threshold.type === 'warning' ? triggerHaptic('light') : triggerNotificationHaptic('success'));
  }
  if (settings.audioEnabled) { promises.push(playAudioCue(threshold.type)); }
  await Promise.all(promises);
}
