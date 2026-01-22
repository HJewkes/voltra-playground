/**
 * Set Composition System
 *
 * Composes rep behaviors into realistic sets. A SetComposition is an array
 * of RepBehavior types that are sequenced together to model realistic
 * fatigue progressions during a set.
 *
 * Example: toFailure = ['normal', 'normal', 'normal', 'fatiguing', 'fatiguing', 'grinding', 'grinding', 'failed']
 */

import { v4 as uuid } from 'uuid';
import {
  type WorkoutSample,
  type Set,
  type Rep,
  MovementPhase,
  createSample,
  RepDetector,
  aggregatePhase,
  aggregateRep,
  aggregateSet,
} from '@/domain/workout';
import { type RepBehavior, type RepBehaviorOptions, generateRepSamples } from './rep-behaviors';

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
  /** The processed Set object (only if processWithAggregators: true) */
  set?: Set;
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
    samples.push(createSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
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
        samples.push(createSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
        currentTime += 1000 / sampleRate;
      }
    }
  }

  // Final idle sample
  samples.push(createSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));

  // Optionally process through aggregators
  let set: Set | undefined;
  if (processWithAggregators) {
    set = processSetThroughAggregators(samples, {
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
 * Process samples through RepDetector and aggregators to produce a Set.
 */
function processSetThroughAggregators(samples: WorkoutSample[], options: ProcessSetOptions): Set {
  const { exerciseId, exerciseName, weight, startTime } = options;

  // Use RepDetector to find rep boundaries
  const detector = new RepDetector();
  const reps: Rep[] = [];

  for (const sample of samples) {
    const boundary = detector.processSample(sample);
    if (boundary) {
      // Convert boundary to Rep using aggregators
      const rep = boundaryToRep(boundary);
      reps.push(rep);
    }
  }

  // Determine end time
  const endTime = samples.length > 0 ? samples[samples.length - 1].timestamp : startTime;

  // Compute set metrics using aggregateSet (takes reps[], targetTempo, config)
  const metrics = aggregateSet(reps, null);

  // Create the full Set with metrics
  const set: Set = {
    id: uuid(),
    exerciseId,
    exerciseName,
    weight,
    reps,
    timestamp: { start: startTime, end: endTime },
    metrics,
  };

  return set;
}

/**
 * Convert a RepBoundary from RepDetector to a Rep object.
 */
function boundaryToRep(boundary: {
  repNumber: number;
  samples: WorkoutSample[];
  phaseSamples: {
    concentric: WorkoutSample[];
    eccentric: WorkoutSample[];
    holdAtTop: WorkoutSample[];
    holdAtBottom: WorkoutSample[];
  };
  startTime: number;
  endTime: number;
}): Rep {
  // Aggregate phases
  const concentric = aggregatePhase(MovementPhase.CONCENTRIC, boundary.phaseSamples.concentric);
  const eccentric = aggregatePhase(MovementPhase.ECCENTRIC, boundary.phaseSamples.eccentric);
  const holdAtTop =
    boundary.phaseSamples.holdAtTop.length > 0
      ? aggregatePhase(MovementPhase.HOLD, boundary.phaseSamples.holdAtTop)
      : null;
  const holdAtBottom =
    boundary.phaseSamples.holdAtBottom.length > 0
      ? aggregatePhase(MovementPhase.HOLD, boundary.phaseSamples.holdAtBottom)
      : null;

  // Aggregate rep
  return aggregateRep(boundary.repNumber, concentric, eccentric, holdAtTop, holdAtBottom);
}
