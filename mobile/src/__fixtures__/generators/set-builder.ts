/**
 * Set Builder
 *
 * Fluent builder for creating CompletedSet objects using the
 * @voltras/workout-analytics pipeline.
 *
 * @example
 * // 8 normal reps at 100 lbs
 * setBuilder().weight(100).repCount(8).build()
 *
 * // Productive working set preset
 * setBuilder().weight(185).productiveWorking().build()
 */

import {
  createSet,
  addSampleToSet,
  completeSet,
  type WorkoutSample,
} from '@voltras/workout-analytics';
import { createCompletedSet, type CompletedSet } from '@/domain/workout';
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

export interface SetTargets {
  id?: string;
  weight?: number;
  exerciseId?: string;
  exerciseName?: string;

  repCount?: number;
  rep?: RepTargets;
  reps?: RepTargets[];
  composition?: RepBehavior[];

  velocity?: {
    concentricBaseline?: number;
    eccentricBaseline?: number;
    concentricLast?: number;
    eccentricLast?: number;
    concentricDelta?: number;
    eccentricDelta?: number;
  };

  totalDuration?: number;
  timeUnderTension?: number;
  timestamp?: { start: number; end: number };
}

// =============================================================================
// Set Presets
// =============================================================================

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

  id(id: string): this {
    this.targets.id = id;
    return this;
  }

  weight(w: number): this {
    this.targets.weight = w;
    this.config.weight = w;
    return this;
  }

  exerciseId(id: string): this {
    this.targets.exerciseId = id;
    return this;
  }

  exerciseName(name: string): this {
    this.targets.exerciseName = name;
    return this;
  }

  repCount(n: number): this {
    this.targets.repCount = n;
    return this;
  }

  rep(targets: RepTargets): this {
    this.targets.rep = targets;
    return this;
  }

  reps(targets: RepTargets[]): this {
    this.targets.reps = targets;
    return this;
  }

  composition(behaviors: RepBehavior[]): this {
    this.targets.composition = behaviors;
    return this;
  }

  warmupEasy(): this { this.preset = 'warmupEasy'; return this; }
  warmupModerate(): this { this.preset = 'warmupModerate'; return this; }
  productiveWorking(): this { this.preset = 'productiveWorking'; return this; }
  toFailure(): this { this.preset = 'toFailure'; return this; }
  strengthSet(): this { this.preset = 'strengthSet'; return this; }
  shortWorking(): this { this.preset = 'shortWorking'; return this; }
  junkVolume(): this { this.preset = 'junkVolume'; return this; }
  tooHeavy(): this { this.preset = 'tooHeavy'; return this; }
  tooLight(): this { this.preset = 'tooLight'; return this; }

  velocity(targets: SetTargets['velocity']): this {
    this.targets.velocity = targets;
    return this;
  }

  totalDuration(d: number): this {
    this.targets.totalDuration = d;
    return this;
  }

  timeUnderTension(t: number): this {
    this.targets.timeUnderTension = t;
    return this;
  }

  timestamp(ts: { start: number; end: number }): this {
    this.targets.timestamp = ts;
    return this;
  }

  /** Build a CompletedSet by feeding samples through the library pipeline. */
  build(): CompletedSet {
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
      composition = [...SET_PRESETS.productiveWorking];
    }

    return this.buildFromComposition(composition);
  }

  private buildFromComposition(composition: RepBehavior[], baseRepTargets?: RepTargets): CompletedSet {
    const allSamples: WorkoutSample[] = [];
    let currentTime = this.targets.timestamp?.start ?? Date.now();
    let currentSequence = 0;

    for (let i = 0; i < composition.length; i++) {
      const behavior = composition[i];

      const repTargets: RepTargets = {
        ...baseRepTargets,
        repNumber: i + 1,
      };

      if (this.targets.velocity?.concentricBaseline && i === 0) {
        repTargets.concentric = {
          ...repTargets.concentric,
          meanVelocity: this.targets.velocity.concentricBaseline,
        };
      }

      let finalTargets = repTargets;
      if (baseRepTargets) {
        finalTargets = deepMerge({}, BEHAVIOR_PRESETS[behavior], repTargets) as RepTargets;
      }

      const generated = repBuilder()
        .behavior(behavior)
        .repNumber(i + 1)
        .startTime(currentTime)
        .startSequence(currentSequence)
        .weight(this.targets.weight ?? 100)
        .buildWithSamples();

      allSamples.push(...generated.samples);
      currentTime = generated.endTime + 500;
      currentSequence = generated.endSequence + 1;
    }

    return this.assembleCompletedSet(allSamples);
  }

  private buildFromRepTargets(repTargets: RepTargets[]): CompletedSet {
    const allSamples: WorkoutSample[] = [];
    let currentTime = this.targets.timestamp?.start ?? Date.now();
    let currentSequence = 0;

    for (let i = 0; i < repTargets.length; i++) {
      const targets = repTargets[i];

      const builder = repBuilder()
        .repNumber(i + 1)
        .startTime(currentTime)
        .startSequence(currentSequence)
        .weight(this.targets.weight ?? 100);

      if (targets.concentric) builder.concentric(targets.concentric);
      if (targets.eccentric) builder.eccentric(targets.eccentric);
      if (targets.hold) builder.hold(targets.hold);
      if (targets.total) builder.total(targets.total);
      if (targets.rangeOfMotion !== undefined) builder.rangeOfMotion(targets.rangeOfMotion);

      const generated = builder.buildWithSamples();
      allSamples.push(...generated.samples);
      currentTime = generated.endTime + 500;
      currentSequence = generated.endSequence + 1;
    }

    return this.assembleCompletedSet(allSamples);
  }

  private assembleCompletedSet(samples: WorkoutSample[]): CompletedSet {
    let analyticsSet = createSet();
    for (const sample of samples) {
      analyticsSet = addSampleToSet(analyticsSet, sample);
    }
    analyticsSet = completeSet(analyticsSet);

    const startTime = this.targets.timestamp?.start ?? (samples[0]?.timestamp ?? Date.now());
    const endTime = this.targets.timestamp?.end ?? (samples[samples.length - 1]?.timestamp ?? Date.now());

    return createCompletedSet(analyticsSet, {
      exerciseId: this.targets.exerciseId ?? 'test_exercise',
      exerciseName: this.targets.exerciseName ?? 'Test Exercise',
      weight: this.targets.weight ?? 100,
      startTime,
      endTime,
      id: this.targets.id,
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function setBuilder(): SetBuilder {
  return new SetBuilder();
}

export type { SetBuilder };
export { RepBehavior };
