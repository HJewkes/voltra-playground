/**
 * Exercise Domain Types
 *
 * Core types for exercise definitions and classification.
 * These are the foundational types used across the exercise catalog.
 */

// =============================================================================
// Muscle Groups
// =============================================================================

/**
 * Major muscle groups for exercise classification and volume tracking.
 */
export enum MuscleGroup {
  QUADS = 'quads',
  HAMSTRINGS = 'hamstrings',
  GLUTES = 'glutes',
  BACK = 'back',
  CHEST = 'chest',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  CORE = 'core',
  CALVES = 'calves',
}

// =============================================================================
// Movement Patterns
// =============================================================================

/**
 * Movement pattern categories for exercise classification.
 */
export type MovementPattern =
  | 'push'
  | 'pull'
  | 'hinge'
  | 'squat'
  | 'lunge'
  | 'carry'
  | 'rotation'
  | 'isolation';

// =============================================================================
// Exercise Types
// =============================================================================

/**
 * Exercise type classification.
 * - compound: Multi-joint movements (squats, rows, presses)
 * - isolation: Single-joint movements (curls, extensions)
 */
export type ExerciseType = 'compound' | 'isolation';

// =============================================================================
// Equipment Setup
// =============================================================================

/**
 * Voltra-specific equipment setup configuration.
 */
export interface VoltrasSetup {
  /** Cable path configuration */
  cablePath?: 'high' | 'mid' | 'low';
  /** Attachment type */
  attachment?: string;
  /** Setup notes */
  notes?: string;
}
