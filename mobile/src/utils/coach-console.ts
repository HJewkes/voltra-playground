/**
 * Coach Console
 *
 * Registers `window.__coach` as a monitoring interface for the browser console.
 * Web platform only — provides real-time workout data to the coaching AI.
 *
 * Usage (in browser console):
 *   __coach.status()          — human-readable one-liner
 *   __coach.liveMetrics()     — current recording state
 *   __coach.setLog()          — all completed sets
 *   __coach.exportSession()   — full JSON of current session
 *   __coach.exportAll()       — all stored sessions as JSON
 *   __coach.profileFor(id)    — load-velocity profile for exercise
 *   __coach.setMockPlan(r,s,rest) — configure mock BLE plan
 */

import { Platform } from 'react-native';

import type { RecordingStoreApi } from '@/stores/recording-store';
import type { ExerciseSessionStoreApi } from '@/stores/exercise-session-store';
import {
  toStoredExerciseSession,
  exportSession,
  exportSessionsToJSON,
} from '@/data/exercise-session';
import { getSessionRepository, getVelocityProfileRepository } from '@/data/provider';
import { createEmptyPlan } from '@/domain/workout';
import type { PlannedSet } from '@/domain/workout';
import { generateMockRepPlan } from '@/components/screens/mock-rep-plan';

// =============================================================================
// Types
// =============================================================================

interface CoachConsole {
  status(): string;
  liveMetrics(): object;
  setLog(): object[];
  exportSession(): string;
  exportAll(): Promise<string>;
  profileFor(exerciseId: string): Promise<object | null>;
  setMockPlan(reps: number, sets: number, restSeconds: number): void;
}

// =============================================================================
// Helpers
// =============================================================================

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// =============================================================================
// Registration
// =============================================================================

export function registerCoachConsole(
  recordingStore: RecordingStoreApi,
  sessionStore: ExerciseSessionStoreApi,
): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;

  const coach: CoachConsole = {
    status() {
      const session = sessionStore.getState().session;
      const sessionUI = sessionStore.getState().uiState;
      const rec = recordingStore.getState();

      if (!session) return 'No active session';

      const exerciseName = session.exercise.name;
      const setIndex = sessionStore.getState().currentSetIndex + 1;
      const plannedSet = sessionStore.getState().currentPlannedSet;
      const weight = plannedSet?.weight ?? 0;

      if (sessionUI === 'recording') {
        const parts = [
          `Recording Set ${setIndex}`,
          `${rec.repCount} reps at ${weight} lbs`,
          `RPE ${round(rec.rpe, 1)}`,
          `velocity ${round(rec.meanVelocity, 2)} m/s`,
        ];
        return `${exerciseName} — ${parts.join(' — ')}`;
      }

      if (sessionUI === 'resting') {
        const elapsed = Math.round(sessionStore.getState().restElapsedMs / 1000);
        return `${exerciseName} — Resting after Set ${setIndex} (${elapsed}s elapsed)`;
      }

      if (sessionUI === 'results') {
        const totalSets = session.completedSets.length;
        return `${exerciseName} — Session complete (${totalSets} sets)`;
      }

      return `${exerciseName} — ${sessionUI} (Set ${setIndex})`;
    },

    liveMetrics() {
      const rec = recordingStore.getState();
      return {
        repCount: rec.repCount,
        rpe: round(rec.rpe, 1),
        rir: round(rec.rir, 1),
        meanVelocity: round(rec.meanVelocity, 2),
        velocityLoss: round(rec.velocityLoss, 1),
        currentPhase: rec.currentPhase,
        velocityTrend: rec.velocityTrend.map((v) => round(v, 2)),
        lastRepPeakVelocity: rec.lastRepPeakVelocity
          ? round(rec.lastRepPeakVelocity, 2)
          : null,
        isRecording: rec.isRecording,
        liveMessage: rec.liveMessage,
      };
    },

    setLog() {
      const log = sessionStore.getState().setLog;
      return log.map((entry, i) => ({
        setNumber: i + 1,
        weight: entry.set.weight,
        reps: entry.set.data.reps.length,
        clusters: entry.clusters.length,
        hasSamples: !!entry.samples && entry.samples.length > 0,
      }));
    },

    exportSession() {
      const session = sessionStore.getState().session;
      if (!session) return JSON.stringify({ error: 'No active session' });

      const stored = toStoredExerciseSession(session, 'in_progress');
      const exported = exportSession(stored);
      return JSON.stringify(exported, null, 2);
    },

    async exportAll() {
      const repo = getSessionRepository();
      const sessions = await repo.getRecent(100);
      return exportSessionsToJSON(sessions);
    },

    async profileFor(exerciseId: string) {
      const repo = getVelocityProfileRepository();
      const stored = await repo.get(exerciseId);
      return stored ?? null;
    },

    setMockPlan(reps: number, sets: number, restSeconds: number) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__mockBLE as {
        setRepPlan?: (reps: ReturnType<typeof generateMockRepPlan>) => void;
      } | undefined;

      if (!mock?.setRepPlan) {
        console.warn('[CoachConsole] No __mockBLE found — start with ?mock URL param');
        return;
      }

      const plan = createEmptyPlan('mock');
      const plannedSets: PlannedSet[] = Array.from({ length: sets }, (_, i) => ({
        setNumber: i + 1,
        weight: 0,
        targetReps: reps,
        rirTarget: 0,
        isWarmup: false,
        restSeconds,
      }));
      plan.sets = plannedSets;

      mock.setRepPlan(generateMockRepPlan(plan));
      console.log(
        `[CoachConsole] Mock plan set: ${reps} reps x ${sets} sets, ${restSeconds}s rest`,
      );
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__coach = coach;
  console.log('[CoachConsole] Registered window.__coach — type __coach.status() to begin');
}
