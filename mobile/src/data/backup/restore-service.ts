/**
 * Restore Service
 *
 * Validates and imports backup data into repositories.
 * Handles schema version checks for forward compatibility.
 */

import type { ExerciseSessionRepository } from '@/data/exercise-session';
import type { ExerciseRepository } from '@/data/exercises';
import type { RecordingRepository } from '@/data/recordings';
import type { StorageAdapter } from '@/data/adapters';
import { STORAGE_KEYS } from '@/data/adapters';
import {
  type BackupData,
  type BackupValidationResult,
  type RestoreResult,
  BACKUP_SCHEMA_VERSION,
} from './backup-schema';

interface RestoreDependencies {
  sessionRepo: ExerciseSessionRepository;
  exerciseRepo: ExerciseRepository;
  recordingRepo: RecordingRepository;
  adapter: StorageAdapter;
}

/**
 * Parse and validate a backup JSON string.
 */
export function parseBackup(json: string): BackupValidationResult & { data?: BackupData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, errors: ['Invalid JSON'], schemaVersion: null };
  }

  return validateBackup(parsed);
}

/**
 * Validate a parsed backup object.
 */
export function validateBackup(
  data: unknown
): BackupValidationResult & { data?: BackupData } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Backup must be a JSON object'], schemaVersion: null };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'number') {
    errors.push('Missing or invalid schemaVersion');
  }

  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : null;

  if (version !== null && version > BACKUP_SCHEMA_VERSION) {
    errors.push(
      `Backup schema version ${version} is newer than supported version ${BACKUP_SCHEMA_VERSION}. Update the app to restore this backup.`
    );
  }

  if (!Array.isArray(obj.sessions)) {
    errors.push('Missing or invalid sessions array');
  }

  if (!Array.isArray(obj.exercises)) {
    errors.push('Missing or invalid exercises array');
  }

  if (!Array.isArray(obj.recordings)) {
    errors.push('Missing or invalid recordings array');
  }

  if (typeof obj.preferences !== 'object' || obj.preferences === null) {
    errors.push('Missing or invalid preferences object');
  }

  if (errors.length > 0) {
    return { valid: false, errors, schemaVersion: version };
  }

  return { valid: true, errors: [], schemaVersion: version, data: obj as unknown as BackupData };
}

/**
 * Restore data from a validated backup into repositories.
 * Merges with existing data (does not clear first).
 */
export async function restoreBackup(
  backup: BackupData,
  deps: RestoreDependencies
): Promise<RestoreResult> {
  const { sessionRepo, exerciseRepo, recordingRepo, adapter } = deps;

  const [sessionsRestored, exercisesRestored, recordingsRestored] = await Promise.all([
    restoreSessions(backup.sessions, sessionRepo),
    restoreExercises(backup.exercises, exerciseRepo),
    restoreRecordings(backup.recordings, recordingRepo),
  ]);

  const preferencesRestored = await restorePreferences(backup.preferences, adapter);

  return {
    sessionsRestored,
    exercisesRestored,
    recordingsRestored,
    preferencesRestored,
  };
}

async function restoreSessions(
  sessions: BackupData['sessions'],
  repo: ExerciseSessionRepository
): Promise<number> {
  let count = 0;
  for (const session of sessions) {
    await repo.save(session);
    count++;
  }
  return count;
}

async function restoreExercises(
  exercises: BackupData['exercises'],
  repo: ExerciseRepository
): Promise<number> {
  let count = 0;
  for (const exercise of exercises) {
    await repo.save(exercise);
    count++;
  }
  return count;
}

async function restoreRecordings(
  recordings: BackupData['recordings'],
  repo: RecordingRepository
): Promise<number> {
  let count = 0;
  for (const recording of recordings) {
    await repo.save(recording);
    count++;
  }
  return count;
}

async function restorePreferences(
  preferences: BackupData['preferences'],
  adapter: StorageAdapter
): Promise<boolean> {
  if (preferences.lastDevice) {
    await adapter.set(STORAGE_KEYS.LAST_DEVICE, preferences.lastDevice);
  }
  await adapter.set(STORAGE_KEYS.AUTO_RECONNECT, preferences.autoReconnect);
  await adapter.set(STORAGE_KEYS.HAPTIC_CUES_ENABLED, preferences.hapticCuesEnabled);
  await adapter.set(STORAGE_KEYS.AUDIO_CUES_ENABLED, preferences.audioCuesEnabled);
  return true;
}
