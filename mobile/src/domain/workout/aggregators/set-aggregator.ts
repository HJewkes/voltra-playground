/**
 * SetAggregator - computes SetMetrics from reps using tiered computation.
 *
 * Data flow: Rep[] → VelocityMetrics → FatigueAnalysis → EffortEstimate
 *
 * Hardware-agnostic - only knows about Rep and its metrics.
 */
import type { Rep } from '@/domain/workout/models/rep';
import type {
  SetMetrics,
  VelocityMetrics,
  FatigueAnalysis,
  EffortEstimate,
  TempoTarget,
} from '@/domain/workout/models/set';

// ============================================================
// Configuration
// ============================================================

export interface SetAggregatorConfig {
  // Fatigue index weighting
  concentricWeight: number; // Default: 0.6
  eccentricWeight: number; // Default: 0.4
  eccentricSpeedupPenalty: number; // Default: 1.5

  // Baseline settings
  baselineReps: number; // Default: 2
}

export const DEFAULT_CONFIG: SetAggregatorConfig = {
  concentricWeight: 0.6,
  eccentricWeight: 0.4,
  eccentricSpeedupPenalty: 1.5,
  baselineReps: 2,
};

// ============================================================
// Main Entry Point
// ============================================================

export function aggregateSet(
  reps: Rep[],
  targetTempo: TempoTarget | null,
  config: SetAggregatorConfig = DEFAULT_CONFIG,
): SetMetrics {
  if (reps.length === 0) return createEmptySetMetrics();

  // Tier 1: Compute velocity metrics (raw measurements)
  const velocity = computeVelocityMetrics(reps, targetTempo, config);

  // Tier 2: Compute fatigue analysis (pattern detection from velocity)
  const fatigue = computeFatigueAnalysis(velocity, config);

  // Tier 3: Compute effort estimate (RIR/RPE from fatigue)
  const effort = computeEffortEstimate(fatigue);

  return {
    repCount: reps.length,
    totalDuration: reps.reduce((sum, r) => sum + r.metrics.totalDuration, 0),
    timeUnderTension: reps.reduce(
      (sum, r) => sum + r.metrics.concentricDuration + r.metrics.eccentricDuration,
      0,
    ),
    velocity,
    fatigue,
    effort,
  };
}

// ============================================================
// Tier 1: VelocityMetrics (Raw Measurements)
// ============================================================

function computeVelocityMetrics(
  reps: Rep[],
  _targetTempo: TempoTarget | null,
  config: SetAggregatorConfig,
): VelocityMetrics {
  // Extract per-rep velocities
  const concentricByRep = reps.map((r) => r.metrics.concentricMeanVelocity);
  const eccentricByRep = reps.map((r) => r.metrics.eccentricMeanVelocity);

  // Establish baseline from first N reps (or target tempo if provided)
  const baseline = establishBaseline(reps, config.baselineReps);

  // Get latest values
  const lastRep = reps[reps.length - 1];
  const concentricLast = lastRep.metrics.concentricMeanVelocity;
  const eccentricLast = lastRep.metrics.eccentricMeanVelocity;

  // Compute deltas (% change from baseline)
  const concentricDelta = computeDelta(concentricLast, baseline.concentric);
  const eccentricDelta = computeDelta(eccentricLast, baseline.eccentric);

  return {
    concentricBaseline: baseline.concentric,
    eccentricBaseline: baseline.eccentric,
    concentricLast,
    eccentricLast,
    concentricDelta,
    eccentricDelta,
    concentricByRep,
    eccentricByRep,
  };
}

interface Baseline {
  concentric: number;
  eccentric: number;
}

function establishBaseline(reps: Rep[], baselineReps: number): Baseline {
  // Use first N reps to establish rolling baseline
  const sample = reps.slice(0, Math.min(baselineReps, reps.length));

  return {
    concentric: mean(sample.map((r) => r.metrics.concentricMeanVelocity)),
    eccentric: mean(sample.map((r) => r.metrics.eccentricMeanVelocity)),
  };
  // Note: targetTempo could influence expected velocities in future
}

