/**
 * In-Memory Storage Adapter
 *
 * Implements StorageAdapter using a simple Map.
 * Useful for testing and development without persistence.
 */

import { type StorageAdapter } from './types';

/**
 * In-memory implementation of StorageAdapter.
 * Data is lost when the app restarts.
 */
export class InMemoryAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();

  /**
   * Create a new InMemoryAdapter.
   * @param initialData Optional initial data to populate
   */
  constructor(initialData?: Map<string, unknown>) {
    if (initialData) {
      for (const [key, value] of initialData) {
        this.storage.set(key, JSON.stringify(value));
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
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
    this.storage.delete(key);
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.storage.keys());

    if (prefix) {
      return allKeys.filter((k) => k.startsWith(prefix));
    }

    return allKeys;
  }

  async clear(): Promise<void> {
    this.storage.clear();
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

  /**
   * Get the raw storage map (for testing/debugging).
   */
  getRawStorage(): Map<string, string> {
    return new Map(this.storage);
  }

  /**
   * Get the count of stored items.
   */
  size(): number {
    return this.storage.size;
  }
}
