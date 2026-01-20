/**
 * Velocity Baseline Models
 * 
 * Types for velocity-load profiles computed from historical data.
 */

/**
 * Velocity baseline data point.
 * Represents first-rep velocity at a given weight.
 */
export interface VelocityDataPoint {
  /** Weight in lbs */
  weight: number;
  
  /** First-rep concentric mean velocity */
  velocity: number;
  
  /** When this data was recorded */
  timestamp: number;
}

/**
 * Velocity baseline for an exercise.
 * Computed from set history - NOT stored directly.
 */
export interface VelocityBaseline {
  /** Exercise identifier */
  exerciseId: string;
  
  /** Historical velocity data points */
  dataPoints: VelocityDataPoint[];
  
  /** When the baseline was last computed */
  lastUpdated: number;
}
