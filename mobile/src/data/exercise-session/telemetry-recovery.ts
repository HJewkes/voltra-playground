/**
 * Telemetry Recovery Controller (VLT-09.31)
 *
 * Wires the crash-safe telemetry buffer (VLT-09.11) into the live recording
 * path. Owns one app-wide session database and the TelemetryBuffer for the
 * in-progress set: samples are buffered during recording and durably flushed on
 * the built 50-sample/1s cadence, so an interrupted set survives a crash. On a
 * normal completion the set's buffered rows are cleared (so a later recovery
 * cannot double-count it). recoverInterruptedSet reconstructs an unfinished set
 * from the durable rows.
 *
 * op-sqlite is native-only; the web build resolves telemetry-recovery.web.ts
 * (no-ops) so op-sqlite never enters the web bundle.
 *
 * Live samples arrive from the synchronous ~11Hz recording path, so appends are
 * fire-and-forget and serialized through a promise chain: a slow flush can
 * never block or drop the live stream, and concurrent appends never race the
 * buffer's flush.
 */

import type { WorkoutSample } from '@voltras/workout-analytics';
import { openSessionDatabase, type SessionDatabase } from './sqlite-exercise-session-repository';
import {
  TelemetryBuffer,
  clearBufferedSamples,
  recoverInProgressSet,
  type RecoveredSet,
} from './telemetry-buffer';
import type { ExerciseSessionRepository } from './exercise-session-repository';

const DEFAULT_DB_NAME = 'voltra-telemetry';

let dbName = DEFAULT_DB_NAME;
let db: SessionDatabase | null = null;
let activeBuffer: TelemetryBuffer | null = null;
let writeChain: Promise<void> = Promise.resolve();

function getDb(): SessionDatabase {
  if (!db) db = openSessionDatabase(dbName);
  return db;
}

function warn(context: string, err: unknown): void {
  console.warn(`[TelemetryRecovery] ${context}:`, err);
}

/** Begin buffering the in-progress set's raw sample stream. */
export function startSetBuffer(sessionId: string, setIndex: number): void {
  try {
    activeBuffer = new TelemetryBuffer(getDb(), sessionId, setIndex);
  } catch (err) {
    activeBuffer = null;
    warn('startSetBuffer failed', err);
  }
}

/**
 * Buffer one live sample. Fire-and-forget and serialized — never throws into
 * the recording hot path, and a slow flush never blocks the caller.
 */
export function bufferSample(sample: WorkoutSample): void {
  const buffer = activeBuffer;
  if (!buffer) return;
  writeChain = writeChain
    .then(() => buffer.append(sample))
    .catch((err) => warn('sample flush failed', err));
}

/** Force-flush the pending batch after draining queued appends. */
export async function flushActiveBuffer(): Promise<void> {
  const buffer = activeBuffer;
  if (!buffer) return;
  try {
    await writeChain;
    await buffer.flush();
  } catch (err) {
    warn('flushActiveBuffer failed', err);
  }
}

/**
 * Finalize a normally-completed set: stop buffering and discard its durable
 * rows so a later recovery cannot double-count it.
 */
export async function finalizeSetBuffer(sessionId: string, setIndex: number): Promise<void> {
  activeBuffer = null;
  try {
    await writeChain;
    await clearBufferedSamples(getDb(), sessionId, setIndex);
  } catch (err) {
    warn('finalizeSetBuffer failed', err);
  }
}

/**
 * Reconstruct an interrupted in-progress set from durable telemetry, or null
 * when there is nothing to recover.
 */
export async function recoverInterruptedSet(
  repository: ExerciseSessionRepository
): Promise<RecoveredSet | null> {
  try {
    return await recoverInProgressSet(getDb(), repository);
  } catch (err) {
    warn('recoverInterruptedSet failed', err);
    return null;
  }
}

/** Test-only: reset module state; point at a fresh named db or an injected one. */
export function _resetTelemetryRecovery(name?: string, injectedDb?: SessionDatabase): void {
  activeBuffer = null;
  writeChain = Promise.resolve();
  if (injectedDb) {
    db = injectedDb;
  } else {
    db = null;
    if (name) dbName = name;
  }
}
