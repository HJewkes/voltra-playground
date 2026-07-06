/**
 * Session Export
 *
 * Converts stored exercise sessions to a structured JSON format
 * for clipboard export and debug console access.
 */

import {
  getSetMeanVelocity,
  getSetPeakVelocity,
  getSetVelocityLossPct,
  getSetRepVelocities,
  estimateSetRIR,
  getRepMeanConcentricForce,
} from '@voltras/workout-analytics';
import { fromStoredSessionSet } from './exercise-session-converters';
import type { StoredExerciseSession, StoredSessionSet } from './exercise-session-schema';

/**
 * A timestamped note captured during a session (e.g. between sets).
 * Defined here to avoid a circular dependency: exercise-session-store
 * imports data/exercise-session, which (via session-export.ts) previously
 * imported back from exercise-session-store, causing a TDZ crash.
 */
export interface SessionNote {
  text: string;
  timestamp: number;
  setIndex: number;
  exerciseId?: string;
}

export interface ExportedSetData {
  setNumber: number;
  weight: number;
  reps: number;
  meanVelocity: number;
  peakVelocity: number;
  velocityLoss: number;
  rpe: number;
  rir: number;
  meanForce: number;
  repVelocities: number[];
}

export interface ExportedSessionSummary {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  meanVelocity: number;
  estimatedE1RM: number | null;
}

export interface ExportedNote {
  text: string;
  afterSet: number;
  time: string;
}

export interface ExportedSession {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  duration: string;
  sets: ExportedSetData[];
  notes: ExportedNote[];
  summary: ExportedSessionSummary;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(startTime: number, endTime: number | null): string {
  const end = endTime ?? startTime;
  const totalSeconds = Math.floor((end - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function exportStoredSet(stored: StoredSessionSet, setIndex: number): ExportedSetData {
  const completed = fromStoredSessionSet(stored);
  const analyticsSet = completed.data;
  const rirEstimate = estimateSetRIR(analyticsSet);

  const repVelocities = getSetRepVelocities(analyticsSet);
  const meanForce =
    analyticsSet.reps.length > 0
      ? analyticsSet.reps.reduce((sum, rep) => sum + getRepMeanConcentricForce(rep), 0) /
        analyticsSet.reps.length
      : 0;

  return {
    setNumber: setIndex + 1,
    weight: stored.weight,
    reps: stored.reps.length,
    meanVelocity: round(getSetMeanVelocity(analyticsSet), 2),
    peakVelocity: round(getSetPeakVelocity(analyticsSet), 2),
    velocityLoss: round(Math.abs(getSetVelocityLossPct(analyticsSet)), 1),
    rpe: round(rirEstimate.rpe, 1),
    rir: round(rirEstimate.rir, 1),
    meanForce: round(meanForce, 0),
    repVelocities: repVelocities.map((v) => round(v, 2)),
  };
}

/**
 * Convert a stored session to the export JSON format.
 *
 * @param sessionNotes - Optional notes from the session store (not persisted in stored schema)
 */
export function exportSession(
  session: StoredExerciseSession,
  sessionNotes: SessionNote[] = []
): ExportedSession {
  const sets = session.completedSets.map((s, i) => exportStoredSet(s, i));

  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const overallMeanVelocity =
    sets.length > 0 ? round(sets.reduce((sum, s) => sum + s.meanVelocity, 0) / sets.length, 2) : 0;

  const notes: ExportedNote[] = sessionNotes.map((n) => ({
    text: n.text,
    afterSet: n.setIndex,
    time: formatTime(n.timestamp),
  }));

  return {
    sessionId: session.id,
    exerciseId: session.exerciseId,
    exerciseName: session.exerciseName ?? 'Unknown Exercise',
    date: new Date(session.startTime).toISOString().split('T')[0],
    duration: formatDuration(session.startTime, session.endTime),
    sets,
    notes,
    summary: {
      totalSets: sets.length,
      totalReps,
      totalVolume,
      meanVelocity: overallMeanVelocity,
      estimatedE1RM: null,
    },
  };
}

/**
 * Convert multiple sessions to export JSON string.
 */
export function exportSessionsToJSON(sessions: StoredExerciseSession[]): string {
  const exported = sessions.map((s) => exportSession(s, []));
  return JSON.stringify(exported, null, 2);
}
