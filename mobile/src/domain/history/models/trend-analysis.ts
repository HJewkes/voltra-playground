/**
 * Trend Analysis Models
 * 
 * Types for trend analysis computed from historical data.
 */

/**
 * Trend analysis for an exercise over time.
 * Computed from set history.
 */
export interface TrendAnalysis {
  /** Exercise identifier */
  exerciseId: string;
  
  /** Analysis period in days */
  periodDays: number;
  
  /** Number of sets in period */
  setCount: number;
  
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
  
  /** Consistency score (0-100) based on training frequency */
  consistencyScore: number;
}
