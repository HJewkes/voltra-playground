/**
 * Personal Record Models
 *
 * Types for personal records computed from historical data.
 */

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

  /** Set ID that set this record */
  setId: string;
}
