/**
 * Velocity Baseline Management
 *
 * Manages velocity baselines for readiness detection.
 * Extracted from training/engines/readiness.ts.
 *
 * Baselines track expected velocity at each weight for an exercise,
 * allowing comparison of current performance to historical norms.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Velocity baseline for an exercise.
 * Maps weight → expected velocity at max effort.
 */
export interface VelocityBaseline {
  exerciseId: string;
  /** Weight (lbs) → expected velocity (m/s) */
  weightVelocityMap: Map<number, number>;
  /** When this baseline was last updated */
  lastUpdated: number;
}

/**
 * Serializable version of VelocityBaseline for storage.
 */
export interface StoredVelocityBaseline {
  exerciseId: string;
  weights: Record<number, number>;
  lastUpdated: number;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new empty velocity baseline.
 */
export function createVelocityBaseline(exerciseId: string): VelocityBaseline {
  return {
    exerciseId,
    weightVelocityMap: new Map(),
    lastUpdated: Date.now(),
  };
}

// =============================================================================
// Baseline Operations
// =============================================================================

/**
 * Get velocity baseline for a specific weight.
 * Returns null if no baseline exists for this weight (or nearby weights).
 */
export function getBaselineVelocity(
  baseline: VelocityBaseline,
  weight: number
): number | null {
  const map = baseline.weightVelocityMap;

  if (map.size === 0) {
    return null;
  }

  // Exact match
  if (map.has(weight)) {
    return map.get(weight)!;
  }

  // Interpolate from nearby weights
  return interpolateBaseline(baseline, weight);
}

/**
 * Interpolate velocity for a weight from nearby baseline points.
 */
export function interpolateBaseline(
  baseline: VelocityBaseline,
  weight: number
): number | null {
  const map = baseline.weightVelocityMap;

  if (map.size === 0) {
    return null;
  }

  const weights = Array.from(map.keys()).sort((a, b) => a - b);

  // Below minimum weight
  if (weight < weights[0]) {
    // Lighter weight = higher velocity (extrapolate up)
    const baseVelocity = map.get(weights[0])!;
    const ratio = weights[0] / (weight || 1);
    return baseVelocity * (1 + (ratio - 1) * 0.5);
  }

  // Above maximum weight
  if (weight > weights[weights.length - 1]) {
    // Heavier weight = lower velocity (extrapolate down)
    const baseVelocity = map.get(weights[weights.length - 1])!;
    const ratio = weight / (weights[weights.length - 1] || 1);
    return baseVelocity * (1 - (ratio - 1) * 0.3);
  }

  // Interpolate between two known weights
  for (let i = 0; i < weights.length - 1; i++) {
    if (weights[i] <= weight && weight <= weights[i + 1]) {
      const w1 = weights[i];
      const w2 = weights[i + 1];
      const v1 = map.get(w1)!;
      const v2 = map.get(w2)!;

      // Linear interpolation
      const ratio = (weight - w1) / (w2 - w1);
      return v1 + (v2 - v1) * ratio;
    }
  }

  return null;
}

/**
 * Update baseline with a new observation.
 * Uses exponential moving average for smooth updates.
 *
 * @param baseline - Current baseline
 * @param weight - Weight used
 * @param velocity - Observed velocity
 * @param wasMaxEffort - Only update from max effort sets
 * @param learningRate - How much to weight new observations (0-1)
 */
export function updateBaseline(
  baseline: VelocityBaseline,
  weight: number,
  velocity: number,
  wasMaxEffort: boolean = true,
  learningRate: number = 0.2
): VelocityBaseline {
  // Only update from max effort sets
  if (!wasMaxEffort || velocity <= 0) {
    return baseline;
  }

  const newMap = new Map(baseline.weightVelocityMap);
  const currentVelocity = newMap.get(weight);

  if (currentVelocity === undefined) {
    // First observation at this weight
    newMap.set(weight, velocity);
  } else {
    // Exponential moving average
    const newVelocity = (1 - learningRate) * currentVelocity + learningRate * velocity;
    newMap.set(weight, newVelocity);
  }

  return {
    ...baseline,
    weightVelocityMap: newMap,
    lastUpdated: Date.now(),
  };
}

/**
 * Set a specific baseline value (overwrites existing).
 */
export function setBaselineValue(
  baseline: VelocityBaseline,
  weight: number,
  velocity: number
): VelocityBaseline {
  const newMap = new Map(baseline.weightVelocityMap);
  newMap.set(weight, velocity);

  return {
    ...baseline,
    weightVelocityMap: newMap,
    lastUpdated: Date.now(),
  };
}

// =============================================================================
// Persistence Helpers
// =============================================================================

/**
 * Convert baseline to storable format.
 */
export function baselineToStored(baseline: VelocityBaseline): StoredVelocityBaseline {
  const weights: Record<number, number> = {};
  for (const [weight, velocity] of baseline.weightVelocityMap) {
    weights[weight] = velocity;
  }

  return {
    exerciseId: baseline.exerciseId,
    weights,
    lastUpdated: baseline.lastUpdated,
  };
}

/**
 * Convert stored format back to baseline.
 */
export function storedToBaseline(stored: StoredVelocityBaseline): VelocityBaseline {
  const map = new Map<number, number>();
  for (const [weightStr, velocity] of Object.entries(stored.weights)) {
    map.set(Number(weightStr), velocity);
  }

  return {
    exerciseId: stored.exerciseId,
    weightVelocityMap: map,
    lastUpdated: stored.lastUpdated,
  };
}

/**
 * Export multiple baselines for persistence.
 */
export function exportBaselines(
  baselines: Map<string, VelocityBaseline>
): Record<string, StoredVelocityBaseline> {
  const result: Record<string, StoredVelocityBaseline> = {};
  for (const [exerciseId, baseline] of baselines) {
    result[exerciseId] = baselineToStored(baseline);
  }
  return result;
}

/**
 * Import baselines from storage.
 */
export function importBaselines(
  stored: Record<string, StoredVelocityBaseline>
): Map<string, VelocityBaseline> {
  const result = new Map<string, VelocityBaseline>();
  for (const [exerciseId, storedBaseline] of Object.entries(stored)) {
    result.set(exerciseId, storedToBaseline(storedBaseline));
  }
  return result;
}
