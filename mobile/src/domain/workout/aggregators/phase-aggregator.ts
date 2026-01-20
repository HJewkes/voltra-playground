/**
 * PhaseAggregator - computes Phase from WorkoutSamples.
 *
 * This is where all phase-level metric computation happens.
 * Hardware-agnostic: only knows about WorkoutSample, not TelemetryFrame.
 */
import type { WorkoutSample } from '@/domain/workout/models/sample';
import type { Phase, PhaseMetrics } from '@/domain/workout/models/phase';
import { MovementPhase } from '@/domain/workout/models/types';

/**
 * Create a Phase from a collection of samples.
 * All metric computation happens here.
 */
export function aggregatePhase(type: MovementPhase, samples: WorkoutSample[]): Phase {
  if (samples.length === 0) {
    return createEmptyPhase(type);
  }

  const metrics = computePhaseMetrics(samples);

  return {
    type,
    timestamp: {
      start: samples[0].timestamp,
      end: samples[samples.length - 1].timestamp,
    },
    samples,
    metrics,
  };
}

/**
 * Compute metrics from samples.
 * This is where we can easily add new metrics or change calculations.
 */
export function computePhaseMetrics(samples: WorkoutSample[]): PhaseMetrics {
  if (samples.length === 0) {
    return createEmptyPhaseMetrics();
  }

  const velocities = samples.map((s) => s.velocity);
  const forces = samples.map((s) => s.force);
  const duration = (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000;

  return {
    duration,
    meanVelocity: mean(velocities),
    peakVelocity: Math.max(...velocities),
    meanForce: mean(forces),
    peakForce: Math.max(...forces),
    startPosition: samples[0].position,
    endPosition: samples[samples.length - 1].position,
  };
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function createEmptyPhase(type: MovementPhase): Phase {
  return {
    type,
    timestamp: { start: 0, end: 0 },
    samples: [],
    metrics: createEmptyPhaseMetrics(),
  };
}

function createEmptyPhaseMetrics(): PhaseMetrics {
  return {
    duration: 0,
    meanVelocity: 0,
    peakVelocity: 0,
    meanForce: 0,
    peakForce: 0,
    startPosition: 0,
    endPosition: 0,
  };
}
