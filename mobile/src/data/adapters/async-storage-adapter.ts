/**
 * AsyncStorage Adapter
 * 
 * Implements StorageAdapter using React Native's AsyncStorage.
 * Includes migration logic for updating data schema between versions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAdapter, STORAGE_KEYS, CURRENT_STORAGE_VERSION } from './types';

/**
 * AsyncStorage-based implementation of StorageAdapter.
 */
export class AsyncStorageAdapter implements StorageAdapter {
  private migrated = false;
  
  /**
   * Ensure storage has been migrated to current schema version.
   * Call this before any read/write operations.
   */
  async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    
    const versionStr = await AsyncStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
    const version = versionStr ? parseInt(versionStr, 10) : 1;
    
    if (version < CURRENT_STORAGE_VERSION) {
      await this.migrate(version);
      await AsyncStorage.setItem(
        STORAGE_KEYS.STORAGE_VERSION, 
        String(CURRENT_STORAGE_VERSION)
      );
    }
    
    this.migrated = true;
  }
  
  /**
   * Run migrations from old version to current.
   */
  private async migrate(fromVersion: number): Promise<void> {
    console.log(`[Storage] Migrating from v${fromVersion} to v${CURRENT_STORAGE_VERSION}`);
    
    if (fromVersion < 2) {
      await this.migrateV1ToV2();
    }
    
    console.log('[Storage] Migration complete');
  }
  
  /**
   * Migrate from v1 (old scattered keys) to v2 (namespaced keys).
   */
  private async migrateV1ToV2(): Promise<void> {
    console.log('[Storage] Running v1 -> v2 migration');
    
    // Map old keys to new keys
    const keyMappings: [string, string][] = [
      ['voltra_workouts', STORAGE_KEYS.WORKOUTS_INDEX],
      ['voltra_last_connected_device', STORAGE_KEYS.LAST_DEVICE],
      ['voltra_auto_reconnect_enabled', STORAGE_KEYS.AUTO_RECONNECT],
      ['voltra_discovery_sessions', STORAGE_KEYS.DISCOVERY_INDEX],
    ];
    
    for (const [oldKey, newKey] of keyMappings) {
      const value = await AsyncStorage.getItem(oldKey);
      if (value !== null) {
        await AsyncStorage.setItem(newKey, value);
        // Keep old data for safety - can be removed in future version
        console.log(`[Storage] Migrated ${oldKey} -> ${newKey}`);
      }
    }
    
    // Migrate individual workout items
    const allKeys = await AsyncStorage.getAllKeys();
    const workoutKeys = allKeys.filter(k => k.startsWith('voltra_workout_'));
    
    for (const oldKey of workoutKeys) {
      const id = oldKey.replace('voltra_workout_', '');
      const newKey = `${STORAGE_KEYS.WORKOUT_PREFIX}${id}`;
      const value = await AsyncStorage.getItem(oldKey);
      if (value !== null) {
        await AsyncStorage.setItem(newKey, value);
        console.log(`[Storage] Migrated workout ${id}`);
      }
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    await this.ensureMigrated();
    
    const value = await AsyncStorage.getItem(key);
    if (value === null) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      // If not valid JSON, return as-is (for simple strings)
      return value as unknown as T;
    }
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureMigrated();
    
    const serialized = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
    
    await AsyncStorage.setItem(key, serialized);
  }
  
  async remove(key: string): Promise<void> {
    await this.ensureMigrated();
    await AsyncStorage.removeItem(key);
  }
  
  async keys(prefix?: string): Promise<string[]> {
    await this.ensureMigrated();
    
    const allKeys = await AsyncStorage.getAllKeys();
    
    if (prefix) {
      return allKeys.filter(k => k.startsWith(prefix));
    }
    
    // Only return our namespaced keys
    return allKeys.filter(k => k.startsWith('voltra:'));
  }
  
  async clear(): Promise<void> {
    // Only clear our namespaced keys, not all AsyncStorage
    const ourKeys = await this.keys();
    await AsyncStorage.multiRemove(ourKeys);
    this.migrated = false;
  }
  
  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    await this.ensureMigrated();
    
    const pairs = await AsyncStorage.multiGet(keys);
    const result = new Map<string, T | null>();
    
    for (const [key, value] of pairs) {
      if (value === null) {
        result.set(key, null);
      } else {
        try {
          result.set(key, JSON.parse(value) as T);
        } catch {
          result.set(key, value as unknown as T);
        }
      }
    }
    
    return result;
  }
  
  async setMultiple<T>(entries: Array<[string, T]>): Promise<void> {
    await this.ensureMigrated();
    
    const pairs: Array<[string, string]> = entries.map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]);
    
    await AsyncStorage.multiSet(pairs);
  }
}

/**
 * Singleton instance of AsyncStorageAdapter.
 */
export const asyncStorageAdapter = new AsyncStorageAdapter();
