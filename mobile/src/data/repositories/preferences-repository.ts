/**
 * Preferences Repository Implementation
 * 
 * Handles persistence of user preferences and device state.
 */

import { StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import { Device, UserPreferences, DEFAULT_PREFERENCES } from '@/data/models';
import type { PreferencesRepository } from './types';

const PREFERENCES_KEY = 'voltra:preferences:user';

/**
 * Implementation of PreferencesRepository using a StorageAdapter.
 */
export class PreferencesRepositoryImpl implements PreferencesRepository {
  constructor(private adapter: StorageAdapter) {}
  
  async getLastDevice(): Promise<Device | null> {
    return this.adapter.get<Device>(STORAGE_KEYS.LAST_DEVICE);
  }
  
  async saveLastDevice(device: Device): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.LAST_DEVICE, device);
  }
  
  async clearLastDevice(): Promise<void> {
    await this.adapter.remove(STORAGE_KEYS.LAST_DEVICE);
  }
  
  async isAutoReconnectEnabled(): Promise<boolean> {
    const enabled = await this.adapter.get<boolean>(STORAGE_KEYS.AUTO_RECONNECT);
    // Default to true if not set
    return enabled ?? true;
  }
  
  async setAutoReconnectEnabled(enabled: boolean): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.AUTO_RECONNECT, enabled);
  }
  
  async getPreferences(): Promise<UserPreferences> {
    const stored = await this.adapter.get<Partial<UserPreferences>>(PREFERENCES_KEY);
    
    // Merge with defaults
    return {
      ...DEFAULT_PREFERENCES,
      ...stored,
    };
  }
  
  async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    const current = await this.getPreferences();
    const updated = {
      ...current,
      ...prefs,
    };
    await this.adapter.set(PREFERENCES_KEY, updated);
  }
}
