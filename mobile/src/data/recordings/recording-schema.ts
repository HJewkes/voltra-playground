/**
 * Sample Recording Schema
 *
 * Defines the storage format for workout sample recordings.
 * Used for replay and debugging.
 */

import type { WorkoutSample } from '@/domain/workout';

/**
 * Metadata about the recording context.
 */
export interface RecordingMetadata {
  /** Device ID that produced the recording */
  deviceId?: string;

  /** Device name */
  deviceName?: string;

  /** App version when recorded */
  appVersion?: string;
}

/**
 * A stored sample recording for replay.
 */
export interface SampleRecording {
  /** Unique recording identifier */
  id: string;

  /** Link to exercise session if recorded during workout */
  sessionId?: string;

  /** Exercise identifier */
  exerciseId: string;

  /** Exercise name (human readable) */
  exerciseName: string;

  /** Weight used in lbs */
  weight: number;

  /** When the recording was created (ms since epoch) */
  recordedAt: number;

  /** Duration of the recording in milliseconds */
  durationMs: number;

  /** Number of samples in the recording */
  sampleCount: number;

  /** The actual workout sample data */
  samples: WorkoutSample[];

  /** Optional metadata about recording context */
  metadata: RecordingMetadata;
}
