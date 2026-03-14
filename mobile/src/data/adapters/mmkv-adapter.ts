/**
 * MMKV Storage Adapter
 *
 * Implements StorageAdapter using react-native-mmkv for synchronous,
 * high-performance key-value storage (~30x faster than AsyncStorage).
 * Best suited for small, frequently-accessed data like user preferences
 * and exercise catalog state.
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { StorageAdapter } from './types';

/**
 * MMKV-based implementation of StorageAdapter.
 * All operations are synchronous under the hood but wrapped in Promises
 * to satisfy the StorageAdapter interface.
 */
export class MMKVAdapter implements StorageAdapter {
  private storage: MMKV;

  constructor(id = 'voltra-mmkv') {
    this.storage = createMMKV({ id });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.getString(key);
    if (value === undefined) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.storage.set(key, serialized);
  }

  async remove(key: string): Promise<void> {
    this.storage.remove(key);
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = this.storage.getAllKeys();

    if (prefix) {
      return allKeys.filter((k) => k.startsWith(prefix));
    }

    return allKeys.filter((k) => k.startsWith('voltra:'));
  }

  async clear(): Promise<void> {
    const ourKeys = await this.keys();
    for (const key of ourKeys) {
      this.storage.remove(key);
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }

    return result;
  }

  async setMultiple<T>(entries: Array<[string, T]>): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value);
    }
  }
}
