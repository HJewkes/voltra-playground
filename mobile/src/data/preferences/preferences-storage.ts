/**
 * Preferences Storage
 * 
 * Simplified storage functions for device and connection preferences.
 * Only exposes the operations that are actually used.
 */

import { asyncStorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import type { Device } from './preferences-schema';

/**
 * Get the last connected device, if any.
 */
export async function getLastDevice(): Promise<Device | null> {
  return asyncStorageAdapter.get<Device>(STORAGE_KEYS.LAST_DEVICE);
}

/**
 * Save the last connected device for auto-reconnect.
 */
export async function saveLastDevice(device: Device): Promise<void> {
  await asyncStorageAdapter.set(STORAGE_KEYS.LAST_DEVICE, device);
}

/**
 * Clear the last device (e.g., on manual disconnect).
 */
export async function clearLastDevice(): Promise<void> {
  await asyncStorageAdapter.remove(STORAGE_KEYS.LAST_DEVICE);
}

/**
 * Check if auto-reconnect is enabled.
 * Defaults to true if not explicitly set.
 */
export async function isAutoReconnectEnabled(): Promise<boolean> {
  const enabled = await asyncStorageAdapter.get<boolean>(STORAGE_KEYS.AUTO_RECONNECT);
  return enabled ?? true;
}

/**
 * Enable or disable auto-reconnect.
 */
export async function setAutoReconnectEnabled(enabled: boolean): Promise<void> {
  await asyncStorageAdapter.set(STORAGE_KEYS.AUTO_RECONNECT, enabled);
}
