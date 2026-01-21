/**
 * Exercise Session Storage Schema
 *
 * Defines the storage format for exercise sessions.
 * This is the unified storage replacing both set and discovery storage.
 *
 * Key design decisions:
 * - Stores full ExercisePlan for plan vs actual comparison
 * - Stores StoredSessionSet[] for rich analytics
 * - velocityProfile and recommendation are NOT stored (derived on demand)
 */

import type { ExercisePlan, PlannedSet, PlanSource, WorkoutSample } from '@/domain/workout';
import type { TrainingGoal } from '@/domain/planning';
import type { StoredRep } from '@/domain/workout';

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
 * A stored set within an exercise session.
 * Reuses existing StoredRep format.
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

  /** Rep data with phase-specific metrics */
  reps: StoredRep[];

  /** Unix timestamp when set started */
  startTime: number;

  /** Unix timestamp when set ended */
  endTime: number;

  /** Mean concentric velocity for the set */
  meanVelocity: number;

  /** Estimated RPE */
  estimatedRPE: number;

  /** Estimated RIR */
  estimatedRIR: number;

  /** Velocity loss from first to last rep (percentage) */
  velocityLossPercent: number;

  /**
   * Raw workout samples for the entire set (debug mode only).
   * Contains full sample stream for replay and debugging.
   * Only populated when debug telemetry is enabled.
   */
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
 * They are derived on demand from completedSets via:
 *   - buildLoadVelocityProfile(completedSets)
 *   - generateWorkingWeightRecommendation(profile, goal)
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
