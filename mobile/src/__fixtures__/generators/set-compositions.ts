/**
 * Set Composition System
 *
 * Composes rep behaviors into realistic sets. A SetComposition is an array
 * of RepBehavior types that are sequenced together to model realistic
 * fatigue progressions during a set.
 *
 * Example: toFailure = ['normal', 'normal', 'normal', 'fatiguing', 'fatiguing', 'grinding', 'grinding', 'failed']
 */

import {
  type WorkoutSample,
  MovementPhase,
  createSet,
  addSampleToSet,
  completeSet,
} from '@voltras/workout-analytics';
import { createCompletedSet, type CompletedSet } from '@/domain/workout';
import { type RepBehavior, type RepBehaviorOptions, generateRepSamples } from './rep-behaviors';

function makeSample(
  sequence: number, timestamp: number, phase: MovementPhase,
  position: number, velocity: number, force: number
): WorkoutSample {
  return { sequence, timestamp, phase, position, velocity, force };
}

// =============================================================================
// Types
// =============================================================================

/**
 * A set composition is an array of rep behaviors.
 */
export type SetComposition = RepBehavior[];

/**
 * Options for generating a set from behaviors.
 */
export interface GenerateSetOptions {
  /** Weight in lbs */
  weight?: number;
  /** Exercise ID */
  exerciseId?: string;
  /** Exercise name */
  exerciseName?: string;
  /** Process samples through aggregators to produce Set object */
  processWithAggregators?: boolean;
  /** Starting timestamp */
  startTime?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
}

/**
 * Result of generating a set from behaviors.
 */
export interface SetFromBehaviorsResult {
  /** All samples from the set */
  samples: WorkoutSample[];
  /** The processed CompletedSet object (only if processWithAggregators: true) */
  set?: CompletedSet;
  /** Number of completed reps (failed reps don't count) */
  completedRepCount: number;
  /** The rep behaviors that were used */
  behaviors: RepBehavior[];
}

// =============================================================================
// Set Presets
// =============================================================================

/**
 * Named presets for common set compositions.
 */
export const setPresets = {
  /** Easy warmup set - 5 explosive reps */
  warmupEasy: ['explosive', 'explosive', 'explosive', 'explosive', 'explosive'] as RepBehavior[],

  /** Productive working set - starts normal, ends with grinding */
  productiveWorking: [
    'normal',
    'normal',
    'normal',
    'fatiguing',
    'fatiguing',
    'fatiguing',
    'grinding',
  ] as RepBehavior[],

  /** Set taken to failure - full progression ending with failed rep */
  toFailure: [
    'normal',
    'normal',
    'normal',
    'fatiguing',
    'fatiguing',
    'grinding',
    'grinding',
    'failed',
  ] as RepBehavior[],

  /** Junk volume - already fatigued, push through failure */
  junkVolume: ['grinding', 'grinding', 'grinding', 'failed'] as RepBehavior[],

  /** Too heavy - weight was too ambitious */
  tooHeavy: ['grinding', 'failed'] as RepBehavior[],

  /** Too light - weight was too easy */
  tooLight: [
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
    'explosive',
  ] as RepBehavior[],

  /** Moderate warmup - lighter than working sets */
  warmupModerate: ['normal', 'normal', 'normal', 'normal', 'normal'] as RepBehavior[],

  /** Short working set - 5 reps */
  shortWorking: ['normal', 'normal', 'fatiguing', 'fatiguing', 'grinding'] as RepBehavior[],

  /** Strength set - low reps, heavy */
  strengthSet: ['fatiguing', 'grinding', 'grinding'] as RepBehavior[],
} as const;

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate samples for an entire set from a composition of rep behaviors.
 *
 * @param behaviors - Array of rep behaviors to generate
 * @param options - Configuration options
 * @returns Samples and optionally the processed Set object
 */
export function generateSetFromBehaviors(
  behaviors: SetComposition,
  options: GenerateSetOptions = {}
): SetFromBehaviorsResult {
  const {
    weight = 100,
    exerciseId = 'test_exercise',
    exerciseName = 'Test Exercise',
    processWithAggregators = false,
    startTime = Date.now(),
    sampleRate = 11,
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let currentSequence = 0;
  let completedRepCount = 0;

  // Add initial idle samples
  const idleDuration = 300; // ms
  const idleSamples = Math.floor((idleDuration / 1000) * sampleRate);
  for (let i = 0; i < idleSamples; i++) {
    samples.push(makeSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
    currentTime += 1000 / sampleRate;
  }

  // Generate samples for each rep behavior
  for (const behavior of behaviors) {
    const repOptions: RepBehaviorOptions = {
      weight,
      startTime: currentTime,
      startSequence: currentSequence,
      sampleRate,
    };

    const result = generateRepSamples(behavior, repOptions);
    samples.push(...result.samples);
    currentTime = result.endTime;
    currentSequence = result.endSequence;

    // Count completed reps (failed reps don't complete)
    if (behavior !== 'failed') {
      completedRepCount++;
    }

    // Add brief rest between reps (except after failed)
    if (behavior !== 'failed') {
      const restDuration = 400; // ms
      const restSamples = Math.floor((restDuration / 1000) * sampleRate);
      for (let i = 0; i < restSamples; i++) {
        samples.push(makeSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
        currentTime += 1000 / sampleRate;
      }
    }
  }

  // Final idle sample
  samples.push(makeSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));

  // Optionally process through library pipeline
  let set: CompletedSet | undefined;
  if (processWithAggregators) {
    set = processSetThroughPipeline(samples, {
      exerciseId,
      exerciseName,
      weight,
      startTime,
    });
  }

  return {
    samples,
    set,
    completedRepCount,
    behaviors: [...behaviors],
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Convenience functions for generating sets from presets.
 */
export const sets = {
  warmupEasy: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.warmupEasy, { ...options, weight }),

  warmupModerate: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.warmupModerate, { ...options, weight }),

  productiveWorking: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.productiveWorking, { ...options, weight }),

  toFailure: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.toFailure, { ...options, weight }),

  junkVolume: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.junkVolume, { ...options, weight }),

  tooHeavy: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.tooHeavy, { ...options, weight }),

  tooLight: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.tooLight, { ...options, weight }),

  shortWorking: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.shortWorking, { ...options, weight }),

  strengthSet: (weight: number, options?: Omit<GenerateSetOptions, 'weight'>) =>
    generateSetFromBehaviors(setPresets.strengthSet, { ...options, weight }),
};

// =============================================================================
// Processing
// =============================================================================

interface ProcessSetOptions {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  startTime: number;
}

/**
 * Process samples through the library's set pipeline to produce a CompletedSet.
 */
function processSetThroughPipeline(samples: WorkoutSample[], options: ProcessSetOptions): CompletedSet {
  const { exerciseId, exerciseName, weight, startTime } = options;

  let analyticsSet = createSet();
  for (const sample of samples) {
    analyticsSet = addSampleToSet(analyticsSet, sample);
  }
  analyticsSet = completeSet(analyticsSet);

  const endTime = samples.length > 0 ? samples[samples.length - 1].timestamp : startTime;

  return createCompletedSet(analyticsSet, {
    exerciseId,
    exerciseName,
    weight,
    startTime,
    endTime,
  });
}
