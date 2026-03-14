/**
 * Notifications Module
 *
 * Haptic and audio feedback services for workout cues.
 */

// Haptic feedback
export { triggerHaptic, triggerNotificationHaptic, isHapticsSupported } from './haptic-service';
export type { HapticIntensity } from './haptic-service';

// Audio cues
export { playAudioCue, isAudioSupported } from './audio-cue-service';
export type { AudioCueType } from './audio-cue-service';

// Rest timer cue orchestration
export {
  fireRestTimerCues,
  getMatchingThreshold,
  DEFAULT_CUE_THRESHOLDS,
} from './rest-timer-cues';
export type { RestTimerCueSettings, CueThreshold } from './rest-timer-cues';
