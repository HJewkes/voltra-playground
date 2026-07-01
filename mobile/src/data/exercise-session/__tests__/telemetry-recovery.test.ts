/**
 * Telemetry Recovery Controller tests (VLT-09.31).
 *
 * Exercises the wiring that makes an in-progress set survive a crash: samples
 * buffered during recording are durably reconstructable, a normally-completed
 * set is not double-counted, and a persistence failure never breaks recording.
 *
 * Runs against the dependency-free in-memory op-sqlite mock (vitest alias), so
 * no node:sqlite is required in the CI test path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSQLiteExerciseSessionRepository,
  openSessionDatabase,
  type SessionDatabase,
} from '../sqlite-exercise-session-repository';
import { replaySamplesToSet } from '../telemetry-buffer';
import type { StoredExerciseSession } from '../exercise-session-schema';
import type { ExerciseSessionRepository } from '../exercise-session-repository';
import {
  startSetBuffer,
  bufferSample,
  flushActiveBuffer,
  finalizeSetBuffer,
  recoverInterruptedSet,
  _resetTelemetryRecovery,
} from '../telemetry-recovery';
import { generateSampleStream } from '@/__fixtures__/generators/sample-generator';
import { TrainingGoal } from '@/domain/planning';

let dbCounter = 0;
let db: SessionDatabase;
let repo: ReturnType<typeof createSQLiteExerciseSessionRepository>;

function inProgressSession(overrides: Partial<StoredExerciseSession> = {}): StoredExerciseSession {
  return {
    id: 'live-session',
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    startTime: 1000,
    endTime: null,
    plan: {
      exerciseId: 'cable_row',
      sets: [{ setNumber: 1, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false }],
      defaultRestSeconds: 120,
      goal: TrainingGoal.HYPERTROPHY,
      generatedAt: 1000,
      generatedBy: 'standard',
    },
    completedSets: [],
    status: 'in_progress',
    schemaVersion: 2,
    ...overrides,
  };
}

async function seedInProgressSession(overrides: Partial<StoredExerciseSession> = {}): Promise<void> {
  await repo.save(inProgressSession(overrides));
  await repo.setCurrent('live-session');
}

beforeEach(async () => {
  dbCounter += 1;
  const name = `recovery-${dbCounter}`;
  // Point the controller and the repo at the same fresh in-memory db.
  _resetTelemetryRecovery(name);
  db = openSessionDatabase(name);
  repo = createSQLiteExerciseSessionRepository(db);
});

describe('crash recovery round-trip', () => {
  it('recovers an interrupted set from durably buffered samples', async () => {
    await seedInProgressSession();
    const stream = generateSampleStream({
      repCount: 4,
      weight: 100,
      startingVelocity: 0.7,
      fatigueRate: 0.03,
      startTime: 1000,
    });

    // Record the set through the live buffering path, then durably flush.
    startSetBuffer('live-session', 0);
    for (const s of stream) bufferSample(s);
    await flushActiveBuffer();

    // "Crash": the in-memory buffer is discarded without finalizing.
    _resetTelemetryRecovery(`recovery-${dbCounter}`); // drop in-memory state, same db

    const recovered = await recoverInterruptedSet(repo);

    expect(recovered).not.toBeNull();
    expect(recovered!.session.id).toBe('live-session');
    expect(recovered!.setIndex).toBe(0);
    expect(recovered!.samples).toHaveLength(stream.length);
    expect(recovered!.set.reps.length).toBe(replaySamplesToSet(stream).reps.length);
    expect(recovered!.set.reps.length).toBeGreaterThanOrEqual(1);
  });

  it('recovers the set at the index after already-completed sets', async () => {
    await seedInProgressSession({
      completedSets: [
        {
          setIndex: 0,
          weight: 100,
          reps: [{ repNumber: 1, concentric: { samples: [] }, eccentric: { samples: [] } }],
          startTime: 1000,
          endTime: 2000,
          meanVelocity: 0.5,
          estimatedRPE: 7,
          estimatedRIR: 3,
          velocityLossPercent: 10,
        },
      ],
    });
    const stream = generateSampleStream({ repCount: 3, weight: 100, startingVelocity: 0.7, startTime: 3000 });

    startSetBuffer('live-session', 1);
    for (const s of stream) bufferSample(s);
    await flushActiveBuffer();

    const recovered = await recoverInterruptedSet(repo);

    expect(recovered!.setIndex).toBe(1);
    expect(recovered!.set.reps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('no double-count', () => {
  it('a normally-completed set leaves nothing to recover', async () => {
    await seedInProgressSession();
    const stream = generateSampleStream({ repCount: 3, weight: 100, startingVelocity: 0.7, startTime: 1000 });

    startSetBuffer('live-session', 0);
    for (const s of stream) bufferSample(s);
    await flushActiveBuffer();

    // Set completes normally -> its buffered rows are discarded.
    await finalizeSetBuffer('live-session', 0);

    const recovered = await recoverInterruptedSet(repo);
    expect(recovered).toBeNull();
  });
});

describe('persistence-failure guard', () => {
  it('a repo write error never throws into the recording path', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenDb = {
      execute: vi.fn(async () => {
        throw new Error('disk full');
      }),
      transaction: vi.fn(async () => {
        throw new Error('disk full');
      }),
    } as unknown as SessionDatabase;
    _resetTelemetryRecovery(undefined, brokenDb);

    // None of these may throw even though every db op fails.
    expect(() => startSetBuffer('live-session', 0)).not.toThrow();
    expect(() => {
      for (const s of generateSampleStream({ repCount: 2, weight: 100, startingVelocity: 0.7, startTime: 1000 })) {
        bufferSample(s);
      }
    }).not.toThrow();
    await expect(flushActiveBuffer()).resolves.toBeUndefined();
    await expect(finalizeSetBuffer('live-session', 0)).resolves.toBeUndefined();

    warn.mockRestore();
  });

  it('recoverInterruptedSet returns null when the repository throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenRepo = {
      getInProgress: vi.fn(async () => {
        throw new Error('repo down');
      }),
    } as unknown as ExerciseSessionRepository;

    await expect(recoverInterruptedSet(brokenRepo)).resolves.toBeNull();
    warn.mockRestore();
  });

  it('bufferSample with no active set is a safe no-op', () => {
    _resetTelemetryRecovery(`recovery-${dbCounter}`);
    expect(() =>
      bufferSample({ sequence: 0, timestamp: 0, phase: 0, position: 0, velocity: 0, force: 0 }),
    ).not.toThrow();
  });
});
