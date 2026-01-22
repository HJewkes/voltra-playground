/**
 * AsyncStorage Adapter Tests
 *
 * Tests for the AsyncStorage-based storage adapter including:
 * - Basic CRUD operations (get, set, remove)
 * - Batch operations (getMultiple, setMultiple)
 * - Key listing and filtering
 * - Migration logic
 * - Edge cases (invalid JSON, empty values)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsyncStorageAdapter } from '../async-storage-adapter';
import { STORAGE_KEYS, CURRENT_STORAGE_VERSION } from '../types';

// =============================================================================
// Mock AsyncStorage
// =============================================================================

const mockStorage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Array.from(mockStorage.keys()))),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(
        keys.map((key) => [key, mockStorage.get(key) ?? null] as [string, string | null])
      )
    ),
    multiSet: vi.fn((pairs: [string, string][]) => {
      for (const [key, value] of pairs) {
        mockStorage.set(key, value);
      }
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      for (const key of keys) {
        mockStorage.delete(key);
      }
      return Promise.resolve();
    }),
  },
}));

// =============================================================================
// Test Setup
// =============================================================================

describe('AsyncStorageAdapter', () => {
  let adapter: AsyncStorageAdapter;

  beforeEach(() => {
    mockStorage.clear();
    // Set current version to avoid migration on each test
    mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, String(CURRENT_STORAGE_VERSION));
    adapter = new AsyncStorageAdapter();
  });

  // ===========================================================================
  // Basic Operations
  // ===========================================================================

  describe('get', () => {
    it('returns null for non-existent key', async () => {
      const result = await adapter.get('non-existent');

      expect(result).toBeNull();
    });

    it('returns parsed JSON for valid JSON value', async () => {
      mockStorage.set('test-key', JSON.stringify({ foo: 'bar' }));

      const result = await adapter.get<{ foo: string }>('test-key');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns raw string for non-JSON value', async () => {
      mockStorage.set('test-key', 'plain string');

      const result = await adapter.get<string>('test-key');

      expect(result).toBe('plain string');
    });

    it('handles numeric values', async () => {
      mockStorage.set('test-key', '42');

      const result = await adapter.get<number>('test-key');

      expect(result).toBe(42);
    });

    it('handles boolean values', async () => {
      mockStorage.set('test-key', 'true');

      const result = await adapter.get<boolean>('test-key');

      expect(result).toBe(true);
    });

    it('handles array values', async () => {
      mockStorage.set('test-key', JSON.stringify([1, 2, 3]));

      const result = await adapter.get<number[]>('test-key');

      expect(result).toEqual([1, 2, 3]);
    });

    it('handles null JSON value', async () => {
      mockStorage.set('test-key', 'null');

      const result = await adapter.get<null>('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('sets JSON serialized object', async () => {
      await adapter.set('test-key', { foo: 'bar' });

      expect(mockStorage.get('test-key')).toBe('{"foo":"bar"}');
    });

    it('sets string value directly without double-serializing', async () => {
      await adapter.set('test-key', 'plain string');

      expect(mockStorage.get('test-key')).toBe('plain string');
    });

    it('sets numeric value', async () => {
      await adapter.set('test-key', 42);

      expect(mockStorage.get('test-key')).toBe('42');
    });

    it('sets boolean value', async () => {
      await adapter.set('test-key', true);

      expect(mockStorage.get('test-key')).toBe('true');
    });

    it('sets array value', async () => {
      await adapter.set('test-key', [1, 2, 3]);

      expect(mockStorage.get('test-key')).toBe('[1,2,3]');
    });

    it('overwrites existing value', async () => {
      mockStorage.set('test-key', 'old value');

      await adapter.set('test-key', 'new value');

      expect(mockStorage.get('test-key')).toBe('new value');
    });
  });

  describe('remove', () => {
    it('removes existing key', async () => {
      mockStorage.set('test-key', 'value');

      await adapter.remove('test-key');

      expect(mockStorage.has('test-key')).toBe(false);
    });

    it('handles non-existent key gracefully', async () => {
      await expect(adapter.remove('non-existent')).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // Key Operations
  // ===========================================================================

  describe('keys', () => {
    beforeEach(async () => {
      mockStorage.set('voltra:workouts:1', 'workout1');
      mockStorage.set('voltra:workouts:2', 'workout2');
      mockStorage.set('voltra:exercises:1', 'exercise1');
      mockStorage.set('other-key', 'other');
    });

    it('returns all voltra-namespaced keys without prefix', async () => {
      const keys = await adapter.keys();

      expect(keys).toContain('voltra:workouts:1');
      expect(keys).toContain('voltra:workouts:2');
      expect(keys).toContain('voltra:exercises:1');
      expect(keys).not.toContain('other-key');
    });

    it('filters by prefix', async () => {
      const keys = await adapter.keys('voltra:workouts:');

      expect(keys).toHaveLength(2);
      expect(keys).toContain('voltra:workouts:1');
      expect(keys).toContain('voltra:workouts:2');
      expect(keys).not.toContain('voltra:exercises:1');
    });

    it('returns empty array when no keys match prefix', async () => {
      const keys = await adapter.keys('voltra:recordings:');

      expect(keys).toEqual([]);
    });
  });

  describe('clear', () => {
    it('removes all voltra-namespaced keys', async () => {
      mockStorage.set('voltra:test1', 'value1');
      mockStorage.set('voltra:test2', 'value2');
      mockStorage.set('other-key', 'other');

      await adapter.clear();

      expect(mockStorage.has('voltra:test1')).toBe(false);
      expect(mockStorage.has('voltra:test2')).toBe(false);
      expect(mockStorage.has('other-key')).toBe(true); // Preserved
    });

    it('resets migrated state', async () => {
      // First operation triggers migration check
      await adapter.get('test');

      // Clear should reset migrated flag
      await adapter.clear();

      // Next operation should re-check migration
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, String(CURRENT_STORAGE_VERSION));
      await adapter.get('test');

      // Verify getItem was called again for version check
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      expect(AsyncStorage.default.getItem).toHaveBeenCalledWith(STORAGE_KEYS.STORAGE_VERSION);
    });
  });

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  describe('getMultiple', () => {
    beforeEach(async () => {
      mockStorage.set('key1', JSON.stringify({ id: 1 }));
      mockStorage.set('key2', JSON.stringify({ id: 2 }));
    });

    it('returns map of values for multiple keys', async () => {
      const result = await adapter.getMultiple<{ id: number }>(['key1', 'key2']);

      expect(result.get('key1')).toEqual({ id: 1 });
      expect(result.get('key2')).toEqual({ id: 2 });
    });

    it('returns null for missing keys in result', async () => {
      const result = await adapter.getMultiple<{ id: number }>(['key1', 'missing']);

      expect(result.get('key1')).toEqual({ id: 1 });
      expect(result.get('missing')).toBeNull();
    });

    it('handles empty keys array', async () => {
      const result = await adapter.getMultiple<unknown>([]);

      expect(result.size).toBe(0);
    });

    it('handles non-JSON values', async () => {
      mockStorage.set('string-key', 'plain string');

      const result = await adapter.getMultiple<string>(['string-key']);

      expect(result.get('string-key')).toBe('plain string');
    });
  });

  describe('setMultiple', () => {
    it('sets multiple key-value pairs', async () => {
      await adapter.setMultiple([
        ['key1', { id: 1 }],
        ['key2', { id: 2 }],
      ]);

      expect(mockStorage.get('key1')).toBe('{"id":1}');
      expect(mockStorage.get('key2')).toBe('{"id":2}');
    });

    it('handles string values without double-serializing', async () => {
      await adapter.setMultiple([
        ['key1', 'string1'],
        ['key2', 'string2'],
      ]);

      expect(mockStorage.get('key1')).toBe('string1');
      expect(mockStorage.get('key2')).toBe('string2');
    });

    it('handles empty entries array', async () => {
      await expect(adapter.setMultiple([])).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // Migration Tests
  // ===========================================================================

  describe('migration', () => {
    beforeEach(() => {
      mockStorage.clear();
      // Reset to simulate fresh state
      adapter = new AsyncStorageAdapter();
    });

    it('runs migration when storage version is older', async () => {
      // Simulate v1 storage
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, '1');
      mockStorage.set('voltra_workouts', JSON.stringify(['workout1']));
      mockStorage.set('voltra_last_connected_device', JSON.stringify({ id: 'device1' }));

      // Trigger migration via any read operation
      await adapter.get('test');

      // Verify version was updated
      expect(mockStorage.get(STORAGE_KEYS.STORAGE_VERSION)).toBe(String(CURRENT_STORAGE_VERSION));

      // Verify data was migrated to new keys
      expect(mockStorage.get(STORAGE_KEYS.WORKOUTS_INDEX)).toBe(JSON.stringify(['workout1']));
      expect(mockStorage.get(STORAGE_KEYS.LAST_DEVICE)).toBe(JSON.stringify({ id: 'device1' }));
    });

    it('migrates individual workout items', async () => {
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, '1');
      mockStorage.set('voltra_workout_abc123', JSON.stringify({ id: 'abc123' }));
      mockStorage.set('voltra_workout_def456', JSON.stringify({ id: 'def456' }));

      await adapter.get('test');

      expect(mockStorage.get(`${STORAGE_KEYS.WORKOUT_PREFIX}abc123`)).toBe(
        JSON.stringify({ id: 'abc123' })
      );
      expect(mockStorage.get(`${STORAGE_KEYS.WORKOUT_PREFIX}def456`)).toBe(
        JSON.stringify({ id: 'def456' })
      );
    });

    it('handles missing v1 keys gracefully', async () => {
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, '1');
      // No old keys exist

      await expect(adapter.get('test')).resolves.toBeNull();

      // Version should still be updated
      expect(mockStorage.get(STORAGE_KEYS.STORAGE_VERSION)).toBe(String(CURRENT_STORAGE_VERSION));
    });

    it('defaults to version 1 when no version stored', async () => {
      // No version key set
      mockStorage.set('voltra_workouts', JSON.stringify(['workout1']));

      await adapter.get('test');

      // Migration should have run and updated version
      expect(mockStorage.get(STORAGE_KEYS.STORAGE_VERSION)).toBe(String(CURRENT_STORAGE_VERSION));
      expect(mockStorage.get(STORAGE_KEYS.WORKOUTS_INDEX)).toBe(JSON.stringify(['workout1']));
    });

    it('skips migration when already at current version', async () => {
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, String(CURRENT_STORAGE_VERSION));
      mockStorage.set('voltra_workouts', JSON.stringify(['old-workout']));

      await adapter.get('test');

      // Old key should NOT be migrated
      expect(mockStorage.has(STORAGE_KEYS.WORKOUTS_INDEX)).toBe(false);
    });

    it('only runs migration once per adapter instance', async () => {
      // Start with version 1 that needs migration
      mockStorage.set(STORAGE_KEYS.STORAGE_VERSION, '1');
      mockStorage.set('voltra_workouts', JSON.stringify(['workout1']));

      // First operation triggers migration
      await adapter.get('key1');

      // Verify migration ran (data was migrated)
      expect(mockStorage.get(STORAGE_KEYS.WORKOUTS_INDEX)).toBe(JSON.stringify(['workout1']));

      // Now remove the migrated data to test that migration doesn't re-run
      mockStorage.delete(STORAGE_KEYS.WORKOUTS_INDEX);

      // Subsequent operations should NOT re-run migration
      await adapter.set('key2', 'value2');
      await adapter.remove('key3');

      // Migrated data should still be gone (proving migration didn't re-run)
      expect(mockStorage.has(STORAGE_KEYS.WORKOUTS_INDEX)).toBe(false);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles deeply nested objects', async () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      await adapter.set('nested', nested);
      const result = await adapter.get<typeof nested>('nested');

      expect(result).toEqual(nested);
    });

    it('handles special characters in keys', async () => {
      const key = 'voltra:test:key-with_special.chars:123';

      await adapter.set(key, 'value');
      const result = await adapter.get<string>(key);

      expect(result).toBe('value');
    });

    it('handles empty string value', async () => {
      await adapter.set('empty', '');
      const result = await adapter.get<string>('empty');

      expect(result).toBe('');
    });

    it('handles empty object', async () => {
      await adapter.set('empty-obj', {});
      const result = await adapter.get<object>('empty-obj');

      expect(result).toEqual({});
    });

    it('handles empty array', async () => {
      await adapter.set('empty-arr', []);
      const result = await adapter.get<unknown[]>('empty-arr');

      expect(result).toEqual([]);
    });

    it('handles unicode strings', async () => {
      const unicode = { message: '你好世界 🌍 مرحبا' };

      await adapter.set('unicode', unicode);
      const result = await adapter.get<typeof unicode>('unicode');

      expect(result).toEqual(unicode);
    });

    it('handles very long strings', async () => {
      const longString = 'a'.repeat(10000);

      await adapter.set('long', longString);
      const result = await adapter.get<string>('long');

      expect(result).toBe(longString);
    });

    it('handles Date objects (serialized as string)', async () => {
      const date = new Date('2024-01-15T10:30:00Z');

      await adapter.set('date', date);
      const result = await adapter.get<string>('date');

      // Date is serialized to ISO string
      expect(result).toBe(date.toISOString());
    });
  });
});
