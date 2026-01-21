/**
 * Set - a collection of reps at one weight.
 *
 * Hardware-agnostic representation of one set.
 * This is what we previously called "workout" in many places.
 */
import type { Rep } from './rep';

export interface Set {
  id: string;
  exerciseId: string;
  exerciseName?: string;

  // Configuration
  weight: number;
  chains?: number;
  eccentricOffset?: number;
  targetTempo?: TempoTarget;

  // Building blocks
  reps: Rep[];

  // Timing
  timestamp: { start: number; end: number | null };

  // Aggregated metrics (computed by SetAggregator)
  metrics: SetMetrics;
}

/**
 * SetMetrics - Hierarchical metrics with clear data flow:
 *
 *   Rep[] → VelocityMetrics → FatigueAnalysis → EffortEstimate
 *           (measurements)     (pattern detect)   (final output)
 */
export interface SetMetrics {
  repCount: number;
  totalDuration: number;
  timeUnderTension: number;

  // Tier 1: Quantitative velocity measurements
  velocity: VelocityMetrics;

  // Tier 2: Pattern detection from velocity changes
  fatigue: FatigueAnalysis;

  // Tier 3: Final RIR/RPE prediction
  effort: EffortEstimate;
}

/**
 * VelocityMetrics - Raw quantitative measurements from rep velocities.
 * Input: Rep[] (specifically rep.metrics.concentricMeanVelocity, eccentricMeanVelocity)
 * Output: Baseline, deltas, and per-rep trends
 */
export interface VelocityMetrics {
  // Baselines (from first N reps or target tempo)
  concentricBaseline: number;
  eccentricBaseline: number;

  // Current values (latest rep)
  concentricLast: number;
  eccentricLast: number;

  // Deltas (% change from baseline, positive = faster)
  concentricDelta: number; // negative = slowing (expected fatigue)
  eccentricDelta: number; // positive = speeding up (loss of control)

  // Per-rep trends (for charts)
  concentricByRep: number[];
  eccentricByRep: number[];
}

/**
 * FatigueAnalysis - Pattern detection from velocity changes.
 * Input: VelocityMetrics
 * Output: Composite scores and warnings
 */
export interface FatigueAnalysis {
  // Composite fatigue score (0-100)
  // Combines concentric slowdown + eccentric speedup
  fatigueIndex: number;

  // Eccentric control quality (0-100, higher = better)
  // Low score = dropping weight too fast
  eccentricControlScore: number;

  // Form warning (null if form looks good)
  formWarning: string | null;
}

/**
 * EffortEstimate - Final RIR/RPE prediction.
 * Input: FatigueAnalysis (primarily fatigueIndex and eccentricControlScore)
 * Output: Estimated reps in reserve and perceived exertion
 */
export interface EffortEstimate {
  rir: number; // Estimated reps in reserve (0-6+)
  rpe: number; // Rate of perceived exertion (4-10)
  confidence: 'high' | 'medium' | 'low';
}

export interface TempoTarget {
  concentric: number; // seconds
  eccentric: number; // seconds
  pauseTop: number; // seconds
  pauseBottom: number; // seconds
}
