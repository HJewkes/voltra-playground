/**
 * Rep Builder
 *
 * Fluent builder for creating Rep objects with target-seeking physics.
 *
 * @example
 * // Default normal rep
 * repBuilder().build()
 *
 * // Fatiguing rep
 * repBuilder().fatiguing().build()
 *
 * // Rep with explicit targets
 * repBuilder()
 *   .total({ duration: 2.5 })
 *   .repNumber(3)
 *   .build()
 *
 * // Behavior with override
 * repBuilder()
 *   .fatiguing()
 *   .concentric({ meanVelocity: 0.35 })
 *   .build()
 */

import type { WorkoutSample } from '@voltras/workout-analytics';
import {
  generateRepFromTargets,
  deepMerge,
  type PhysicsConfig,
  type GeneratedRep,
} from './physics-engine';

// =============================================================================
// Phase-Level Types
// =============================================================================

/**
 * Target metrics for a single phase (concentric, eccentric, or total).
 * All fields optional - unspecified values are derived from defaults or other targets.
 */
export interface PhaseTargets {
  /** Duration in seconds */
  duration?: number;
  /** Average velocity during phase (m/s) */
  meanVelocity?: number;
  /** Maximum velocity during phase (m/s) */
  peakVelocity?: number;
  /** Average force during phase (lbs) */
  meanForce?: number;
  /** Maximum force during phase (lbs) */
  peakForce?: number;
}

// =============================================================================
// Rep-Level Types
// =============================================================================

/**
 * Target metrics for a single rep.
 */
export interface RepTargets {
  /** Concentric phase targets */
  concentric?: PhaseTargets;
  /** Eccentric phase targets (null/undefined for failed reps) */
  eccentric?: PhaseTargets;
  /** Hold phase targets */
  hold?: {
    /** Hold at top duration (seconds) */
    top?: number;
    /** Hold at bottom duration (seconds) */
    bottom?: number;
  };
  /** Overall targets (physics derives phase split using default ratios) */
  total?: PhaseTargets;
  /** Range of motion (0-1), default 1.0 */
  rangeOfMotion?: number;
  /** Rep number in sequence */
  repNumber?: number;
}

// =============================================================================
// Rep Behavior Enum and Presets
// =============================================================================

/**
 * Rep behavior types that model distinct physical phenomena.
 */
export enum RepBehavior {
  Explosive = 'explosive',
  Normal = 'normal',
  Fatiguing = 'fatiguing',
  Grinding = 'grinding',
  Failed = 'failed',
  Partial = 'partial',
}

/**
 * Preset target values for each rep behavior.
 * These define the characteristic velocity, duration, and force profiles.
 */
export const BEHAVIOR_PRESETS: Record<RepBehavior, RepTargets> = {
  [RepBehavior.Explosive]: {
    concentric: { duration: 0.65, meanVelocity: 0.75, peakVelocity: 0.95, peakForce: 120 },
    eccentric: { duration: 1.2, meanVelocity: 0.38, peakVelocity: 0.48 },
    hold: { top: 0.1 },
  },
  [RepBehavior.Normal]: {
    concentric: { duration: 0.8, meanVelocity: 0.55, peakVelocity: 0.7, peakForce: 100 },
    eccentric: { duration: 1.5, meanVelocity: 0.35, peakVelocity: 0.45 },
    hold: { top: 0.15 },
  },
  [RepBehavior.Fatiguing]: {
    concentric: { duration: 1.0, meanVelocity: 0.4, peakVelocity: 0.5, peakForce: 95 },
    eccentric: { duration: 1.3, meanVelocity: 0.3, peakVelocity: 0.4 },
    hold: { top: 0.1 },
  },
  [RepBehavior.Grinding]: {
    concentric: { duration: 1.4, meanVelocity: 0.22, peakVelocity: 0.3, peakForce: 90 },
    eccentric: { duration: 1.2, meanVelocity: 0.21, peakVelocity: 0.28 },
    hold: { top: 0.05 },
  },
  [RepBehavior.Failed]: {
    concentric: { duration: 0.8, meanVelocity: 0.15, peakVelocity: 0.2, peakForce: 85 },
    // No eccentric - failed to complete lift
    eccentric: undefined,
    rangeOfMotion: 0.4,
  },
  [RepBehavior.Partial]: {
    concentric: { duration: 0.7, meanVelocity: 0.45, peakVelocity: 0.6, peakForce: 100 },
    eccentric: { duration: 1.2, meanVelocity: 0.3, peakVelocity: 0.4 },
    rangeOfMotion: 0.75,
  },
};

