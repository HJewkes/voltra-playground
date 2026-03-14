/**
 * Audio Cue Service
 *
 * Plays short audio cues for rest timer warnings and completion.
 * Wraps expo-av with platform-safe lazy loading.
 */

import { Platform } from 'react-native';

export type AudioCueType = 'warning' | 'complete';

let audioModule: typeof import('expo-av') | null = null;
let audioSupported = false;

/**
 * Lazily load expo-av. Returns null on unsupported platforms.
 */
async function ensureModule(): Promise<typeof import('expo-av') | null> {
  if (audioModule) return audioModule;

  try {
    audioModule = await import('expo-av');
    audioSupported = true;

    // Configure audio session for mixing with other audio
    if (Platform.OS !== 'web') {
      await audioModule.Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
    }

    return audioModule;
  } catch {
    audioSupported = false;
    return null;
  }
}

/**
 * Frequency and duration for each cue type.
 * Warning: short single beep. Complete: longer distinct tone.
 */
const CUE_CONFIG: Record<AudioCueType, { frequencyHz: number; durationMs: number }> = {
  warning: { frequencyHz: 880, durationMs: 150 },
  complete: { frequencyHz: 1200, durationMs: 400 },
};

/**
 * Play an audio cue using an oscillator-style approach via expo-av.
 * Falls back to a silent no-op on unsupported platforms.
 */
export async function playAudioCue(type: AudioCueType): Promise<void> {
  const mod = await ensureModule();
  if (!mod) return;

  const config = CUE_CONFIG[type];

  try {
    // Use a generated tone via Audio.Sound with a data URI
    // expo-av supports wav data URIs on native
    const wavDataUri = generateToneDataUri(config.frequencyHz, config.durationMs);
    const { sound } = await mod.Audio.Sound.createAsync(
      { uri: wavDataUri },
      { shouldPlay: true, volume: 0.7 }
    );

    // Clean up after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // Audio playback failed silently — not critical for workout flow
  }
}

/**
 * Check if audio cues are supported on this platform.
 */
export function isAudioSupported(): boolean {
  return audioSupported;
}

/**
 * Generate a WAV data URI with a simple sine tone.
 */
function generateToneDataUri(frequencyHz: number, durationMs: number): string {
  const sampleRate = 22050;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataLength = numSamples * 2; // 16-bit samples
  const fileLength = 44 + dataLength;

  const buffer = new ArrayBuffer(fileLength);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Generate sine wave with fade-in/fade-out envelope
  const fadeLength = Math.min(numSamples / 4, sampleRate * 0.02);
  for (let i = 0; i < numSamples; i++) {
    let amplitude = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);

    // Fade envelope to avoid clicks
    if (i < fadeLength) {
      amplitude *= i / fadeLength;
    } else if (i > numSamples - fadeLength) {
      amplitude *= (numSamples - i) / fadeLength;
    }

    const sample = Math.max(-1, Math.min(1, amplitude * 0.8));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Reset module state (for testing).
 */
export function _resetAudioModule(): void {
  audioModule = null;
  audioSupported = false;
}
