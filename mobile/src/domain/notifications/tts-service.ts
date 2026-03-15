/**
 * Text-to-Speech Service
 *
 * Speaks coaching cue text via expo-speech with platform-safe lazy loading.
 * Gracefully degrades on unsupported platforms (web).
 */

import { Platform } from 'react-native';
import type * as ExpoSpeech from 'expo-speech';

type SpeechModule = typeof ExpoSpeech;

let speechModule: SpeechModule | null = null;
let speechSupported = false;

/**
 * Lazily load expo-speech. Returns null on web or if the module is unavailable.
 */
async function ensureModule(): Promise<SpeechModule | null> {
  if (speechModule) return speechModule;

  if (Platform.OS === 'web') {
    speechSupported = false;
    return null;
  }

  try {
    speechModule = await import('expo-speech');
    speechSupported = true;
    return speechModule;
  } catch {
    speechSupported = false;
    return null;
  }
}

/**
 * Speak a coaching cue aloud.
 * Stops any in-progress speech before starting the new utterance.
 * Returns immediately — speech runs asynchronously.
 */
export async function speakCue(text: string): Promise<void> {
  const mod = await ensureModule();
  if (!mod) return;

  try {
    // Stop any ongoing speech so the new cue isn't queued behind it
    if (await mod.isSpeakingAsync()) {
      mod.stop();
    }

    mod.speak(text, {
      rate: 0.9,
      pitch: 1.0,
    });
  } catch {
    // Speech failure is non-critical; workout continues unaffected
  }
}

/**
 * Immediately stop any ongoing speech.
 */
export function stopSpeaking(): void {
  if (!speechModule) return;

  try {
    speechModule.stop();
  } catch {
    // Ignore stop errors
  }
}

/**
 * Check if TTS is supported on this platform.
 */
export function isTTSSupported(): boolean {
  return speechSupported;
}

/**
 * Reset module state (for testing).
 */
export function _resetTTSModule(): void {
  speechModule = null;
  speechSupported = false;
}
