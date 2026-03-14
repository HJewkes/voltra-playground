/**
 * Audio Cue Service
 *
 * Plays short audio cues for rest timer warnings and completion.
 * Wraps expo-av with platform-safe lazy loading.
 */

import { Platform } from 'react-native';

export type AudioCueType = 'warning' | 'complete';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let audioModule: typeof import('expo-av') | null = null;
let audioSupported = false;

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
async function ensureModule(): Promise<typeof import('expo-av') | null> {
  if (audioModule) return audioModule;
  try {
    audioModule = await import('expo-av');
    audioSupported = true;
    if (Platform.OS !== 'web') {
      await audioModule.Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    }
    return audioModule;
  } catch { audioSupported = false; return null; }
}

const CUE_CONFIG: Record<AudioCueType, { frequencyHz: number; durationMs: number }> = {
  warning: { frequencyHz: 880, durationMs: 150 },
  complete: { frequencyHz: 1200, durationMs: 400 },
};

export async function playAudioCue(type: AudioCueType): Promise<void> {
  const mod = await ensureModule();
  if (!mod) return;
  const config = CUE_CONFIG[type];
  try {
    const wavDataUri = generateToneDataUri(config.frequencyHz, config.durationMs);
    const { sound } = await mod.Audio.Sound.createAsync({ uri: wavDataUri }, { shouldPlay: true, volume: 0.7 });
    sound.setOnPlaybackStatusUpdate((status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) { sound.unloadAsync().catch(() => {}); }
    });
  } catch { /* Audio playback failed silently */ }
}

export function isAudioSupported(): boolean { return audioSupported; }

function generateToneDataUri(frequencyHz: number, durationMs: number): string {
  const sampleRate = 22050;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataLength = numSamples * 2;
  const fileLength = 44 + dataLength;
  const buffer = new ArrayBuffer(fileLength);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  const fadeLength = Math.min(numSamples / 4, sampleRate * 0.02);
  for (let i = 0; i < numSamples; i++) {
    let amplitude = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
    if (i < fadeLength) amplitude *= i / fadeLength;
    else if (i > numSamples - fadeLength) amplitude *= (numSamples - i) / fadeLength;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amplitude * 0.8)) * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
