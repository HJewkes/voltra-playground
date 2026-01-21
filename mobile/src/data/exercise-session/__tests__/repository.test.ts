/**
 * Exercise Session Repository Tests
 *
 * Tests for the ExerciseSessionRepository using InMemoryAdapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import {
  createExerciseSessionRepository,
  type ExerciseSessionRepository,
} from '../exercise-session-repository';
import type { StoredExerciseSession } from '../exercise-session-schema';
import { TrainingGoal } from '@/domain/planning';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  const id = `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    startTime: Date.now(),
    endTime: Date.now() + 30000,
    plan: {
      exerciseId: 'cable_row',
      sets: [{ setNumber: 1, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false }],
      defaultRestSeconds: 120,
      goal: TrainingGoal.HYPERTROPHY,
      generatedAt: Date.now(),
      generatedBy: 'standard',
    },
    completedSets: [],
    status: 'completed',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ExerciseSessionRepository', () => {
  let adapter: InMemoryAdapter;
  let repo: ExerciseSessionRepository;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    repo = createExerciseSessionRepository(adapter);
  });

  describe('save()', () => {
    it('stores session and updates index', async () => {
      const session = createTestSession();

      await repo.save(session);

      // Verify session is stored
      const retrieved = await repo.getById(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.exerciseId).toBe(session.exerciseId);
    });

    it('adds new sessions to front of index', async () => {
      const session1 = createTestSession({ id: 'session-1' });
      const session2 = createTestSession({ id: 'session-2' });

      await repo.save(session1);
      await repo.save(session2);

      const recent = await repo.getRecent(2);
      expect(recent.length).toBe(2);
      // session2 should be first (most recent)
      expect(recent[0].id).toBe('session-2');
      expect(recent[1].id).toBe('session-1');
    });

    it('does not duplicate session in index on update', async () => {
      const session = createTestSession({ id: 'session-update' });

      await repo.save(session);
      await repo.save({ ...session, status: 'abandoned' });

      const recent = await repo.getRecent(10);
      const matches = recent.filter((s) => s.id === 'session-update');
      expect(matches.length).toBe(1);
    });
  });

  describe('getById()', () => {
    it('retrieves saved session', async () => {
      const session = createTestSession({ id: 'get-by-id-test' });
      await repo.save(session);

      const retrieved = await repo.getById('get-by-id-test');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('get-by-id-test');
      expect(retrieved?.exerciseName).toBe('Seated Cable Row');
    });

    it('returns null for non-existent session', async () => {
      const retrieved = await repo.getById('does-not-exist');
      expect(retrieved).toBeNull();
    });
  });

  describe('getRecent()', () => {
    it('returns sessions in order (most recent first)', async () => {
      const session1 = createTestSession({ id: 'recent-1', startTime: 1000 });
      const session2 = createTestSession({ id: 'recent-2', startTime: 2000 });
      const session3 = createTestSession({ id: 'recent-3', startTime: 3000 });

      await repo.save(session1);
      await repo.save(session2);
      await repo.save(session3);

      const recent = await repo.getRecent(3);

      expect(recent.length).toBe(3);
      // Should be sorted by startTime descending
      expect(recent[0].id).toBe('recent-3');
      expect(recent[1].id).toBe('recent-2');
      expect(recent[2].id).toBe('recent-1');
    });

    it('limits results to requested count', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.save(createTestSession({ id: `limit-${i}` }));
      }

      const recent = await repo.getRecent(2);
      expect(recent.length).toBe(2);
    });
  });

  describe('delete()', () => {
    it('removes session and updates index', async () => {
      const session = createTestSession({ id: 'delete-test' });
      await repo.save(session);

      await repo.delete('delete-test');

      const retrieved = await repo.getById('delete-test');
      expect(retrieved).toBeNull();

      const recent = await repo.getRecent(10);
      const found = recent.find((s) => s.id === 'delete-test');
      expect(found).toBeUndefined();
    });

    it('clears current session if deleted', async () => {
      const session = createTestSession({ id: 'current-delete', status: 'in_progress' });
      await repo.save(session);
      await repo.setCurrent('current-delete');

      await repo.delete('current-delete');

      const current = await repo.getCurrent();
      expect(current).toBeNull();
    });
  });

  describe('getCurrent() / setCurrent()', () => {
    it('gets and sets current session', async () => {
      const session = createTestSession({ id: 'current-test', status: 'in_progress' });
      await repo.save(session);
      await repo.setCurrent('current-test');

      const current = await repo.getCurrent();
      expect(current).not.toBeNull();
      expect(current?.id).toBe('current-test');
    });

    it('clears current with null', async () => {
      const session = createTestSession({ id: 'clear-current', status: 'in_progress' });
      await repo.save(session);
      await repo.setCurrent('clear-current');
      await repo.setCurrent(null);

      const current = await repo.getCurrent();
      expect(current).toBeNull();
    });
  });

  describe('getInProgress()', () => {
    it('returns in-progress session', async () => {
      const session = createTestSession({ id: 'in-progress', status: 'in_progress' });
      await repo.save(session);
      await repo.setCurrent('in-progress');

      const inProgress = await repo.getInProgress();
      expect(inProgress).not.toBeNull();
      expect(inProgress?.id).toBe('in-progress');
    });

    it('returns null if current session is not in_progress', async () => {
      const session = createTestSession({ id: 'completed', status: 'completed' });
      await repo.save(session);
      await repo.setCurrent('completed');

      const inProgress = await repo.getInProgress();
      expect(inProgress).toBeNull();
    });
  });

  describe('getByExercise()', () => {
    it('filters sessions by exercise ID', async () => {
      const row1 = createTestSession({ id: 'row-1', exerciseId: 'cable_row' });
      const row2 = createTestSession({ id: 'row-2', exerciseId: 'cable_row' });
      const curl = createTestSession({ id: 'curl-1', exerciseId: 'bicep_curl' });

      await repo.save(row1);
      await repo.save(row2);
      await repo.save(curl);

      const rowSessions = await repo.getByExercise('cable_row');
      expect(rowSessions.length).toBe(2);
      expect(rowSessions.every((s) => s.exerciseId === 'cable_row')).toBe(true);
    });
  });
});
