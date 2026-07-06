/**
 * Backup Service
 *
 * Enumerates all repositories and serializes data to a backup payload.
 * Works with any StorageAdapter implementation via the repository layer.
 */

import type { ExerciseSessionRepository } from '@/data/exercise-session';
import type { ExerciseRepository } from '@/data/exercises';
import type { RecordingRepository } from '@/data/recordings';
import type { StorageAdapter } from '@/data/adapters';
import { STORAGE_KEYS } from '@/data/adapters';
import type { Device } from '@/data/preferences';
import { type BackupData, type BackupPreferences, BACKUP_SCHEMA_VERSION } from './backup-schema';

interface BackupDependencies {
  sessionRepo: ExerciseSessionRepository;
  exerciseRepo: ExerciseRepository;
  recordingRepo: RecordingRepository;
  adapter: StorageAdapter;
}

/**
 * Create a complete backup of all user data.
 */
export async function createBackup(deps: BackupDependencies): Promise<BackupData> {
  const { sessionRepo, exerciseRepo, recordingRepo, adapter } = deps;

  const [sessions, exercises, recordings, preferences] = await Promise.all([
    collectSessions(sessionRepo),
    exerciseRepo.getAll(),
    recordingRepo.getAll(),
    collectPreferences(adapter),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: '1.0.0',
    sessions,
    exercises,
    recordings,
    preferences,
  };
}

/**
 * Serialize a BackupData payload to a JSON string.
 */
export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

async function collectSessions(repo: ExerciseSessionRepository): Promise<BackupData['sessions']> {
  return repo.getRecent(10_000);
}

async function collectPreferences(adapter: StorageAdapter): Promise<BackupPreferences> {
  const [lastDevice, autoReconnect, hapticCuesEnabled, audioCuesEnabled] = await Promise.all([
    adapter.get<Device>(STORAGE_KEYS.LAST_DEVICE),
    adapter.get<boolean>(STORAGE_KEYS.AUTO_RECONNECT),
    adapter.get<boolean>(STORAGE_KEYS.HAPTIC_CUES_ENABLED),
    adapter.get<boolean>(STORAGE_KEYS.AUDIO_CUES_ENABLED),
  ]);

  return {
    lastDevice: lastDevice ?? null,
    autoReconnect: autoReconnect ?? true,
    hapticCuesEnabled: hapticCuesEnabled ?? true,
    audioCuesEnabled: audioCuesEnabled ?? true,
  };
}