// =============================================================================
// Builder Class
// =============================================================================

/**
 * Builder class for creating Rep objects.
 */
class RepBuilder {
  private targets: RepTargets = {};
  private _behavior?: RepBehavior;
  private config: Partial<PhysicsConfig> = {};

  // ===========================================================================
  // Behavior Selection
  // ===========================================================================

  /** Set explosive behavior (high velocity, quick concentric). */
  explosive(): this {
    this._behavior = RepBehavior.Explosive;
    return this;
  }

  /** Set normal behavior (moderate velocity, standard timing). */
  normal(): this {
    this._behavior = RepBehavior.Normal;
    return this;
  }

  /** Set fatiguing behavior (slower velocity, eccentric speeds up). */
  fatiguing(): this {
    this._behavior = RepBehavior.Fatiguing;
    return this;
  }

  /** Set grinding behavior (very slow, sticking point). */
  grinding(): this {
    this._behavior = RepBehavior.Grinding;
    return this;
  }

  /** Set failed behavior (no eccentric, partial ROM). */
  failed(): this {
    this._behavior = RepBehavior.Failed;
    return this;
  }

  /** Set partial behavior (reduced ROM). */
  partial(): this {
    this._behavior = RepBehavior.Partial;
    return this;
  }

  /** Set behavior from enum value. */
  behavior(b: RepBehavior): this {
    this._behavior = b;
    return this;
  }

  // ===========================================================================
  // Phase Targets
  // ===========================================================================

  /** Set concentric phase targets. */
  concentric(targets: PhaseTargets): this {
    this.targets.concentric = { ...this.targets.concentric, ...targets };
    return this;
  }

  /** Set eccentric phase targets. Pass null for failed reps (no eccentric phase). */
  eccentric(targets: PhaseTargets | null): this {
    if (targets === null) {
      this.targets.eccentric = undefined;
    } else {
      this.targets.eccentric = { ...this.targets.eccentric, ...targets };
    }
    return this;
  }

  /** Set hold phase targets. */
  hold(targets: { top?: number; bottom?: number }): this {
    this.targets.hold = { ...this.targets.hold, ...targets };
    return this;
  }

  /** Set total (overall) targets. Physics derives phase split using default ratios. */
  total(targets: PhaseTargets): this {
    this.targets.total = { ...this.targets.total, ...targets };
    return this;
  }

  // ===========================================================================
  // Other Properties
  // ===========================================================================

  /** Set range of motion (0-1). */
  rangeOfMotion(rom: number): this {
    this.targets.rangeOfMotion = rom;
    return this;
  }

  /** Set rep number in sequence. */
  repNumber(n: number): this {
    this.targets.repNumber = n;
    return this;
  }

  // ===========================================================================
  // Physics Config
  // ===========================================================================

  /** Set weight (affects force calculations). */
  weight(w: number): this {
    this.config.weight = w;
    return this;
  }

  /** Set starting timestamp. */
  startTime(t: number): this {
    this.config.startTime = t;
    return this;
  }

  /** Set starting sequence number. */
  startSequence(s: number): this {
    this.config.startSequence = s;
    return this;
  }

  /** Set sample rate in Hz. */
  sampleRate(rate: number): this {
    this.config.sampleRate = rate;
    return this;
  }

  // ===========================================================================
  // Build Methods
  // ===========================================================================

  /** Build samples for a rep. Returns just the samples array. */
  build(): WorkoutSample[] {
    return this.buildWithSamples().samples;
  }

  /** Build samples with timing metadata. */
  buildWithSamples(): GeneratedRep {
    // Merge behavior preset with explicit targets
    let finalTargets = this.targets;
    if (this._behavior) {
      const preset = BEHAVIOR_PRESETS[this._behavior];
      finalTargets = deepMerge({}, preset, this.targets) as RepTargets;
    }

    return generateRepFromTargets(finalTargets, this.config);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new RepBuilder.
 *
 * @example
 * // Default normal rep
 * const rep = repBuilder().build();
 *
 * // Fatiguing rep with specific duration
 * const rep = repBuilder()
 *   .fatiguing()
 *   .total({ duration: 2.5 })
 *   .build();
 */
export function repBuilder(): RepBuilder {
  return new RepBuilder();
}

// Export the class type for advanced use cases
export type { RepBuilder };

// Re-export GeneratedRep for convenience
export type { GeneratedRep };
