/**
 * Crash-safe telemetry buffer (VLT-09.11).
 *
 * Batch-appends the raw ~11Hz sample stream of an in-progress set to SQLite
 * (see VLT-09.10's telemetry_samples table) so an interrupted set survives a
 * crash. Samples accumulate in memory and are durably flushed once either the
 * batch reaches `flushSampleCount` samples or `flushIntervalMs` of stream time
 * has elapsed -- bounding worst-case data loss on crash to ~1 second.
 *
 * Recovery reads the orphaned raw samples back and replays them through the
 * analytics pipeline (createSet -> addSampleToSet -> completeSet) to reconstruct
 * the in-progress set exactly as the live recording store would have.
 */

import {
  addSampleToSet,
  completeSet,
  createSet,
  type Set as AnalyticsSet,
  type WorkoutSample,
} from '@voltras/workout-analytics';
import type { ExerciseSessionRepository } from './exercise-session-repository';
import type { StoredExerciseSession } from './exercise-session-schema';
import type { Scalar } from './sqlite-session-mappers';
import type { SessionDatabase } from './sqlite-exercise-session-repository';
import {
  PHASE_RAW,
  RAW_REP_NUMBER,
  SESSION_SCHEMA_STATEMENTS,
} from './sqlite-session-schema';

/** Flush once this many samples are buffered in memory. */
export const TELEMETRY_FLUSH_SAMPLE_COUNT = 50;

/** Flush once this many ms of stream time have elapsed since the batch opened. */
export const TELEMETRY_FLUSH_INTERVAL_MS = 1000;

const INSERT_TELEMETRY =
  `INSERT INTO telemetry_samples (session_id, set_index, rep_number, phase, sample_index, sample_json)
   VALUES (?, ?, ?, ?, ?, ?)`;

const SELECT_BUFFERED =
  `SELECT * FROM telemetry_samples
   WHERE session_id = ? AND set_index = ? AND rep_number = ? AND phase = ?
   ORDER BY sample_index`;

const DELETE_BUFFERED =
  `DELETE FROM telemetry_samples
   WHERE session_id = ? AND set_index = ? AND rep_number = ? AND phase = ?`;

export interface TelemetryBufferOptions {
  /** Override the sample-count flush threshold (default 50). */
  flushSampleCount?: number;
  /** Override the elapsed-time flush threshold in ms (default 1000). */
  flushIntervalMs?: number;
}

/** Ensure the session schema (incl. telemetry_samples) exists on this db. */
export async function ensureSessionSchema(db: SessionDatabase): Promise<void> {
  for (const statement of SESSION_SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }
}

/**
 * Buffers the raw sample stream for a single in-progress set and flushes it to
 * SQLite in durable batches.
 */
export class TelemetryBuffer {
  private pending: WorkoutSample[] = [];
  private nextIndex = 0;
  private windowStartTs: number | null = null;
  private schemaReady: Promise<void> | null = null;
  private readonly flushSampleCount: number;
  private readonly flushIntervalMs: number;

  constructor(
    private readonly db: SessionDatabase,
    private readonly sessionId: string,
    private readonly setIndex: number,
    options: TelemetryBufferOptions = {}
  ) {
    this.flushSampleCount = options.flushSampleCount ?? TELEMETRY_FLUSH_SAMPLE_COUNT;
    this.flushIntervalMs = options.flushIntervalMs ?? TELEMETRY_FLUSH_INTERVAL_MS;
  }

  /** Samples buffered in memory, not yet flushed (lost on crash). */
  get pendingCount(): number {
    return this.pending.length;
  }

  /** Samples durably flushed to SQLite so far. */
  get flushedCount(): number {
    return this.nextIndex;
  }

  /** Buffer one sample, flushing when a threshold is crossed. */
  async append(sample: WorkoutSample): Promise<void> {
    this.pending.push(sample);
    if (this.windowStartTs === null) this.windowStartTs = sample.timestamp;
    if (this.shouldFlush(sample.timestamp)) await this.flush();
  }

  /** Durably write all buffered samples in a single transaction. */
  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    await this.ensureSchema();
    const batch = this.pending;
    const base = this.nextIndex;
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < batch.length; i++) {
        await tx.execute(INSERT_TELEMETRY, this.rowParams(base + i, batch[i]));
      }
    });
    this.nextIndex = base + batch.length;
    this.pending = [];
    this.windowStartTs = null;
  }

  private shouldFlush(timestamp: number): boolean {
    if (this.pending.length >= this.flushSampleCount) return true;
    const elapsed = timestamp - (this.windowStartTs ?? timestamp);
    return elapsed >= this.flushIntervalMs;
  }

  private rowParams(index: number, sample: WorkoutSample): Scalar[] {
    return [this.sessionId, this.setIndex, RAW_REP_NUMBER, PHASE_RAW, index, JSON.stringify(sample)];
  }

  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = ensureSessionSchema(this.db);
    return this.schemaReady;
  }
}

/** Read the durably-flushed raw samples for a set, ordered as recorded. */
export async function loadBufferedSamples(
  db: SessionDatabase,
  sessionId: string,
  setIndex: number
): Promise<WorkoutSample[]> {
  const { rows } = await db.execute(SELECT_BUFFERED, [
    sessionId,
    setIndex,
    RAW_REP_NUMBER,
    PHASE_RAW,
  ]);
  return rows.map((row) => JSON.parse(String(row.sample_json)) as WorkoutSample);
}

/** Discard the buffered raw samples for a set (e.g. after it is finalized). */
export async function clearBufferedSamples(
  db: SessionDatabase,
  sessionId: string,
  setIndex: number
): Promise<void> {
  await db.execute(DELETE_BUFFERED, [sessionId, setIndex, RAW_REP_NUMBER, PHASE_RAW]);
}

/** Replay a raw sample stream through the analytics pipeline into a Set. */
export function replaySamplesToSet(samples: WorkoutSample[]): AnalyticsSet {
  let set = createSet();
  for (const sample of samples) set = addSampleToSet(set, sample);
  return completeSet(set);
}

/** An interrupted set reconstructed from crash-recovered telemetry. */
export interface RecoveredSet {
  session: StoredExerciseSession;
  setIndex: number;
  samples: WorkoutSample[];
  set: AnalyticsSet;
}

/**
 * Detect an unfinished set left behind by a crash and reconstruct it.
 *
 * The interrupted set is the one after the last persisted completed set of the
 * current in-progress session; its buffered raw samples are replayed into a Set.
 * Returns null when there is no in-progress session or no orphaned samples.
 */
export async function recoverInProgressSet(
  db: SessionDatabase,
  repository: ExerciseSessionRepository
): Promise<RecoveredSet | null> {
  const session = await repository.getInProgress();
  if (!session) return null;
  const setIndex = session.completedSets.length;
  const samples = await loadBufferedSamples(db, session.id, setIndex);
  if (samples.length === 0) return null;
  return { session, setIndex, samples, set: replaySamplesToSet(samples) };
}
