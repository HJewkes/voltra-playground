/**
 * Set Builder
 *
 * Fluent builder for creating Set objects with physics-based reps.
 *
 * @example
 * // 8 normal reps at 100 lbs
 * setBuilder().weight(100).repCount(8).build()
 *
 * // Productive working set preset
 * setBuilder().weight(185).productiveWorking().build()
 *
 * // Custom composition
 * setBuilder()
 *   .weight(100)
 *   .composition([RepBehavior.Normal, RepBehavior.Fatiguing, RepBehavior.Grinding])
 *   .build()
 *
 * // Per-rep targets
 * setBuilder()
 *   .weight(100)
 *   .reps([
 *     { total: { duration: 2.0 } },
 *     { total: { duration: 2.5 } },
 *     { total: { duration: 3.0 } },
 *   ])
 *   .build()
 */

import type { Set } from '@/domain/workout/models/set';
import type { Rep } from '@/domain/workout/models/rep';
import { aggregateSet } from '@/domain/workout/aggregators/set-aggregator';
import {
  repBuilder,
  type RepTargets,
  RepBehavior,
  BEHAVIOR_PRESETS,
} from './rep-builder';
import { deepMerge, type PhysicsConfig } from './physics-engine';

// =============================================================================
// Set-Level Types
// =============================================================================

/**
 * Target configuration for a set.
 */
export interface SetTargets {
  /** Set ID (auto-generated if not provided) */
  id?: string;
  /** Weight in lbs */
  weight?: number;
  /** Exercise ID */
  exerciseId?: string;
  /** Exercise name */
  exerciseName?: string;

  // Rep generation (pick one approach)
  /** Generate N reps with normal behavior (or with `rep` targets) */
  repCount?: number;
  /** Targets for all reps (used with repCount) */
  rep?: RepTargets;
  /** Per-rep targets (explicit control) */
  reps?: RepTargets[];
  /** Behavior sequence */
  composition?: RepBehavior[];

  // Set-level metric targets
  /** Velocity targeting */
  velocity?: {
    concentricBaseline?: number;
    eccentricBaseline?: number;
    concentricLast?: number;
    eccentricLast?: number;
    concentricDelta?: number;
    eccentricDelta?: number;
  };

  // Timing
  totalDuration?: number;
  timeUnderTension?: number;

  /** Timestamp (auto-generated if not provided) */
  timestamp?: { start: number; end: number };
}

// =============================================================================
// Set Presets
// =============================================================================

/**
 * Preset compositions for common set patterns.
 */
export const SET_PRESETS = {
  warmupEasy: [
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
  ],
  warmupModerate: [
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Normal,
  ],
  productiveWorking: [
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Fatiguing,
    RepBehavior.Fatiguing,
    RepBehavior.Fatiguing,
    RepBehavior.Grinding,
  ],
  toFailure: [
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Fatiguing,
    RepBehavior.Fatiguing,
    RepBehavior.Grinding,
    RepBehavior.Grinding,
    RepBehavior.Failed,
  ],
  strengthSet: [RepBehavior.Fatiguing, RepBehavior.Grinding, RepBehavior.Grinding],
  shortWorking: [
    RepBehavior.Normal,
    RepBehavior.Normal,
    RepBehavior.Fatiguing,
    RepBehavior.Fatiguing,
    RepBehavior.Grinding,
  ],
  junkVolume: [
    RepBehavior.Grinding,
    RepBehavior.Grinding,
    RepBehavior.Grinding,
    RepBehavior.Failed,
  ],
  tooHeavy: [RepBehavior.Grinding, RepBehavior.Failed],
  tooLight: [
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
    RepBehavior.Explosive,
  ],
} as const;

export type SetPreset = keyof typeof SET_PRESETS;

// =============================================================================
// Builder Class
// =============================================================================

class SetBuilder {
  private targets: SetTargets = {};
  private preset?: SetPreset;
  private config: Partial<PhysicsConfig> = {};

  // ===========================================================================
  // Basic Properties
  // ===========================================================================

