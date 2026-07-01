/**
 * SQLiteExerciseSessionRepository contract tests.
 *
 * Runs against the op-sqlite mock (backed by Node's built-in `node:sqlite`),
 * exercising CRUD, indexed queries, set/rep/telemetry round-trips, and the
 * one-time AsyncStorage -> SQLite migration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MovementPhase, type WorkoutSample } from '@voltras/workout-analytics';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import { createExerciseSessionRepository } from '../exercise-session-repository';
import {
  createSQLiteExerciseSessionRepository,
  openSessionDatabase,
  type SessionDatabase,
} from '../sqlite-exercise-session-repository';
import type { StoredExerciseSession, StoredSessionSet } from '../exercise-session-schema';
import { TrainingGoal } from '@/domain/planning';

// =============================================================================
// Helpers
// =============================================================================

let dbCounter = 0;

function freshDb(): SessionDatabase {
  dbCounter += 1;
  return openSessionDatabase(`sessions-${dbCounter}`);
}

function sample(seq: number, phase: MovementPhase): WorkoutSample {
  return { sequence: seq, timestamp: 1000 + seq, phase, position: seq * 0.1, velocity: 0.5, force: 100 };
}

function makeSet(setIndex: number, repCount = 2): StoredSessionSet {
  const reps = Array.from({ length: repCount }, (_, r) => ({
    repNumber: r + 1,
    concentric: { samples: [sample(r * 2, MovementPhase.CONCENTRIC)] },
    eccentric: { samples: [sample(r * 2 + 1, MovementPhase.ECCENTRIC)] },
  }));
  return {
    setIndex,
    weight: 100 + setIndex,
    reps,
    startTime: 5000,
    endTime: 6000,
    meanVelocity: 0.42,
    estimatedRPE: 8,
    estimatedRIR: 2,
    velocityLossPercent: 12.5,
  };
}

function makeSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  return {
    id: `s-${Math.random().toString(36).slice(2)}`,
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
    completedSets: [makeSet(0)],
    status: 'completed',
    schemaVersion: 2,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('SQLiteExerciseSessionRepository', () => {
  let repo: ReturnType<typeof createSQLiteExerciseSessionRepository>;

  beforeEach(() => {
    repo = createSQLiteExerciseSessionRepository(freshDb());
  });

  describe('save / getById round-trip', () => {
    it('persists session, sets, reps and telemetry samples exactly', async () => {
      const session = makeSession({ id: 'round-trip' });

      await repo.save(session);
      const loaded = await repo.getById('round-trip');

      expect(loaded).toEqual(session);
    });

    it('preserves optional set-level raw telemetry', async () => {
      const set = makeSet(0);
      set.rawSamples = [sample(99, MovementPhase.CONCENTRIC), sample(100, MovementPhase.ECCENTRIC)];
      const session = makeSession({ id: 'raw', completedSets: [set] });

      await repo.save(session);
      const loaded = await repo.getById('raw');

      expect(loaded?.completedSets[0].rawSamples).toEqual(set.rawSamples);
    });

    it('returns null for a missing session', async () => {
      expect(await repo.getById('nope')).toBeNull();
    });

    it('updates in place without duplicating on re-save', async () => {
      const session = makeSession({ id: 'upd' });
      await repo.save(session);
      await repo.save({ ...session, status: 'abandoned' });

      const recent = await repo.getRecent(10);
      expect(recent.filter((s) => s.id === 'upd')).toHaveLength(1);
      expect((await repo.getById('upd'))?.status).toBe('abandoned');
    });
  });

  describe('getRecent', () => {
    it('orders most-recently-saved first and honours the limit', async () => {
      await repo.save(makeSession({ id: 'a', startTime: 1000 }));
      await repo.save(makeSession({ id: 'b', startTime: 2000 }));
      await repo.save(makeSession({ id: 'c', startTime: 3000 }));

      const recent = await repo.getRecent(2);
      expect(recent.map((s) => s.id)).toEqual(['c', 'b']);
    });
  });

  describe('indexed queries', () => {
    beforeEach(async () => {
      await repo.save(makeSession({ id: 'row-1', exerciseId: 'cable_row', startTime: 100 }));
      await repo.save(makeSession({ id: 'row-2', exerciseId: 'cable_row', startTime: 300 }));
      await repo.save(makeSession({ id: 'curl-1', exerciseId: 'bicep_curl', startTime: 200 }));
    });

    it('filters by exercise, sorted by start time desc', async () => {
      const rows = await repo.getByExercise('cable_row');
      expect(rows.map((s) => s.id)).toEqual(['row-2', 'row-1']);
    });

    it('returns the most recent session for an exercise', async () => {
      expect((await repo.getMostRecentForExercise('cable_row'))?.id).toBe('row-2');
      expect(await repo.getMostRecentForExercise('unknown')).toBeNull();
    });

    it('filters by date range', async () => {
      const rows = await repo.getByDateRange(new Date(150), new Date(250));
      expect(rows.map((s) => s.id)).toEqual(['curl-1']);
    });

    it('builds lightweight summaries for all sessions', async () => {
      const summaries = await repo.getAllSummaries();
      expect(summaries).toHaveLength(3);
      expect(summaries[0].totalReps).toBe(2);
    });
  });

  describe('discovery sessions', () => {
    it('filters discovery sessions, optionally by exercise', async () => {
      const discovery = { generatedBy: 'discovery' as const };
      await repo.save(makeSession({ id: 'd1', plan: { ...makeSession().plan, ...discovery } }));
      await repo.save(makeSession({ id: 'std' }));

      const all = await repo.getDiscoverySessions();
      expect(all.map((s) => s.id)).toEqual(['d1']);
      expect(await repo.getDiscoverySessions('bicep_curl')).toHaveLength(0);
    });
  });

  describe('current / in-progress', () => {
    it('gets, sets and clears the current session', async () => {
      const session = makeSession({ id: 'cur', status: 'in_progress' });
      await repo.save(session);

      await repo.setCurrent('cur');
      expect((await repo.getCurrent())?.id).toBe('cur');
      expect((await repo.getInProgress())?.id).toBe('cur');

      await repo.setCurrent(null);
      expect(await repo.getCurrent()).toBeNull();
    });

    it('does not report a completed session as in-progress', async () => {
      const session = makeSession({ id: 'done', status: 'completed' });
      await repo.save(session);
      await repo.setCurrent('done');

      expect(await repo.getInProgress()).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the session, its rows and clears current', async () => {
      const session = makeSession({ id: 'del', status: 'in_progress' });
      await repo.save(session);
      await repo.setCurrent('del');

      await repo.delete('del');

      expect(await repo.getById('del')).toBeNull();
      expect(await repo.getCurrent()).toBeNull();
    });
  });

  describe('persistence across re-open (crash recovery)', () => {
    it('reads back data written by an earlier repository instance', async () => {
      const first = createSQLiteExerciseSessionRepository(openSessionDatabase('shared-reopen'));
      await first.save(makeSession({ id: 'persisted' }));

      const reopened = createSQLiteExerciseSessionRepository(openSessionDatabase('shared-reopen'));
      expect((await reopened.getById('persisted'))?.id).toBe('persisted');
    });
  });

  describe('AsyncStorage migration', () => {
    it('copies sessions once and is idempotent', async () => {
      const source = createExerciseSessionRepository(new InMemoryAdapter());
      await source.save(makeSession({ id: 'm1' }));
      await source.save(makeSession({ id: 'm2', status: 'in_progress' }));
      await source.setCurrent('m2');

      const first = await repo.migrateFrom(source);
      const second = await repo.migrateFrom(source);

      expect(first).toBe(2);
      expect(second).toBe(0);
      expect((await repo.getById('m1'))?.id).toBe('m1');
      expect((await repo.getCurrent())?.id).toBe('m2');
    });
  });
});
