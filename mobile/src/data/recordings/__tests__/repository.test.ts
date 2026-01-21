/**
 * Recording Repository Tests
 *
 * Tests for the RecordingRepository using InMemoryAdapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import { createRecordingRepository, type RecordingRepository } from '../recording-repository';
import type { SampleRecording } from '../recording-schema';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestRecording(overrides: Partial<SampleRecording> = {}): SampleRecording {
  const id = `test-recording-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    weight: 100,
    recordedAt: Date.now(),
    durationMs: 30000,
    sampleCount: 330,
    samples: [],
    metadata: {},
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('RecordingRepository', () => {
  let adapter: InMemoryAdapter;
  let repo: RecordingRepository;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    repo = createRecordingRepository(adapter);
  });

  describe('save()', () => {
    it('stores recording and updates index', async () => {
      const recording = createTestRecording();

      await repo.save(recording);

      const retrieved = await repo.getById(recording.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(recording.id);
      expect(retrieved?.exerciseName).toBe(recording.exerciseName);
    });

    it('adds new recordings to front of index (most recent first)', async () => {
      const recording1 = createTestRecording({ id: 'rec-1' });
      const recording2 = createTestRecording({ id: 'rec-2' });

      await repo.save(recording1);
      await repo.save(recording2);

      const recent = await repo.getRecent(2);
      expect(recent.length).toBe(2);
      // recording2 should be first (most recent)
      expect(recent[0].id).toBe('rec-2');
      expect(recent[1].id).toBe('rec-1');
    });

    it('does not duplicate in index on update', async () => {
      const recording = createTestRecording({ id: 'update-test' });

      await repo.save(recording);
      await repo.save({ ...recording, weight: 150 });

      const count = await repo.count();
      expect(count).toBe(1);

      const retrieved = await repo.getById('update-test');
      expect(retrieved?.weight).toBe(150);
    });
  });

  describe('getById()', () => {
    it('retrieves saved recording', async () => {
      const recording = createTestRecording({ id: 'get-by-id-test' });
      await repo.save(recording);

      const retrieved = await repo.getById('get-by-id-test');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('get-by-id-test');
      expect(retrieved?.exerciseName).toBe('Seated Cable Row');
    });

    it('returns null for non-existent recording', async () => {
      const retrieved = await repo.getById('does-not-exist');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('returns recordings in order (most recent first)', async () => {
      const recording1 = createTestRecording({ id: 'rec-1' });
      const recording2 = createTestRecording({ id: 'rec-2' });
      const recording3 = createTestRecording({ id: 'rec-3' });

      await repo.save(recording1);
      await repo.save(recording2);
      await repo.save(recording3);

      const all = await repo.getAll();

      expect(all.length).toBe(3);
      // Most recent first (last saved)
      expect(all[0].id).toBe('rec-3');
      expect(all[1].id).toBe('rec-2');
      expect(all[2].id).toBe('rec-1');
    });

    it('returns empty array when no recordings', async () => {
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('getRecent()', () => {
    it('limits results to requested count', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.save(createTestRecording({ id: `limit-${i}` }));
      }

      const recent = await repo.getRecent(2);
      expect(recent.length).toBe(2);
    });

    it('returns all if count exceeds available', async () => {
      await repo.save(createTestRecording({ id: 'only-one' }));

      const recent = await repo.getRecent(10);
      expect(recent.length).toBe(1);
    });

    it('returns empty array when no recordings', async () => {
      const recent = await repo.getRecent(5);
      expect(recent).toEqual([]);
    });
  });

  describe('delete()', () => {
    it('removes recording and updates index', async () => {
      const recording = createTestRecording({ id: 'delete-test' });
      await repo.save(recording);

      await repo.delete('delete-test');

      const retrieved = await repo.getById('delete-test');
      expect(retrieved).toBeNull();

      const count = await repo.count();
      expect(count).toBe(0);
    });

    it('maintains order after deletion', async () => {
      await repo.save(createTestRecording({ id: 'rec-1' }));
      await repo.save(createTestRecording({ id: 'rec-2' }));
      await repo.save(createTestRecording({ id: 'rec-3' }));

      await repo.delete('rec-2');

      const all = await repo.getAll();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe('rec-3');
      expect(all[1].id).toBe('rec-1');
    });
  });

  describe('count()', () => {
    it('returns correct count', async () => {
      expect(await repo.count()).toBe(0);

      await repo.save(createTestRecording({ id: 'count-1' }));
      expect(await repo.count()).toBe(1);

      await repo.save(createTestRecording({ id: 'count-2' }));
      expect(await repo.count()).toBe(2);

      await repo.delete('count-1');
      expect(await repo.count()).toBe(1);
    });
  });
});
