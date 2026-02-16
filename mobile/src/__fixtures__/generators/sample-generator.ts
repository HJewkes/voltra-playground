/**
 * WorkoutSample Generator
 *
 * Generates realistic WorkoutSamples and sample streams for testing and replay.
 */

import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';

function createSample(
  sequence: number, timestamp: number, phase: MovementPhase,
  position: number, velocity: number, force: number
): WorkoutSample {
  return { sequence, timestamp, phase, position, velocity, force };
}

// =============================================================================
// Types
// =============================================================================

export interface GenerateSampleOptions {
  sequence?: number;
  timestamp?: number;
  phase?: MovementPhase;
  position?: number;
  velocity?: number;
  force?: number;
}

export interface GenerateStreamOptions {
  /** Number of reps to generate */
  repCount: number;
  /** Weight in lbs (affects force) */
  weight?: number;
  /** Starting concentric velocity in m/s */
  startingVelocity?: number;
  /** Velocity drop per rep (fatigue simulation) */
  fatigueRate?: number;
  /** Concentric phase duration in ms */
  concentricDuration?: number;
  /** Eccentric phase duration in ms */
  eccentricDuration?: number;
  /** Rest between reps in ms */
  restBetweenReps?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Starting timestamp */
  startTime?: number;
}

// =============================================================================
// Single Sample Generator
// =============================================================================

let globalSequence = 0;

/**
 * Generate a single WorkoutSample.
 */
export function generateWorkoutSample(options: GenerateSampleOptions = {}): WorkoutSample {
  const {
    sequence = globalSequence++,
    timestamp = Date.now(),
    phase = MovementPhase.IDLE,
    position = 0,
    velocity = 0,
    force = 0,
  } = options;

  return createSample(sequence, timestamp, phase, position, velocity, force);
}

/**
 * Reset the global sequence counter (useful for tests).
 */
export function resetSequence(): void {
  globalSequence = 0;
}

// =============================================================================
// Stream Generator
// =============================================================================

/**
 * Generate a realistic sample stream simulating multiple reps.
 */
export function generateSampleStream(options: GenerateStreamOptions): WorkoutSample[] {
  const {
    repCount,
    weight = 100,
    startingVelocity = 0.8,
    fatigueRate = 0.03,
    concentricDuration = 800,
    eccentricDuration = 1500,
    restBetweenReps = 500,
    sampleRate = 11,
    startTime = Date.now(),
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = 0;

  // Force is roughly proportional to weight
  const baseForce = weight * 1.5;

  for (let rep = 0; rep < repCount; rep++) {
    const velocity = startingVelocity - rep * fatigueRate;

    // Brief idle at start
    const idleSamples = Math.floor((restBetweenReps / 1000) * sampleRate);
    for (let i = 0; i < idleSamples; i++) {
      samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
      currentTime += 1000 / sampleRate;
    }

    // Concentric phase (pulling up)
    const concentricSamples = Math.floor((concentricDuration / 1000) * sampleRate);
    for (let i = 0; i < concentricSamples; i++) {
      const progress = i / concentricSamples;
      // Position goes 0 -> 1
      const position = progress;
      // Velocity curve: ramps up then down
      const velocityCurve = Math.sin(progress * Math.PI) * velocity;
      // Force is highest at start
      const force = baseForce * (1 - progress * 0.3);

      samples.push(
        createSample(
          sequence++,
          currentTime,
          MovementPhase.CONCENTRIC,
          position,
          velocityCurve,
          force
        )
      );
      currentTime += 1000 / sampleRate;
    }

    // Brief hold at top
    const holdSamples = 2;
    for (let i = 0; i < holdSamples; i++) {
      samples.push(
        createSample(sequence++, currentTime, MovementPhase.HOLD, 1, 0, baseForce * 0.5)
      );
      currentTime += 1000 / sampleRate;
    }

    // Eccentric phase (lowering)
    const eccentricSamples = Math.floor((eccentricDuration / 1000) * sampleRate);
    for (let i = 0; i < eccentricSamples; i++) {
      const progress = i / eccentricSamples;
      // Position goes 1 -> 0
      const position = 1 - progress;
      // Eccentric is slower, more controlled
      const eccentricVelocity = velocity * 0.5 * Math.sin(progress * Math.PI);
      // Force during eccentric
      const force = baseForce * 0.8 * (1 - progress * 0.2);

      samples.push(
        createSample(
          sequence++,
          currentTime,
          MovementPhase.ECCENTRIC,
          position,
          eccentricVelocity,
          force
        )
      );
      currentTime += 1000 / sampleRate;
    }
  }

  // Final idle
  samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));

  return samples;
}
