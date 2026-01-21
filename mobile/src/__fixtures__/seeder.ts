/**
 * Database Seeder
 *
 * Seeds the database with realistic sample data for development.
 */

import { getSessionRepository, getRecordingRepository } from '@/data/provider';
import { generateStoredSession, generateRecording } from './generators';

// =============================================================================
// Types
// =============================================================================

export interface SeedOptions {
  /** Number of sessions to generate */
  sessionsCount?: number;
  /** How many days back to spread the sessions */
  daysBack?: number;
  /** Exercise IDs to use */
  exerciseIds?: string[];
  /** Include raw samples in sessions (uses more storage) */
  includeRawSamples?: boolean;
  /** Generate standalone recordings for replay */
  includeRecordings?: boolean;
}

export interface SeedResult {
  sessionsCreated: number;
  recordingsCreated: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_EXERCISES = [
  { id: 'cable_row', name: 'Seated Cable Row' },
  { id: 'lat_pulldown', name: 'Lat Pulldown' },
  { id: 'cable_chest_press', name: 'Cable Chest Press' },
  { id: 'cable_curl', name: 'Cable Bicep Curl' },
  { id: 'cable_tricep_pushdown', name: 'Cable Tricep Pushdown' },
];

// =============================================================================
// Seeder
// =============================================================================

/**
 * Seed the database with sample sessions.
 */
export async function seedDatabase(options: SeedOptions = {}): Promise<SeedResult> {
  const {
    sessionsCount = 20,
    daysBack = 30,
    exerciseIds,
    includeRawSamples = false,
    includeRecordings = false,
  } = options;

  const sessionRepo = getSessionRepository();
  const recordingRepo = getRecordingRepository();
  const exercises = exerciseIds ? exerciseIds.map((id) => ({ id, name: id })) : DEFAULT_EXERCISES;

  let sessionsCreated = 0;
  let recordingsCreated = 0;

  for (let i = 0; i < sessionsCount; i++) {
    // Pick a random exercise
    const exercise = exercises[i % exercises.length];

    // Spread sessions across the time range
    const daysAgo = Math.floor((i / sessionsCount) * daysBack);

    // Alternate between discovery and training
    const isDiscovery = i % 5 === 0;

    // Vary weight and reps
    const baseWeight = 80 + Math.floor(Math.random() * 40);
    const targetReps = isDiscovery ? 5 : 8 + Math.floor(Math.random() * 4);

    const session = generateStoredSession({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setCount: isDiscovery ? 5 : 4,
      isDiscovery,
      daysAgo,
      weight: baseWeight,
      targetReps,
      includeRawSamples,
    });

    await sessionRepo.save(session);
    sessionsCreated++;
  }

  // Generate standalone recordings for replay testing
  if (includeRecordings) {
    // Create a few recordings for each exercise
    for (const exercise of exercises.slice(0, 3)) {
      for (let i = 0; i < 2; i++) {
        const recording = generateRecording({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          weight: 80 + i * 20,
          repCount: 6 + i * 2,
          daysAgo: i * 3,
        });

        await recordingRepo.save(recording);
        recordingsCreated++;
      }
    }
  }

  return { sessionsCreated, recordingsCreated };
}

/**
 * Clear all seeded data.
 */
export async function clearSeedData(): Promise<void> {
  const sessionRepo = getSessionRepository();
  const recordingRepo = getRecordingRepository();

  // Clear sessions
  const sessions = await sessionRepo.getRecent(1000);
  for (const session of sessions) {
    await sessionRepo.delete(session.id);
  }

  // Clear recordings
  const recordings = await recordingRepo.getRecent(1000);
  for (const recording of recordings) {
    await recordingRepo.delete(recording.id);
  }
}
