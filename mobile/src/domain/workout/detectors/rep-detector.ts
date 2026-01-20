/**
 * Rep Detector
 *
 * Generic rep detection state machine that works with WorkoutSamples.
 * Hardware-agnostic - uses normalized phase data from any device.
 *
 * A complete rep is: IDLE -> CONCENTRIC -> (HOLD) -> ECCENTRIC -> IDLE
 */

import { MovementPhase } from '@/domain/workout/models/types';
import type { WorkoutSample } from '@/domain/workout/models/sample';

// =============================================================================
// Types
// =============================================================================

/**
 * Rep detector internal state.
 */
export type RepDetectorState = 'idle' | 'concentric' | 'hold' | 'eccentric';

/**
 * Phase-specific samples collected during a rep.
 */
export interface PhaseSamples {
  concentric: WorkoutSample[];
  eccentric: WorkoutSample[];
  holdAtTop: WorkoutSample[];
  holdAtBottom: WorkoutSample[];
}

/**
 * Result when a rep boundary is detected.
 * Contains all samples from the completed rep, organized by phase.
 */
export interface RepBoundary {
  /** Rep number (1-indexed) */
  repNumber: number;

  /** All samples from the rep in order */
  samples: WorkoutSample[];

  /** Samples organized by phase */
  phaseSamples: PhaseSamples;

  /** Timestamps */
  startTime: number;
  endTime: number;
}

// =============================================================================
// Rep Detector
// =============================================================================

/**
 * State machine for detecting rep boundaries from workout samples.
 *
 * Usage:
 * ```typescript
 * const detector = new RepDetector();
 *
 * // Process each sample as it arrives
 * for (const sample of samples) {
 *   const boundary = detector.processSample(sample);
 *   if (boundary) {
 *     // Rep completed - boundary contains phase-specific samples
 *     const rep = aggregateRep(boundary);
 *   }
 * }
 * ```
 */
export class RepDetector {
  private _state: RepDetectorState = 'idle';
  private _repCount = 0;

  // Current rep tracking
  private _currentRepSamples: WorkoutSample[] = [];
  private _concentricSamples: WorkoutSample[] = [];
  private _eccentricSamples: WorkoutSample[] = [];
  private _holdAtTopSamples: WorkoutSample[] = [];
  private _holdAtBottomSamples: WorkoutSample[] = [];
  private _repStartTime: number | null = null;

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /**
   * Get current detector state.
   */
  get state(): RepDetectorState {
    return this._state;
  }

  /**
   * Get current rep count.
   */
  get repCount(): number {
    return this._repCount;
  }

  /**
   * Check if currently in a rep.
   */
  get isInRep(): boolean {
    return this._state !== 'idle';
  }

  // ==========================================================================
  // Processing
  // ==========================================================================

  /**
   * Process a workout sample through the state machine.
   *
   * @param sample - The workout sample to process
   * @returns RepBoundary if a rep was completed, null otherwise
   */
  processSample(sample: WorkoutSample): RepBoundary | null {
    const phase = sample.phase;
    let completedRep: RepBoundary | null = null;

    switch (this._state) {
      case 'idle':
        // Start of rep: entering concentric phase
        if (phase === MovementPhase.CONCENTRIC) {
          this._state = 'concentric';
          this._currentRepSamples = [sample];
          this._concentricSamples = [sample];
          this._eccentricSamples = [];
          this._holdAtTopSamples = [];
          this._holdAtBottomSamples = [];
          this._repStartTime = sample.timestamp;
        }
        break;

      case 'concentric':
        if (phase === MovementPhase.HOLD) {
          this._state = 'hold';
          this._currentRepSamples.push(sample);
          this._holdAtTopSamples = [sample];
        } else if (phase === MovementPhase.ECCENTRIC) {
          this._state = 'eccentric';
          this._currentRepSamples.push(sample);
          this._eccentricSamples = [sample];
        } else if (phase === MovementPhase.CONCENTRIC) {
          // Still in concentric, keep collecting
          this._currentRepSamples.push(sample);
          this._concentricSamples.push(sample);
        }
        // If we go back to idle without eccentric, abandon the rep
        else if (phase === MovementPhase.IDLE) {
          this.abandonRep();
        }
        break;

      case 'hold':
        this._currentRepSamples.push(sample);
        if (phase === MovementPhase.ECCENTRIC) {
          this._state = 'eccentric';
          this._eccentricSamples = [sample];
        }
        // Can go back to concentric (user starts pulling again)
        else if (phase === MovementPhase.CONCENTRIC) {
          this._state = 'concentric';
          this._concentricSamples.push(sample);
        } else if (phase === MovementPhase.HOLD) {
          // Still holding
          this._holdAtTopSamples.push(sample);
        }
        break;

      case 'eccentric':
        this._currentRepSamples.push(sample);
        // Rep complete: eccentric ends
        if (phase === MovementPhase.IDLE) {
          completedRep = this.completeRep(sample.timestamp);
          this._state = 'idle';
        }
        // Can continue holding at bottom briefly
        else if (phase === MovementPhase.HOLD) {
          this._holdAtBottomSamples.push(sample);
        } else if (phase === MovementPhase.ECCENTRIC) {
          // Still in eccentric, keep collecting
          this._eccentricSamples.push(sample);
        }
        break;
    }

    return completedRep;
  }

  /**
   * Force completion of current rep (e.g., when device sends rep boundary signal).
   * Only completes if in eccentric phase (full rep).
   *
   * @returns RepBoundary if rep was completed, null if not in valid state
   */
  forceComplete(): RepBoundary | null {
    if (this._state === 'eccentric' && this._currentRepSamples.length > 0) {
      const lastSample = this._currentRepSamples[this._currentRepSamples.length - 1];
      const completedRep = this.completeRep(lastSample.timestamp);
      this._state = 'idle';
      return completedRep;
    }
    return null;
  }

  /**
   * Reset the detector state.
   */
  reset(): void {
    this._state = 'idle';
    this._repCount = 0;
    this._currentRepSamples = [];
    this._concentricSamples = [];
    this._eccentricSamples = [];
    this._holdAtTopSamples = [];
    this._holdAtBottomSamples = [];
    this._repStartTime = null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private completeRep(endTime: number): RepBoundary {
    this._repCount++;

    const boundary: RepBoundary = {
      repNumber: this._repCount,
      samples: [...this._currentRepSamples],
      phaseSamples: {
        concentric: [...this._concentricSamples],
        eccentric: [...this._eccentricSamples],
        holdAtTop: [...this._holdAtTopSamples],
        holdAtBottom: [...this._holdAtBottomSamples],
      },
      startTime: this._repStartTime ?? endTime,
      endTime,
    };

    // Clear tracking
    this._currentRepSamples = [];
    this._concentricSamples = [];
    this._eccentricSamples = [];
    this._holdAtTopSamples = [];
    this._holdAtBottomSamples = [];
    this._repStartTime = null;

    return boundary;
  }

  private abandonRep(): void {
    this._state = 'idle';
    this._currentRepSamples = [];
    this._concentricSamples = [];
    this._eccentricSamples = [];
    this._holdAtTopSamples = [];
    this._holdAtBottomSamples = [];
    this._repStartTime = null;
  }
}
