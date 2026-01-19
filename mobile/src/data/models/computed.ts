/**
 * Computed Data Types
 * 
 * These types are COMPUTED from workout history, not stored separately.
 * HistoryStore calculates these on-demand and caches them in memory.
 */

/**
 * Velocity baseline data point.
 * Represents first-rep velocity at a given weight.
 */
export interface VelocityDataPoint {
  /** Weight in lbs */
  weight: number;
  
  /** First-rep peak velocity */
  velocity: number;
  
  /** When this data was recorded */
  timestamp: number;
}

/**
 * Velocity baseline for an exercise.
 * Computed from workout history - NOT stored directly.
 */
export interface VelocityBaseline {
  /** Exercise identifier */
  exerciseId: string;
  
  /** Historical velocity data points */
  dataPoints: VelocityDataPoint[];
  
  /** When the baseline was last computed */
  lastUpdated: number;
}

/**
 * A personal record for an exercise.
 */
export interface PersonalRecord {
  /** Type of record */
  type: 'max_weight' | 'max_reps' | 'max_velocity' | 'max_volume';
  
  /** The record value */
  value: number;
  
  /** Weight at which record was achieved */
  weight: number;
  
  /** Reps at which record was achieved (if applicable) */
  reps?: number;
  
  /** When the record was set */
  date: number;
  
  /** Workout ID that set this record */
  workoutId: string;
}

/**
 * Trend analysis for an exercise over time.
 * Computed from workout history.
 */
export interface TrendAnalysis {
  /** Exercise identifier */
  exerciseId: string;
  
  /** Analysis period in days */
  periodDays: number;
  
  /** Number of workouts in period */
  workoutCount: number;
  
  /** Average weight used */
  avgWeight: number;
  
  /** Weight trend (lbs/week) */
  weightTrend: number;
  
  /** Average velocity */
  avgVelocity: number;
  
  /** Velocity trend (mm/s per week) */
  velocityTrend: number;
  
  /** Average RPE */
  avgRPE: number;
  
  /** Total volume (weight × reps) */
  totalVolume: number;
  
  /** Volume trend (lbs × reps / week) */
  volumeTrend: number;
  
  /** Consistency score (0-100) based on workout frequency */
  consistencyScore: number;
}

/**
 * Compute velocity baseline from workout history.
 */
export function computeVelocityBaseline(
  exerciseId: string,
  workouts: Array<{ weight: number; reps: Array<{ maxVelocity: number }>; date: number }>
): VelocityBaseline {
  const dataPoints: VelocityDataPoint[] = workouts
    .filter(w => w.reps.length > 0 && w.reps[0].maxVelocity > 0)
    .map(w => ({
      weight: w.weight,
      velocity: w.reps[0].maxVelocity,
      timestamp: w.date,
    }))
    .sort((a, b) => a.weight - b.weight);
  
  return {
    exerciseId,
    dataPoints,
    lastUpdated: Date.now(),
  };
}

/**
 * Interpolate expected velocity at a given weight from baseline.
 */
export function interpolateVelocity(baseline: VelocityBaseline, weight: number): number | null {
  const points = baseline.dataPoints;
  if (points.length === 0) return null;
  if (points.length === 1) return points[0].velocity;
  
  // Find bracketing weights
  const sorted = [...points].sort((a, b) => a.weight - b.weight);
  
  // If below range, extrapolate from first two
  if (weight <= sorted[0].weight) {
    if (sorted.length < 2) return sorted[0].velocity;
    const slope = (sorted[1].velocity - sorted[0].velocity) / (sorted[1].weight - sorted[0].weight);
    return sorted[0].velocity + slope * (weight - sorted[0].weight);
  }
  
  // If above range, extrapolate from last two
  if (weight >= sorted[sorted.length - 1].weight) {
    if (sorted.length < 2) return sorted[sorted.length - 1].velocity;
    const n = sorted.length;
    const slope = (sorted[n - 1].velocity - sorted[n - 2].velocity) / (sorted[n - 1].weight - sorted[n - 2].weight);
    return sorted[n - 1].velocity + slope * (weight - sorted[n - 1].weight);
  }
  
  // Find bracketing points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    if (weight >= sorted[i].weight && weight <= sorted[i + 1].weight) {
      const ratio = (weight - sorted[i].weight) / (sorted[i + 1].weight - sorted[i].weight);
      return sorted[i].velocity + ratio * (sorted[i + 1].velocity - sorted[i].velocity);
    }
  }
  
  return null;
}
