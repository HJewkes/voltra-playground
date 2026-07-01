/**
 * Pure row <-> object mappers for the SQLite session store.
 *
 * Kept free of any database handle so they can be unit-tested directly and
 * reused by both writes (object -> params) and reads (rows -> object).
 */

import type { WorkoutSample } from '@voltras/workout-analytics';
import type {
  StoredExerciseSession,
  StoredExercisePlan,
  StoredSessionSet,
  StoredRep,
} from './exercise-session-schema';
import {
  PHASE_CONCENTRIC,
  PHASE_ECCENTRIC,
  PHASE_RAW,
  RAW_REP_NUMBER,
} from './sqlite-session-schema';

export type Scalar = string | number | boolean | null;
export type Row = Record<string, Scalar>;

function nullToUndef<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/** INSERT params for the exercise_sessions row. */
export function sessionInsertParams(session: StoredExerciseSession, createdOrder: number): Scalar[] {
  return [
    session.id,
    session.exerciseId,
    session.exerciseName ?? null,
    session.startTime,
    session.endTime,
    session.status,
    session.plan.generatedBy,
    session.terminationReason ?? null,
    session.schemaVersion ?? null,
    session.notes ?? null,
    JSON.stringify(session.plan),
    createdOrder,
  ];
}

/** INSERT params for one session_sets row. */
export function setInsertParams(sessionId: string, set: StoredSessionSet): Scalar[] {
  return [
    sessionId,
    set.setIndex,
    set.weight,
    set.chains ?? null,
    set.eccentric ?? null,
    set.startTime,
    set.endTime,
    set.meanVelocity,
    set.estimatedRPE,
    set.estimatedRIR,
    set.velocityLossPercent,
    JSON.stringify(set.reps.map((rep) => rep.repNumber)),
  ];
}

/** INSERT param tuples for every telemetry sample belonging to a set. */
export function telemetrySampleParams(sessionId: string, set: StoredSessionSet): Scalar[][] {
  const rows: Scalar[][] = [];
  for (const rep of set.reps) {
    pushSamples(rows, sessionId, set.setIndex, rep.repNumber, PHASE_CONCENTRIC, rep.concentric.samples);
    pushSamples(rows, sessionId, set.setIndex, rep.repNumber, PHASE_ECCENTRIC, rep.eccentric.samples);
  }
  if (set.rawSamples) {
    pushSamples(rows, sessionId, set.setIndex, RAW_REP_NUMBER, PHASE_RAW, set.rawSamples);
  }
  return rows;
}

function pushSamples(
  rows: Scalar[][],
  sessionId: string,
  setIndex: number,
  repNumber: number,
  phase: string,
  samples: WorkoutSample[]
): void {
  samples.forEach((sample, index) => {
    rows.push([sessionId, setIndex, repNumber, phase, index, JSON.stringify(sample)]);
  });
}

/** Reconstruct a full session from its rows. */
export function rowToSession(
  sessionRow: Row,
  setRows: Row[],
  telemetryRows: Row[]
): StoredExerciseSession {
  const session: StoredExerciseSession = {
    id: String(sessionRow.id),
    exerciseId: String(sessionRow.exercise_id),
    exerciseName: nullToUndef(sessionRow.exercise_name) as string | undefined,
    startTime: Number(sessionRow.start_time),
    endTime: sessionRow.end_time === null ? null : Number(sessionRow.end_time),
    plan: JSON.parse(String(sessionRow.plan_json)) as StoredExercisePlan,
    completedSets: setRows.map((setRow) => rowToSet(setRow, telemetryRows)),
    status: sessionRow.status as StoredExerciseSession['status'],
    terminationReason: nullToUndef(sessionRow.termination_reason) as
      | StoredExerciseSession['terminationReason']
      | undefined,
    schemaVersion: nullToUndef(sessionRow.schema_version) as number | undefined,
    notes: nullToUndef(sessionRow.notes) as string | undefined,
  };
  return session;
}

function rowToSet(setRow: Row, telemetryRows: Row[]): StoredSessionSet {
  const setIndex = Number(setRow.set_index);
  const forSet = telemetryRows.filter((row) => Number(row.set_index) === setIndex);
  const repNumbers = JSON.parse(String(setRow.rep_numbers)) as number[];

  const set: StoredSessionSet = {
    setIndex,
    weight: Number(setRow.weight),
    chains: nullToUndef(setRow.chains) as number | undefined,
    eccentric: nullToUndef(setRow.eccentric) as number | undefined,
    reps: repNumbers.map((repNumber) => rowsToRep(repNumber, forSet)),
    startTime: Number(setRow.start_time),
    endTime: Number(setRow.end_time),
    meanVelocity: Number(setRow.mean_velocity),
    estimatedRPE: Number(setRow.estimated_rpe),
    estimatedRIR: Number(setRow.estimated_rir),
    velocityLossPercent: Number(setRow.velocity_loss_percent),
  };
  const raw = samplesFor(forSet, RAW_REP_NUMBER, PHASE_RAW);
  if (raw.length > 0) set.rawSamples = raw;
  return set;
}

function rowsToRep(repNumber: number, forSet: Row[]): StoredRep {
  return {
    repNumber,
    concentric: { samples: samplesFor(forSet, repNumber, PHASE_CONCENTRIC) },
    eccentric: { samples: samplesFor(forSet, repNumber, PHASE_ECCENTRIC) },
  };
}

function samplesFor(rows: Row[], repNumber: number, phase: string): WorkoutSample[] {
  return rows
    .filter((row) => Number(row.rep_number) === repNumber && row.phase === phase)
    .sort((a, b) => Number(a.sample_index) - Number(b.sample_index))
    .map((row) => JSON.parse(String(row.sample_json)) as WorkoutSample);
}
