/**
 * MMKV Adapter Tests
 *
 * Tests for the MMKV-based storage adapter including:
 * - Basic CRUD operations (get, set, remove)
 * - Batch operations (getMultiple, setMultiple)
 * - Key listing and filtering
 * - Edge cases (invalid JSON, empty values)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MMKVAdapter } from '../mmkv-adapter';

// =============================================================================
// Mock MMKV
// =============================================================================

const { mockStorage } = vi.hoisted(() => {
  const mockStorage = new Map<string, string>();
  return { mockStorage };
});

vi.mock('react-native-mmkv', () => {
  return {
    createMMKV: () => ({
      getString: (key: string) => mockStorage.get(key),
      set: (key: string, value: string) => mockStorage.set(key, value),
      remove: (key: string) => mockStorage.delete(key),
      getAllKeys: () => Array.from(mockStorage.keys()),
    }),
  };
});

// =============================================================================
// Test Setup
// =============================================================================

describe('MMKVAdapter', () => {
  let adapter: MMKVAdapter;

  beforeEach(() => {
    mockStorage.clear();
    adapter = new MMKVAdapter('test-mmkv');
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
    beforeEach(() => {
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
      expect(mockStorage.has('other-key')).toBe(true);
    });
  });

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  describe('getMultiple', () => {
    beforeEach(() => {
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
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles deeply nested objects', async () => {
      const nested = { level1: { level2: { value: 'deep' } } };

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
      const unicode = { message: '你好世界 مرحبا' };

      await adapter.set('unicode', unicode);
      const result = await adapter.get<typeof unicode>('unicode');

      expect(result).toEqual(unicode);
    });
  });
});
