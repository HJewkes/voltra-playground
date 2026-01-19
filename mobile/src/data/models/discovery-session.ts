/**
 * Discovery Session Models
 * 
 * Data structures for weight discovery sessions.
 * Used to guide users through finding optimal working weights.
 */

import type { StoredRepData } from './workout';

/**
 * Telemetry data from a single discovery set.
 */
export interface DiscoverySetTelemetry {
  /** Set number in the discovery sequence */
  setNumber: number;
  
  /** Weight used for this set */
  weight: number;
  
  /** Target reps for this set */
  targetReps: number;
  
  /** Actual reps completed */
  actualReps: number;
  
  /** Mean velocity across reps */
  meanVelocity: number;
  
  /** Peak velocity achieved */
  peakVelocity: number;
  
  /** Whether the set was failed (couldn't complete target) */
  failed: boolean;
  
  /** Unix timestamp */
  timestamp: number;
  
  /** Full rep data (without frames) */
  reps: StoredRepData[];
  
  /** Raw stats from the workout */
  stats?: {
    avgPeakForce: number;
    maxPeakForce: number;
    avgRepDuration: number;
  };
}

/**
 * A complete discovery session.
 */
export interface DiscoverySession {
  /** Unique identifier */
  id: string;
  
  /** Exercise this discovery is for */
  exerciseId: string;
  
  /** Exercise name */
  exerciseName?: string;
  
  /** Training goal for the discovery */
  goal: 'strength' | 'hypertrophy' | 'endurance';
  
  /** When the session started */
  startTime: number;
  
  /** When the session ended (null if in progress) */
  endTime: number | null;
  
  /** Whether the session completed successfully */
  completed: boolean;
  
  /** All sets performed during discovery */
  sets: DiscoverySetTelemetry[];
  
  /** Final recommendation (if completed) */
  recommendation?: DiscoveryRecommendation;
}

/**
 * Recommendation from a completed discovery session.
 */
export interface DiscoveryRecommendation {
  /** Recommended warmup sequence */
  warmupSequence: WarmupSet[];
  
  /** Recommended working weight */
  workingWeight: number;
  
  /** Recommended rep range */
  repRange: [number, number];
  
  /** Target velocity at working weight */
  targetVelocity: number;
  
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  
  /** Human-readable explanation */
  explanation: string;
}

/**
 * A warmup set recommendation.
 */
export interface WarmupSet {
  /** Weight for this warmup */
  weight: number;
  
  /** Number of reps */
  reps: number;
  
  /** Rest after this set (seconds) */
  restSeconds: number;
}
