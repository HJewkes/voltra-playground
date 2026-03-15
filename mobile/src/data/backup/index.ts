/**
 * Backup Data Module
 *
 * Export and import of all user data for backup and restore.
 */

// Schema
export {
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type BackupPreferences,
  type BackupValidationResult,
  type RestoreResult,
} from './backup-schema';

// Backup
export { createBackup, serializeBackup } from './backup-service';

// Restore
export { parseBackup, validateBackup, restoreBackup } from './restore-service';