function computeDelta(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

// ============================================================
// Tier 2: FatigueAnalysis (Pattern Detection)
// ============================================================

function computeFatigueAnalysis(
  velocity: VelocityMetrics,
  config: SetAggregatorConfig,
): FatigueAnalysis {
  const fatigueIndex = computeFatigueIndex(
    velocity.concentricDelta,
    velocity.eccentricDelta,
    config,
  );

  const eccentricControlScore = computeEccentricControlScore(velocity.eccentricDelta);

  const formWarning = generateFormWarning(velocity, eccentricControlScore);

  return {
    fatigueIndex,
    eccentricControlScore,
    formWarning,
  };
}

function computeFatigueIndex(
  concentricDelta: number,
  eccentricDelta: number,
  config: SetAggregatorConfig,
): number {
  // Concentric slowing (negative delta) contributes to fatigue
  const concentricFatigue = Math.max(0, -concentricDelta);

  // Eccentric speeding up (positive delta) contributes with penalty
  const eccentricFatigue = Math.max(0, eccentricDelta) * config.eccentricSpeedupPenalty;

  const rawIndex = concentricFatigue * config.concentricWeight + eccentricFatigue * config.eccentricWeight;

  return Math.min(100, rawIndex);
}

function computeEccentricControlScore(eccentricDelta: number): number {
  // Higher score = better control (eccentric not speeding up)
  // Score of 100 = perfect control, decreases as eccentric speeds up
  return Math.max(0, 100 - eccentricDelta * 2);
}

function generateFormWarning(velocity: VelocityMetrics, controlScore: number): string | null {
  if (controlScore < 40) {
    return 'Eccentric control declining - slow the negative';
  }
  if (velocity.eccentricDelta > 30 && velocity.concentricDelta < -10) {
    return 'Grinding with loss of control - consider ending set';
  }
  return null;
}

// ============================================================
// Tier 3: EffortEstimate (RIR/RPE Prediction)
// ============================================================

function computeEffortEstimate(fatigue: FatigueAnalysis): EffortEstimate {
  const { fatigueIndex, eccentricControlScore } = fatigue;

  // Base RIR estimation from fatigue index
  // fatigueIndex 0 = ~6 RIR, fatigueIndex 78+ = 0 RIR
  let rir = Math.max(0, 6 - fatigueIndex / 13);

  // Adjust for poor eccentric control (indicates closer to failure)
  if (eccentricControlScore < 50) {
    rir = Math.max(0, rir - 1);
  }

  // RPE = 10 - RIR (capped at 4-10 range)
  const rpe = Math.min(10, Math.max(4, 10 - rir));

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (fatigueIndex > 50 && eccentricControlScore < 60) {
    confidence = 'high'; // Clear fatigue signal
  } else if (fatigueIndex < 20) {
    confidence = 'low'; // Not enough data yet
  }

  return {
    rir: Math.round(rir * 2) / 2, // Round to nearest 0.5
    rpe: Math.round(rpe * 2) / 2,
    confidence,
  };
}

// ============================================================
// Helpers
// ============================================================

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function createEmptySetMetrics(): SetMetrics {
  return {
    repCount: 0,
    totalDuration: 0,
    timeUnderTension: 0,
    velocity: {
      concentricBaseline: 0,
      eccentricBaseline: 0,
      concentricLast: 0,
      eccentricLast: 0,
      concentricDelta: 0,
      eccentricDelta: 0,
      concentricByRep: [],
      eccentricByRep: [],
    },
    fatigue: {
      fatigueIndex: 0,
      eccentricControlScore: 100,
      formWarning: null,
    },
    effort: {
      rir: 6,
      rpe: 4,
      confidence: 'low',
    },
  };
}
