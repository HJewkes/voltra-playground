/**
 * Telemetry Recovery Controller — web stub (VLT-09.31).
 *
 * op-sqlite is native-only. On web there is no durable telemetry store, so
 * these are no-ops. Metro resolves this file for the web platform, keeping
 * op-sqlite out of the web bundle (see telemetry-recovery.ts for the real
 * native/Node implementation).
 */

import type { WorkoutSample } from '@voltras/workout-analytics';
import type { RecoveredSet } from './telemetry-buffer';
import type { SessionDatabase } from './sqlite-exercise-session-repository';
import type { ExerciseSessionRepository } from './exercise-session-repository';

export function startSetBuffer(_sessionId: string, _setIndex: number): void {}

export function bufferSample(_sample: WorkoutSample): void {}

export async function flushActiveBuffer(): Promise<void> {}

export async function finalizeSetBuffer(_sessionId: string, _setIndex: number): Promise<void> {}

export async function recoverInterruptedSet(
  _repository: ExerciseSessionRepository
): Promise<RecoveredSet | null> {
  return null;
}

export function _resetTelemetryRecovery(_name?: string, _injectedDb?: SessionDatabase): void {}
