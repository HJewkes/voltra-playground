/**
 * Recording Generator
 *
 * Generates realistic SampleRecording objects for testing and seeding.
 */

import { v4 as uuid } from 'uuid';
import type { SampleRecording } from '@/data/recordings';
import { generateSampleStream } from './sample-generator';

// =============================================================================
// Types
// =============================================================================

export interface GenerateRecordingOptions {
  /** Exercise ID */
  exerciseId?: string;
  /** Exercise name */
  exerciseName?: string;
  /** Weight in lbs */
  weight?: number;
  /** Number of reps */
  repCount?: number;
  /** Starting velocity */
  startingVelocity?: number;
  /** Fatigue rate */
  fatigueRate?: number;
  /** Days ago to backdate */
  daysAgo?: number;
  /** Session ID to link */
  sessionId?: string;
}

// =============================================================================
// Recording Generator
// =============================================================================

/**
 * Generate a SampleRecording with realistic sample data.
 */
export function generateRecording(options: GenerateRecordingOptions = {}): SampleRecording {
  const {
    exerciseId = 'cable_row',
    exerciseName = 'Seated Cable Row',
    weight = 100,
    repCount = 8,
    startingVelocity = 0.8,
    fatigueRate = 0.03,
    daysAgo = 0,
    sessionId,
  } = options;

  const recordedAt = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const startTime = recordedAt;

  const samples = generateSampleStream({
    repCount,
    weight,
    startingVelocity,
    fatigueRate,
    startTime,
  });

  const durationMs =
    samples.length > 0 ? samples[samples.length - 1].timestamp - samples[0].timestamp : 0;

  return {
    id: uuid(),
    sessionId,
    exerciseId,
    exerciseName,
    weight,
    recordedAt,
    durationMs,
    sampleCount: samples.length,
    samples,
    metadata: {},
  };
}