  /** Set the set ID. */
  id(id: string): this {
    this.targets.id = id;
    return this;
  }

  /** Set the weight in lbs. */
  weight(w: number): this {
    this.targets.weight = w;
    this.config.weight = w;
    return this;
  }

  /** Set the exercise ID. */
  exerciseId(id: string): this {
    this.targets.exerciseId = id;
    return this;
  }

  /** Set the exercise name. */
  exerciseName(name: string): this {
    this.targets.exerciseName = name;
    return this;
  }

  // ===========================================================================
  // Rep Generation Approaches
  // ===========================================================================

  /** Generate N reps with normal behavior (or with `rep()` targets). */
  repCount(n: number): this {
    this.targets.repCount = n;
    return this;
  }

  /** Set targets for all reps (used with repCount). */
  rep(targets: RepTargets): this {
    this.targets.rep = targets;
    return this;
  }

  /** Set per-rep targets (explicit control). */
  reps(targets: RepTargets[]): this {
    this.targets.reps = targets;
    return this;
  }

  /** Set behavior sequence. */
  composition(behaviors: RepBehavior[]): this {
    this.targets.composition = behaviors;
    return this;
  }

  // ===========================================================================
  // Preset Compositions
  // ===========================================================================

  /** Warmup set with explosive reps. */
  warmupEasy(): this {
    this.preset = 'warmupEasy';
    return this;
  }

  /** Warmup set with normal reps. */
  warmupModerate(): this {
    this.preset = 'warmupModerate';
    return this;
  }

  /** Productive working set (normal → fatiguing → grinding). */
  productiveWorking(): this {
    this.preset = 'productiveWorking';
    return this;
  }

  /** Working set to failure. */
  toFailure(): this {
    this.preset = 'toFailure';
    return this;
  }

  /** Heavy strength set (few reps, high effort). */
  strengthSet(): this {
    this.preset = 'strengthSet';
    return this;
  }

  /** Shorter working set. */
  shortWorking(): this {
    this.preset = 'shortWorking';
    return this;
  }

  /** Junk volume set (grinding from start). */
  junkVolume(): this {
    this.preset = 'junkVolume';
    return this;
  }

  /** Weight too heavy (quick failure). */
  tooHeavy(): this {
    this.preset = 'tooHeavy';
    return this;
  }

  /** Weight too light (many explosive reps). */
  tooLight(): this {
    this.preset = 'tooLight';
    return this;
  }

  // ===========================================================================
  // Velocity Targeting
  // ===========================================================================

  /** Set velocity targets for the set. */
  velocity(targets: SetTargets['velocity']): this {
    this.targets.velocity = targets;
    return this;
  }

  // ===========================================================================
  // Timing
  // ===========================================================================

  /** Set total duration target. */
  totalDuration(d: number): this {
    this.targets.totalDuration = d;
    return this;
  }

  /** Set time under tension target. */
  timeUnderTension(t: number): this {
    this.targets.timeUnderTension = t;
    return this;
  }

  /** Set timestamp. */
  timestamp(ts: { start: number; end: number }): this {
    this.targets.timestamp = ts;
    return this;
  }

  // ===========================================================================
  // Build
  // ===========================================================================

  /** Build the Set object. */
  build(): Set {
    // Determine composition
    let composition: RepBehavior[];

    if (this.preset) {
      composition = [...SET_PRESETS[this.preset]];
    } else if (this.targets.composition) {
      composition = this.targets.composition;
    } else if (this.targets.reps) {
      return this.buildFromRepTargets(this.targets.reps);
    } else if (this.targets.repCount) {
      const repTargets = this.targets.rep ?? {};
      composition = Array(this.targets.repCount).fill(RepBehavior.Normal);
      return this.buildFromComposition(composition, repTargets);
    } else {
      // Default: productiveWorking
      composition = [...SET_PRESETS.productiveWorking];
    }

    return this.buildFromComposition(composition);
  }

