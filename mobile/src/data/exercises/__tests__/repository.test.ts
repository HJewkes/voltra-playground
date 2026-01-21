/**
 * Exercise Repository Tests
 *
 * Tests for the ExerciseRepository using InMemoryAdapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import { createExerciseRepository, type ExerciseRepository } from '../exercise-repository';
import type { StoredExercise } from '../exercise-schema';
import { MuscleGroup } from '@/domain/exercise';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestExercise(overrides: Partial<StoredExercise> = {}): StoredExercise {
  const id = `test-exercise-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    name: 'Test Exercise',
    muscleGroups: [MuscleGroup.BACK],
    movementPattern: 'pull',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ExerciseRepository', () => {
  let adapter: InMemoryAdapter;
  let repo: ExerciseRepository;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    repo = createExerciseRepository(adapter);
  });

  describe('save()', () => {
    it('stores exercise and updates index', async () => {
      const exercise = createTestExercise();

      await repo.save(exercise);

      const retrieved = await repo.getById(exercise.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(exercise.id);
      expect(retrieved?.name).toBe(exercise.name);
    });

    it('does not duplicate in index on update', async () => {
      const exercise = createTestExercise({ id: 'update-test' });

      await repo.save(exercise);
      await repo.save({ ...exercise, name: 'Updated Name' });

      const count = await repo.count();
      expect(count).toBe(1);

      const retrieved = await repo.getById('update-test');
      expect(retrieved?.name).toBe('Updated Name');
    });
  });

  describe('getById()', () => {
    it('retrieves saved exercise', async () => {
      const exercise = createTestExercise({ id: 'get-by-id-test', name: 'Cable Row' });
      await repo.save(exercise);

      const retrieved = await repo.getById('get-by-id-test');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('get-by-id-test');
      expect(retrieved?.name).toBe('Cable Row');
    });

    it('returns null for non-existent exercise', async () => {
      const retrieved = await repo.getById('does-not-exist');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('returns all exercises sorted alphabetically', async () => {
      const exercise1 = createTestExercise({ id: 'ex-1', name: 'Zebra Exercise' });
      const exercise2 = createTestExercise({ id: 'ex-2', name: 'Alpha Exercise' });
      const exercise3 = createTestExercise({ id: 'ex-3', name: 'Middle Exercise' });

      await repo.save(exercise1);
      await repo.save(exercise2);
      await repo.save(exercise3);

      const all = await repo.getAll();

      expect(all.length).toBe(3);
      expect(all[0].name).toBe('Alpha Exercise');
      expect(all[1].name).toBe('Middle Exercise');
      expect(all[2].name).toBe('Zebra Exercise');
    });

    it('returns empty array when no exercises', async () => {
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('delete()', () => {
    it('removes exercise and updates index', async () => {
      const exercise = createTestExercise({ id: 'delete-test' });
      await repo.save(exercise);

      await repo.delete('delete-test');

      const retrieved = await repo.getById('delete-test');
      expect(retrieved).toBeNull();

      const count = await repo.count();
      expect(count).toBe(0);
    });

    it('does nothing when deleting non-existent exercise', async () => {
      // Should not throw
      await repo.delete('does-not-exist');
      const count = await repo.count();
      expect(count).toBe(0);
    });
  });

  describe('exists()', () => {
    it('returns true for existing exercise', async () => {
      const exercise = createTestExercise({ id: 'exists-test' });
      await repo.save(exercise);

      const exists = await repo.exists('exists-test');
      expect(exists).toBe(true);
    });

    it('returns false for non-existent exercise', async () => {
      const exists = await repo.exists('does-not-exist');
      expect(exists).toBe(false);
    });
  });

  describe('count()', () => {
    it('returns correct count', async () => {
      expect(await repo.count()).toBe(0);

      await repo.save(createTestExercise({ id: 'count-1' }));
      expect(await repo.count()).toBe(1);

      await repo.save(createTestExercise({ id: 'count-2' }));
      expect(await repo.count()).toBe(2);

      await repo.delete('count-1');
      expect(await repo.count()).toBe(1);
    });
  });
});
