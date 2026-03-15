/**
 * Preferences Storage
 *
 * Simplified storage functions for device and connection preferences.
 * Only exposes the operations that are actually used.
 */

import { getMMKVAdapter } from '@/data/provider';
import { STORAGE_KEYS } from '@/data/adapters';
import type { Device } from './preferences-schema';

/**
 * Get the last connected device, if any.
 */
export async function getLastDevice(): Promise<Device | null> {
  return getMMKVAdapter().get<Device>(STORAGE_KEYS.LAST_DEVICE);
}

/**
 * Save the last connected device for auto-reconnect.
 */
export async function saveLastDevice(device: Device): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.LAST_DEVICE, device);
}

/**
 * Clear the last device (e.g., on manual disconnect).
 */
export async function clearLastDevice(): Promise<void> {
  await getMMKVAdapter().remove(STORAGE_KEYS.LAST_DEVICE);
}

/**
 * Check if auto-reconnect is enabled.
 * Defaults to true if not explicitly set.
 */
export async function isAutoReconnectEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(STORAGE_KEYS.AUTO_RECONNECT);
  return enabled ?? true;
}

/**
 * Enable or disable auto-reconnect.
 */
export async function setAutoReconnectEnabled(enabled: boolean): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.AUTO_RECONNECT, enabled);
}

/**
 * Check if haptic cues are enabled during rest timer.
 * Defaults to true if not explicitly set.
 */
export async function isHapticCuesEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(STORAGE_KEYS.HAPTIC_CUES_ENABLED);
  return enabled ?? true;
}

/**
 * Enable or disable haptic cues during rest timer.
 */
export async function setHapticCuesEnabled(enabled: boolean): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.HAPTIC_CUES_ENABLED, enabled);
}

/**
 * Check if audio cues are enabled during rest timer.
 * Defaults to true if not explicitly set.
 */
export async function isAudioCuesEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(STORAGE_KEYS.AUDIO_CUES_ENABLED);
  return enabled ?? true;
}

/**
 * Enable or disable audio cues during rest timer.
 */
export async function setAudioCuesEnabled(enabled: boolean): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.AUDIO_CUES_ENABLED, enabled);
}

/**
 * Check if AI coaching is enabled.
 * Defaults to false if not explicitly set.
 */
export async function isAICoachingEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(STORAGE_KEYS.AI_COACHING_ENABLED);
  return enabled ?? false;
}

/**
 * Enable or disable AI coaching during sessions.
 */
export async function setAICoachingEnabled(enabled: boolean): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.AI_COACHING_ENABLED, enabled);
}

/**
 * Check if voice coaching (TTS) is enabled.
 * Defaults to false if not explicitly set.
 */
export async function isVoiceCoachingEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(STORAGE_KEYS.VOICE_COACHING_ENABLED);
  return enabled ?? false;
}

/**
 * Enable or disable voice coaching (TTS) for coaching cues.
 */
export async function setVoiceCoachingEnabled(enabled: boolean): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.VOICE_COACHING_ENABLED, enabled);
}


export async function isVelocityAutoStopEnabled(): Promise<boolean> {
  const enabled = await getMMKVAdapter().get<boolean>(
    STORAGE_KEYS.VELOCITY_AUTO_STOP_ENABLED,
  );
  return enabled ?? false;
}

export async function setVelocityAutoStopEnabled(
  enabled: boolean,
): Promise<void> {
  await getMMKVAdapter().set(STORAGE_KEYS.VELOCITY_AUTO_STOP_ENABLED, enabled);
}

export async function getVelocityAutoStopThreshold(): Promise<number> {
  const threshold = await getMMKVAdapter().get<number>(
    STORAGE_KEYS.VELOCITY_AUTO_STOP_THRESHOLD,
  );
  return threshold ?? 20;
}

export async function setVelocityAutoStopThreshold(
  threshold: number,
): Promise<void> {
  await getMMKVAdapter().set(
    STORAGE_KEYS.VELOCITY_AUTO_STOP_THRESHOLD,
    threshold,
  );
}