  private buildFromComposition(composition: RepBehavior[], baseRepTargets?: RepTargets): Set {
    const reps: Rep[] = [];
    let currentTime = this.targets.timestamp?.start ?? Date.now();
    let currentSequence = 0;

    for (let i = 0; i < composition.length; i++) {
      const behavior = composition[i];

      // Build rep targets
      const repTargets: RepTargets = {
        ...baseRepTargets,
        repNumber: i + 1,
      };

      // Apply velocity targets if specified
      if (this.targets.velocity?.concentricBaseline && i === 0) {
        repTargets.concentric = {
          ...repTargets.concentric,
          meanVelocity: this.targets.velocity.concentricBaseline,
        };
      }

      const generated = repBuilder()
        .behavior(behavior)
        .repNumber(i + 1)
        .startTime(currentTime)
        .startSequence(currentSequence)
        .weight(this.targets.weight ?? 100)
        .buildWithSamples();

      // Apply any explicit rep targets
      if (baseRepTargets) {
        // Re-generate with merged targets if needed
        const mergedTargets = deepMerge({}, BEHAVIOR_PRESETS[behavior], repTargets) as RepTargets;
        const regenerated = repBuilder()
          .concentric(mergedTargets.concentric ?? {})
          .eccentric(mergedTargets.eccentric ?? null)
          .hold(mergedTargets.hold ?? {})
          .rangeOfMotion(mergedTargets.rangeOfMotion ?? 1)
          .repNumber(i + 1)
          .startTime(currentTime)
          .startSequence(currentSequence)
          .weight(this.targets.weight ?? 100)
          .buildWithSamples();

        reps.push(regenerated.rep);
        currentTime = regenerated.endTime + 500;
        currentSequence = regenerated.endSequence + 1;
      } else {
        reps.push(generated.rep);
        currentTime = generated.endTime + 500;
        currentSequence = generated.endSequence + 1;
      }
    }

    return this.assembleSet(reps);
  }

  private buildFromRepTargets(repTargets: RepTargets[]): Set {
    const reps: Rep[] = [];
    let currentTime = this.targets.timestamp?.start ?? Date.now();
    let currentSequence = 0;

    for (let i = 0; i < repTargets.length; i++) {
      const targets = repTargets[i];

      const builder = repBuilder()
        .repNumber(i + 1)
        .startTime(currentTime)
        .startSequence(currentSequence)
        .weight(this.targets.weight ?? 100);

      // Apply targets
      if (targets.concentric) builder.concentric(targets.concentric);
      if (targets.eccentric) builder.eccentric(targets.eccentric);
      if (targets.hold) builder.hold(targets.hold);
      if (targets.total) builder.total(targets.total);
      if (targets.rangeOfMotion !== undefined) builder.rangeOfMotion(targets.rangeOfMotion);

      const generated = builder.buildWithSamples();
      reps.push(generated.rep);
      currentTime = generated.endTime + 500;
      currentSequence = generated.endSequence + 1;
    }

    return this.assembleSet(reps);
  }

  private assembleSet(reps: Rep[]): Set {
    const setMetrics = aggregateSet(reps, null);

    return {
      id: this.targets.id ?? `set_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      exerciseId: this.targets.exerciseId ?? 'test_exercise',
      exerciseName: this.targets.exerciseName ?? 'Test Exercise',
      weight: this.targets.weight ?? 100,
      reps,
      timestamp: {
        start: this.targets.timestamp?.start ?? reps[0]?.timestamp.start ?? Date.now(),
        end: this.targets.timestamp?.end ?? reps[reps.length - 1]?.timestamp.end ?? Date.now(),
      },
      metrics: setMetrics,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SetBuilder.
 *
 * @example
 * // 8 normal reps
 * const set = setBuilder().weight(100).repCount(8).build();
 *
 * // Productive working set
 * const set = setBuilder().weight(185).productiveWorking().build();
 */
export function setBuilder(): SetBuilder {
  return new SetBuilder();
}

export type { SetBuilder };

// Re-export RepBehavior for convenience
export { RepBehavior };
