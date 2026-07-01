/**
 * TelemetryBuffer + crash-recovery behavior tests (VLT-09.11).
 *
 * Runs against the dependency-free in-memory op-sqlite mock. Exercises
 * batch-append flushing, durable persistence across a simulated crash, and
 * replay-based reconstruction of an interrupted in-progress set.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MovementPhase, type WorkoutSample } from '@voltras/workout-analytics';
import {
  createSQLiteExerciseSessionRepository,
  openSessionDatabase,
  type SessionDatabase,
} from '../sqlite-exercise-session-repository';
import {
  TelemetryBuffer,
  TELEMETRY_FLUSH_SAMPLE_COUNT,
  clearBufferedSamples,
  loadBufferedSamples,
  recoverInProgressSet,
  replaySamplesToSet,
} from '../telemetry-buffer';
import type { StoredExerciseSession } from '../exercise-session-schema';
import { generateSampleStream } from '@/__fixtures__/generators/sample-generator';
import { TrainingGoal } from '@/domain/planning';

// =============================================================================
// Helpers
// =============================================================================

let dbCounter = 0;

function freshDb(): SessionDatabase {
  dbCounter += 1;
  return openSessionDatabase(`telemetry-${dbCounter}`);
}

function sample(seq: number, timestamp: number): WorkoutSample {
  return {
    sequence: seq,
    timestamp,
    phase: MovementPhase.CONCENTRIC,
    position: seq * 0.1,
    velocity: 0.5,
    force: 100,
  };
}

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

// =============================================================================
// Batch-append flushing
// =============================================================================

describe('TelemetryBuffer batch-append', () => {
  let db: SessionDatabase;

  beforeEach(() => {
    db = freshDb();
  });

  it('holds samples in memory until the count threshold, then flushes', async () => {
    const buffer = new TelemetryBuffer(db, 's', 0, { flushIntervalMs: Number.MAX_SAFE_INTEGER });

    for (let i = 0; i < TELEMETRY_FLUSH_SAMPLE_COUNT - 1; i++) {
      await buffer.append(sample(i, 1000 + i));
    }
    expect(buffer.pendingCount).toBe(TELEMETRY_FLUSH_SAMPLE_COUNT - 1);
    expect(buffer.flushedCount).toBe(0);

    await buffer.append(sample(TELEMETRY_FLUSH_SAMPLE_COUNT, 2000));

    expect(buffer.pendingCount).toBe(0);
    expect(buffer.flushedCount).toBe(TELEMETRY_FLUSH_SAMPLE_COUNT);
  });

  it('flushes when the elapsed-time window is exceeded before the count', async () => {
    const buffer = new TelemetryBuffer(db, 's', 0, { flushIntervalMs: 1000 });

    await buffer.append(sample(0, 1000));
    await buffer.append(sample(1, 1500));
    expect(buffer.flushedCount).toBe(0);

    await buffer.append(sample(2, 2000)); // 1000ms since window opened

    expect(buffer.pendingCount).toBe(0);
    expect(buffer.flushedCount).toBe(3);
  });

  it('assigns monotonic, contiguous sample indices across multiple flushes', async () => {
    const buffer = new TelemetryBuffer(db, 's', 0, { flushSampleCount: 2, flushIntervalMs: Number.MAX_SAFE_INTEGER });

    for (let i = 0; i < 6; i++) await buffer.append(sample(i, 1000 + i));

    const { rows } = await db.execute(
      'SELECT * FROM telemetry_samples WHERE session_id = ? ORDER BY sample_index',
      ['s']
    );
    expect(rows.map((r) => Number(r.sample_index))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('explicit flush persists the remaining partial batch', async () => {
    const buffer = new TelemetryBuffer(db, 's', 0, { flushIntervalMs: Number.MAX_SAFE_INTEGER });

    await buffer.append(sample(0, 1000));
    await buffer.append(sample(1, 1100));
    await buffer.flush();

    expect(buffer.pendingCount).toBe(0);
    expect(await loadBufferedSamples(db, 's', 0)).toHaveLength(2);
  });

  it('flush is a no-op when nothing is buffered', async () => {
    const buffer = new TelemetryBuffer(db, 's', 0);
    await buffer.flush();
    expect(buffer.flushedCount).toBe(0);
  });

  it('scopes samples to their own set index', async () => {
    const set0 = new TelemetryBuffer(db, 's', 0, { flushSampleCount: 1 });
    const set1 = new TelemetryBuffer(db, 's', 1, { flushSampleCount: 1 });

    await set0.append(sample(0, 1000));
    await set1.append(sample(0, 1000));

    expect(await loadBufferedSamples(db, 's', 0)).toHaveLength(1);
    expect(await loadBufferedSamples(db, 's', 1)).toHaveLength(1);
  });
});

// =============================================================================
// Crash simulation + recovery
// =============================================================================

describe('crash recovery', () => {
  let db: SessionDatabase;
  let repo: ReturnType<typeof createSQLiteExerciseSessionRepository>;

  beforeEach(async () => {
    db = freshDb();
    repo = createSQLiteExerciseSessionRepository(db);
    await repo.save(inProgressSession());
    await repo.setCurrent('live-session');
  });

  it('loses at most the un-flushed in-memory batch on crash', async () => {
    const buffer = new TelemetryBuffer(db, 'live-session', 0, {
      flushSampleCount: 10,
      flushIntervalMs: Number.MAX_SAFE_INTEGER,
    });

    // 23 samples streamed: 20 flushed in two batches, 3 still pending when we crash.
    for (let i = 0; i < 23; i++) await buffer.append(sample(i, 1000 + i));
    expect(buffer.flushedCount).toBe(20);
    expect(buffer.pendingCount).toBe(3);

    // Simulate crash: the buffer object is discarded, only flushed rows survive.
    const survivors = await loadBufferedSamples(db, 'live-session', 0);
    expect(survivors).toHaveLength(20);
    expect(survivors.map((s) => s.sequence)).toEqual([...Array(20).keys()]);
  });

  it('reconstructs the interrupted set from a realistic recovered stream', async () => {
    const stream = generateSampleStream({
      repCount: 4,
      weight: 135,
      startingVelocity: 0.7,
      fatigueRate: 0.03,
      startTime: 1000,
    });
    const buffer = new TelemetryBuffer(db, 'live-session', 0, { flushSampleCount: 8 });
    for (const s of stream) await buffer.append(s);
    await buffer.flush();

    const recovered = await recoverInProgressSet(db, repo);

    expect(recovered).not.toBeNull();
    expect(recovered!.session.id).toBe('live-session');
    expect(recovered!.setIndex).toBe(0);
    expect(recovered!.samples).toHaveLength(stream.length);
    expect(recovered!.set.reps.length).toBeGreaterThanOrEqual(1);
    // Replaying recovered samples matches a direct pipeline run.
    expect(recovered!.set.reps.length).toBe(replaySamplesToSet(stream).reps.length);
  });

  it('recovers a set at the index after already-completed sets', async () => {
    const completed = inProgressSession({
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
          velocityLossPercent: 5,
        },
      ],
    });
    await repo.save(completed);
    await repo.setCurrent('live-session');

    const buffer = new TelemetryBuffer(db, 'live-session', 1, { flushSampleCount: 1 });
    await buffer.append(sample(0, 3000));

    const recovered = await recoverInProgressSet(db, repo);
    expect(recovered!.setIndex).toBe(1);
    expect(recovered!.samples).toHaveLength(1);
  });

  it('recovers buffered samples after re-opening the database (new app launch)', async () => {
    const buffer = new TelemetryBuffer(db, 'live-session', 0, { flushSampleCount: 2 });
    await buffer.append(sample(0, 1000));
    await buffer.append(sample(1, 1100));

    // Re-open by name: mimics a fresh process reading the on-disk database.
    const reopened = openSessionDatabase('telemetry-' + dbCounter);
    const samples = await loadBufferedSamples(reopened, 'live-session', 0);
    expect(samples).toHaveLength(2);
  });

  it('returns null when there is no in-progress session', async () => {
    await repo.setCurrent(null);
    expect(await recoverInProgressSet(db, repo)).toBeNull();
  });

  it('returns null when the in-progress session has no buffered samples', async () => {
    expect(await recoverInProgressSet(db, repo)).toBeNull();
  });

  it('clearBufferedSamples discards an interrupted buffer so it is not recovered', async () => {
    const buffer = new TelemetryBuffer(db, 'live-session', 0, { flushSampleCount: 1 });
    await buffer.append(sample(0, 1000));
    expect(await loadBufferedSamples(db, 'live-session', 0)).toHaveLength(1);

    await clearBufferedSamples(db, 'live-session', 0);

    expect(await loadBufferedSamples(db, 'live-session', 0)).toHaveLength(0);
    expect(await recoverInProgressSet(db, repo)).toBeNull();
  });
});
