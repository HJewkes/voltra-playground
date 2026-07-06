/**
 * Backup & Restore Roundtrip Tests
 *
 * Verifies that data survives a full backup -> serialize -> parse -> restore cycle.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import { createExerciseSessionRepository } from '@/data/exercise-session/exercise-session-repository';
import { createExerciseRepository } from '@/data/exercises/exercise-repository';
import { createRecordingRepository } from '@/data/recordings/recording-repository';
import { STORAGE_KEYS } from '@/data/adapters/types';
import { TrainingGoal } from '@/domain/planning';
import { MuscleGroup } from '@/domain/exercise';
import { MovementPhase } from '@/domain/workout';
import type { StoredExerciseSession } from '@/data/exercise-session';
import type { StoredExercise } from '@/data/exercises';
import type { SampleRecording } from '@/data/recordings';
import { createBackup, serializeBackup } from '../backup-service';
import { parseBackup, validateBackup, restoreBackup } from '../restore-service';
import { BACKUP_SCHEMA_VERSION } from '../backup-schema';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSession(id: string): StoredExerciseSession {
  return {
    id,
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    startTime: 1700000000000,
    endTime: 1700000030000,
    plan: {
      exerciseId: 'cable_row',
      sets: [{ setNumber: 1, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false }],
      defaultRestSeconds: 120,
      goal: TrainingGoal.HYPERTROPHY,
      generatedAt: 1700000000000,
      generatedBy: 'standard',
    },
    completedSets: [
      {
        setIndex: 0,
        weight: 100,
        reps: [
          {
            repNumber: 1,
            concentric: {
              samples: [
                {
                  sequence: 1,
                  timestamp: 0,
                  phase: MovementPhase.CONCENTRIC,
                  velocity: 0.5,
                  force: 200,
                  position: 0.3,
                },
              ],
            },
            eccentric: {
              samples: [
                {
                  sequence: 2,
                  timestamp: 100,
                  phase: MovementPhase.ECCENTRIC,
                  velocity: 0.4,
                  force: 180,
                  position: 0.1,
                },
              ],
            },
          },
        ],
        startTime: 1700000000000,
        endTime: 1700000010000,
        meanVelocity: 0.5,
        estimatedRPE: 7,
        estimatedRIR: 3,
        velocityLossPercent: 0,
      },
    ],
    status: 'completed',
  };
}

function createTestExercise(id: string): StoredExercise {
  return {
    id,
    name: `Test Exercise ${id}`,
    muscleGroups: [MuscleGroup.BACK],
    movementPattern: 'pull' as const,
    isCustom: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

function createTestRecording(id: string): SampleRecording {
  return {
    id,
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    weight: 100,
    recordedAt: 1700000000000,
    durationMs: 5000,
    sampleCount: 1,
    samples: [
      {
        sequence: 1,
        timestamp: 0,
        phase: MovementPhase.CONCENTRIC,
        velocity: 0.5,
        force: 200,
        position: 0.3,
      },
    ],
    metadata: { deviceId: 'test-device' },
  };
}

function createDeps(adapter: InMemoryAdapter) {
  return {
    sessionRepo: createExerciseSessionRepository(adapter),
    exerciseRepo: createExerciseRepository(adapter),
    recordingRepo: createRecordingRepository(adapter),
    adapter,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Backup & Restore', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  describe('createBackup', () => {
    it('produces a backup with the current schema version', async () => {
      const deps = createDeps(adapter);
      const backup = await createBackup(deps);

      expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(backup.createdAt).toBeTruthy();
      expect(backup.appVersion).toBe('1.0.0');
    });

    it('includes all sessions, exercises, and recordings', async () => {
      const deps = createDeps(adapter);

      await deps.sessionRepo.save(createTestSession('s1'));
      await deps.sessionRepo.save(createTestSession('s2'));
      await deps.exerciseRepo.save(createTestExercise('e1'));
      await deps.recordingRepo.save(createTestRecording('r1'));

      const backup = await createBackup(deps);

      expect(backup.sessions).toHaveLength(2);
      expect(backup.exercises).toHaveLength(1);
      expect(backup.recordings).toHaveLength(1);
    });

    it('includes preferences with defaults', async () => {
      const deps = createDeps(adapter);
      const backup = await createBackup(deps);

      expect(backup.preferences.autoReconnect).toBe(true);
      expect(backup.preferences.hapticCuesEnabled).toBe(true);
      expect(backup.preferences.audioCuesEnabled).toBe(true);
      expect(backup.preferences.lastDevice).toBeNull();
    });

    it('captures stored preferences', async () => {
      const deps = createDeps(adapter);
      await adapter.set(STORAGE_KEYS.AUTO_RECONNECT, false);
      await adapter.set(STORAGE_KEYS.LAST_DEVICE, { id: 'dev-1', name: 'VTR-1234', rssi: -50 });

      const backup = await createBackup(deps);

      expect(backup.preferences.autoReconnect).toBe(false);
      expect(backup.preferences.lastDevice?.id).toBe('dev-1');
    });
  });

  describe('parseBackup / validateBackup', () => {
    it('accepts a valid backup', () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        appVersion: '1.0.0',
        sessions: [],
        exercises: [],
        recordings: [],
        preferences: {
          lastDevice: null,
          autoReconnect: true,
          hapticCuesEnabled: true,
          audioCuesEnabled: true,
        },
      });

      const result = parseBackup(json);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid JSON', () => {
      const result = parseBackup('not json');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid JSON');
    });

    it('rejects non-object input', () => {
      const result = validateBackup('string');
      expect(result.valid).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = validateBackup({ schemaVersion: 1 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects newer schema version', () => {
      const result = validateBackup({
        schemaVersion: 999,
        sessions: [],
        exercises: [],
        recordings: [],
        preferences: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('newer'))).toBe(true);
    });
  });

  describe('restoreBackup', () => {
    it('writes sessions, exercises, recordings, and preferences', async () => {
      const deps = createDeps(adapter);

      const backup = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        appVersion: '1.0.0',
        sessions: [createTestSession('s1')],
        exercises: [createTestExercise('e1')],
        recordings: [createTestRecording('r1')],
        preferences: {
          lastDevice: { id: 'dev-1', name: 'VTR-1234', rssi: -50 },
          autoReconnect: false,
          hapticCuesEnabled: false,
          audioCuesEnabled: true,
        },
      };

      const result = await restoreBackup(backup, deps);

      expect(result.sessionsRestored).toBe(1);
      expect(result.exercisesRestored).toBe(1);
      expect(result.recordingsRestored).toBe(1);
      expect(result.preferencesRestored).toBe(true);

      const session = await deps.sessionRepo.getById('s1');
      expect(session).not.toBeNull();

      const exercise = await deps.exerciseRepo.getById('e1');
      expect(exercise).not.toBeNull();

      const recording = await deps.recordingRepo.getById('r1');
      expect(recording).not.toBeNull();

      const autoReconnect = await adapter.get<boolean>(STORAGE_KEYS.AUTO_RECONNECT);
      expect(autoReconnect).toBe(false);
    });
  });

  describe('roundtrip: backup -> serialize -> parse -> restore', () => {
    it('preserves all data through a full cycle', async () => {
      const sourceAdapter = new InMemoryAdapter();
      const sourceDeps = createDeps(sourceAdapter);

      await sourceDeps.sessionRepo.save(createTestSession('round-s1'));
      await sourceDeps.sessionRepo.save(createTestSession('round-s2'));
      await sourceDeps.exerciseRepo.save(createTestExercise('round-e1'));
      await sourceDeps.recordingRepo.save(createTestRecording('round-r1'));
      await sourceAdapter.set(STORAGE_KEYS.AUTO_RECONNECT, false);
      await sourceAdapter.set(STORAGE_KEYS.HAPTIC_CUES_ENABLED, false);
      await sourceAdapter.set(STORAGE_KEYS.LAST_DEVICE, {
        id: 'dev-42',
        name: 'VTR-9999',
        rssi: -65,
      });

      const backup = await createBackup(sourceDeps);
      const json = serializeBackup(backup);
      const parsed = parseBackup(json);

      expect(parsed.valid).toBe(true);
      expect(parsed.data).toBeDefined();

      const targetAdapter = new InMemoryAdapter();
      const targetDeps = createDeps(targetAdapter);

      const result = await restoreBackup(parsed.data!, targetDeps);

      expect(result.sessionsRestored).toBe(2);
      expect(result.exercisesRestored).toBe(1);
      expect(result.recordingsRestored).toBe(1);

      const s1 = await targetDeps.sessionRepo.getById('round-s1');
      expect(s1).not.toBeNull();
      expect(s1?.exerciseName).toBe('Seated Cable Row');
      expect(s1?.completedSets).toHaveLength(1);
      expect(s1?.completedSets[0].reps[0].concentric.samples).toHaveLength(1);

      const e1 = await targetDeps.exerciseRepo.getById('round-e1');
      expect(e1?.name).toBe('Test Exercise round-e1');

      const r1 = await targetDeps.recordingRepo.getById('round-r1');
      expect(r1?.samples).toHaveLength(1);

      const device = await targetAdapter.get<{ id: string }>(STORAGE_KEYS.LAST_DEVICE);
      expect(device?.id).toBe('dev-42');

      const autoReconnect = await targetAdapter.get<boolean>(STORAGE_KEYS.AUTO_RECONNECT);
      expect(autoReconnect).toBe(false);

      const haptic = await targetAdapter.get<boolean>(STORAGE_KEYS.HAPTIC_CUES_ENABLED);
      expect(haptic).toBe(false);
    });

    it('handles empty data gracefully', async () => {
      const sourceDeps = createDeps(new InMemoryAdapter());
      const backup = await createBackup(sourceDeps);
      const json = serializeBackup(backup);
      const parsed = parseBackup(json);

      expect(parsed.valid).toBe(true);

      const targetDeps = createDeps(new InMemoryAdapter());
      const result = await restoreBackup(parsed.data!, targetDeps);

      expect(result.sessionsRestored).toBe(0);
      expect(result.exercisesRestored).toBe(0);
      expect(result.recordingsRestored).toBe(0);
      expect(result.preferencesRestored).toBe(true);
    });
  });
});
