/**
 * Exercise Session Storage Schema
 *
 * Defines the storage format for exercise sessions.
 * Stores raw sample data per phase so the library's Set can be reconstructed.
 *
 * Key design decisions:
 * - Stores per-rep phase samples for full analytics reconstruction
 * - Summary fields (meanVelocity, RPE, RIR) stored for quick access
 * - velocityProfile and recommendation are NOT stored (derived on demand)
 */

import type { PlannedSet, PlanSource } from '@/domain/workout';
import type { WorkoutSample } from '@voltras/workout-analytics';
import type { TrainingGoal } from '@/domain/planning';

/**
 * Termination reason for why a session ended.
 */
export type TerminationReason =
  | 'failure' // 0 reps (auto-detected via idle timeout)
  | 'velocity_grinding' // Near max effort (< 0.3 m/s)
  | 'junk_volume' // Significant performance drop (> 50% rep drop)
  | 'plan_exhausted' // Completed all planned sets
  | 'profile_complete' // Discovery: enough data points
  | 'user_stopped'; // User chose to end early

/**
 * Session status.
 */
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Stored phase sample aggregates - lightweight storage for reconstructing
 * library Phase objects. Stores the raw samples so the library can rebuild.
 */
export interface StoredPhaseAggregates {
  /** Raw workout samples for this phase */
  samples: WorkoutSample[];
}

/**
 * Stored rep with per-phase sample data.
 * The library's Rep can be reconstructed from these samples.
 */
export interface StoredRep {
  repNumber: number;
  concentric: StoredPhaseAggregates;
  eccentric: StoredPhaseAggregates;
}

/**
 * A stored set within an exercise session.
 */
export interface StoredSessionSet {
  /** Set index (0-based) */
  setIndex: number;

  /** Weight used in lbs */
  weight: number;

  /** Chains weight in lbs (if used) */
  chains?: number;

  /** Eccentric adjustment (if used) */
  eccentric?: number;

  /** Rep data with phase samples for reconstruction */
  reps: StoredRep[];

  /** Unix timestamp when set started */
  startTime: number;

  /** Unix timestamp when set ended */
  endTime: number;

  /** Summary: Mean concentric velocity for the set */
  meanVelocity: number;

  /** Summary: Estimated RPE */
  estimatedRPE: number;

  /** Summary: Estimated RIR */
  estimatedRIR: number;

  /** Summary: Velocity loss from first to last rep (percentage) */
  velocityLossPercent: number;

  /**
   * Raw workout samples for the entire set (debug mode only).
   * Contains full sample stream for replay and debugging.
   */
  rawSamples?: WorkoutSample[];
}

/**
 * Legacy stored rep format (pre-migration).
 * Used for backward-compatible loading.
 */
export interface LegacyStoredRep {
  repNumber: number;
  timestamp: { start: number; end: number };
  metrics: {
    totalDuration: number;
    concentricDuration: number;
    eccentricDuration: number;
    topPauseTime: number;
    bottomPauseTime: number;
    tempo: string;
    concentricMeanVelocity: number;
    concentricPeakVelocity: number;
    eccentricMeanVelocity: number;
    eccentricPeakVelocity: number;
    peakForce: number;
    rangeOfMotion: number;
  };
}

/**
 * Legacy stored session set format (pre-migration).
 */
export interface LegacyStoredSessionSet {
  setIndex: number;
  weight: number;
  chains?: number;
  eccentric?: number;
  reps: LegacyStoredRep[];
  startTime: number;
  endTime: number;
  meanVelocity: number;
  estimatedRPE: number;
  estimatedRIR: number;
  velocityLossPercent: number;
  rawSamples?: WorkoutSample[];
}

/**
 * Stored plan - matches ExercisePlan structure for persistence.
 */
export interface StoredExercisePlan {
  exerciseId: string;
  sets: PlannedSet[];
  defaultRestSeconds: number;
  goal?: TrainingGoal;
  generatedAt: number;
  generatedBy: PlanSource;
}

/**
 * A stored exercise session.
 *
 * Note: velocityProfile and recommendation are NOT stored.
 * They are derived on demand from completedSets.
 */
export interface StoredExerciseSession {
  /** Unique session identifier */
  id: string;

  /** Exercise identifier */
  exerciseId: string;

  /** Exercise name (human readable) */
  exerciseName?: string;

  /** Unix timestamp when session started */
  startTime: number;

  /** Unix timestamp when session ended (null if in progress) */
  endTime: number | null;

  /** The plan being executed */
  plan: StoredExercisePlan;

  /** Completed sets with full analytics */
  completedSets: StoredSessionSet[];

  /** Session status */
  status: SessionStatus;

  /** Why the session ended (only set when status is completed) */
  terminationReason?: TerminationReason;

  /** Schema version for migration support */
  schemaVersion?: number;

  /** Optional notes */
  notes?: string;
}

/**
 * Summary info for session list display.
 */
export interface ExerciseSessionSummary {
  id: string;
  exerciseId: string;
  exerciseName?: string;
  startTime: number;
  endTime: number | null;
  status: SessionStatus;
  isDiscovery: boolean;
  totalSets: number;
  plannedSets: number;
  totalReps: number;
  terminationReason?: TerminationReason;
}
