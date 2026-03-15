/**
 * Backup Schema
 *
 * Defines the backup file format with schema versioning
 * for forward compatibility across app versions.
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import type { StoredExercise } from '@/data/exercises';
import type { SampleRecording } from '@/data/recordings';
import type { Device } from '@/data/preferences';

/**
 * Current backup schema version.
 * Increment when making breaking changes to the backup format.
 */
export const BACKUP_SCHEMA_VERSION = 1;

/**
 * Preferences snapshot for backup.
 */
export interface BackupPreferences {
  lastDevice: Device | null;
  autoReconnect: boolean;
  hapticCuesEnabled: boolean;
  audioCuesEnabled: boolean;
}

/**
 * Complete backup payload.
 */
export interface BackupData {
  /** Schema version for migration support */
  schemaVersion: number;

  /** ISO timestamp when backup was created */
  createdAt: string;

  /** App version that created the backup */
  appVersion: string;

  /** All exercise sessions */
  sessions: StoredExerciseSession[];

  /** All exercise definitions */
  exercises: StoredExercise[];

  /** All sample recordings */
  recordings: SampleRecording[];

  /** User preferences */
  preferences: BackupPreferences;
}

/**
 * Result of a backup validation.
 */
export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  schemaVersion: number | null;
}

/**
 * Result of a restore operation.
 */
export interface RestoreResult {
  sessionsRestored: number;
  exercisesRestored: number;
  recordingsRestored: number;
  preferencesRestored: boolean;
}
