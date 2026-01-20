/**
 * Phase - a single movement phase within a rep.
 *
 * Hardware-agnostic representation of one movement phase.
 * Contains the samples that make up this phase and computed metrics.
 */
import { MovementPhase } from './types';
import type { WorkoutSample } from './sample';

export interface Phase {
  type: MovementPhase;
  timestamp: { start: number; end: number };

  /** Raw samples that make up this phase */
  samples: WorkoutSample[];

  /** Computed metrics (calculated by PhaseAggregator) */
  metrics: PhaseMetrics;
}

export interface PhaseMetrics {
  duration: number; // seconds
  meanVelocity: number; // average velocity during phase (m/s)
  peakVelocity: number; // max velocity during phase (m/s)
  meanForce: number; // average force during phase (lbs)
  peakForce: number; // max force during phase (lbs)
  startPosition: number; // normalized 0-1
  endPosition: number; // normalized 0-1
}
