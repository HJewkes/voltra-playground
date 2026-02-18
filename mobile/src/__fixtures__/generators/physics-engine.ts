/**
 * Target-Seeking Physics Engine
 *
 * Generates WorkoutSample arrays that produce specific metrics when
 * fed through the @voltras/workout-analytics pipeline.
 *
 * Key insight: We control the sample curve shape to achieve target mean/peak values.
 * - Duration → number of samples at sample rate
 * - Peak velocity → max velocity in the curve
 * - Mean velocity → achieved by shaping the curve (bell curve, plateau, etc.)
 */

import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';

// =============================================================================
// Types (internal to physics engine)
// =============================================================================

export interface PhaseTargets {
  duration?: number;
  meanVelocity?: number;
  peakVelocity?: number;
  meanForce?: number;
  peakForce?: number;
}

export interface RepTargets {
  concentric?: PhaseTargets;
  eccentric?: PhaseTargets;
  hold?: { top?: number; bottom?: number };
  total?: PhaseTargets;
  rangeOfMotion?: number;
  repNumber?: number;
}

export interface ResolvedRepTargets {
  concentric: Required<PhaseTargets>;
  eccentric: Required<PhaseTargets> | null;
  hold: { top: number; bottom: number };
  rangeOfMotion: number;
  repNumber: number;
}

/**
 * Result from generating a rep with physics.
 * Returns raw samples -- consumers feed these to the library pipeline.
 */
export interface GeneratedRep {
  samples: WorkoutSample[];
  endTime: number;
  endSequence: number;
}

export interface GeneratedPhase {
  samples: WorkoutSample[];
  endTime: number;
  endSequence: number;
}

export interface PhysicsConfig {
  sampleRate: number;
  startTime: number;
  startSequence: number;
  weight: number;
}

// =============================================================================
// Configuration
// =============================================================================

const BEHAVIOR_PRESETS_INTERNAL: Record<string, RepTargets> = {
  normal: {
    concentric: { duration: 0.8, meanVelocity: 0.55, peakVelocity: 0.7, peakForce: 100 },
    eccentric: { duration: 1.5, meanVelocity: 0.35, peakVelocity: 0.45 },
    hold: { top: 0.15 },
  },
};

const DEFAULT_CONFIG: PhysicsConfig = {
  sampleRate: 11,
  startTime: Date.now(),
  startSequence: 0,
  weight: 100,
};

const DEFAULT_PHASE_TARGETS: Required<PhaseTargets> = {
  duration: 0.8,
  meanVelocity: 0.55,
  peakVelocity: 0.7,
  meanForce: 150,
  peakForce: 100,
};

const CONCENTRIC_TO_TOTAL_RATIO = 0.35;
const ECCENTRIC_VELOCITY_RATIO = 0.65;
const MEAN_TO_PEAK_RATIO = 0.78;

// =============================================================================
// Sample Construction Helper
// =============================================================================

function makeSample(
  sequence: number,
  timestamp: number,
  phase: MovementPhase,
  position: number,
  velocity: number,
  force: number
): WorkoutSample {
  return { sequence, timestamp, phase, position, velocity, force };
}

// =============================================================================
// Velocity Curve Generation
// =============================================================================

export function generateVelocityCurve(
  duration: number,
  targetMean: number,
  targetPeak: number,
  sampleRate: number
): number[] {
  const numSamples = Math.max(2, Math.round(duration * sampleRate));
  const meanPeakRatio = targetMean / targetPeak;

  if (meanPeakRatio < 0.6) {
    return generateSpikyCurve(numSamples, targetMean, targetPeak);
  } else if (meanPeakRatio > 0.85) {
    return generatePlateauCurve(numSamples, targetMean, targetPeak);
  } else {
    return generateBellCurve(numSamples, targetMean, targetPeak);
  }
}

export function generateBellCurve(
  numSamples: number,
  targetMean: number,
  targetPeak: number
): number[] {
  let power = 1.0;
  let velocities = computeBellSamples(numSamples, targetPeak, power);
  let actualMean = average(velocities);

  for (let i = 0; i < 15; i++) {
    if (Math.abs(actualMean - targetMean) < 0.005) break;

    if (actualMean < targetMean) {
      power *= 0.8;
    } else {
      power *= 1.2;
    }
    power = Math.max(0.1, Math.min(3, power));

    velocities = computeBellSamples(numSamples, targetPeak, power);
    actualMean = average(velocities);
  }

  return velocities;
}

function computeBellSamples(numSamples: number, peak: number, power: number): number[] {
  return Array.from({ length: numSamples }, (_, i) => {
    const t = (i + 0.5) / numSamples;
    return peak * Math.pow(Math.sin(Math.PI * t), power);
  });
}

export function generateSpikyCurve(
  numSamples: number,
  targetMean: number,
  targetPeak: number
): number[] {
  const peakPosition = 0.25;
  const peakSample = Math.floor(peakPosition * numSamples);

  const velocities: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    let velocity: number;
    if (i <= peakSample) {
      const t = i / Math.max(1, peakSample);
      velocity = targetPeak * Math.pow(t, 0.5);
    } else {
      const t = (i - peakSample) / (numSamples - peakSample - 1);
      velocity = targetPeak * Math.pow(1 - t, 2);
    }
    velocities.push(velocity);
  }

  const currentMean = average(velocities);
  if (currentMean > 0) {
    const scale = targetMean / currentMean;
    for (let i = 0; i < velocities.length; i++) {
      velocities[i] *= scale;
    }
    const maxIdx = velocities.indexOf(Math.max(...velocities));
    velocities[maxIdx] = targetPeak;
  }

  return velocities;
}

export function generatePlateauCurve(
  numSamples: number,
  targetMean: number,
  targetPeak: number
): number[] {
  const rampSamples = Math.floor(numSamples * 0.15);
  const velocities: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    let velocity: number;
    if (i < rampSamples) {
      const t = i / Math.max(1, rampSamples);
      velocity = targetPeak * t;
    } else if (i >= numSamples - rampSamples) {
      const t = (numSamples - i - 1) / Math.max(1, rampSamples);
      velocity = targetPeak * t;
    } else {
      velocity = targetPeak;
    }
    velocities.push(velocity);
  }

  const currentMean = average(velocities);
  if (currentMean > 0) {
    const scale = targetMean / currentMean;
    for (let i = 0; i < velocities.length; i++) {
      velocities[i] *= scale;
    }
  }

  return velocities;
}

// =============================================================================
// Phase Sample Generation
// =============================================================================

export function generatePhaseSamples(
  phaseType: MovementPhase,
  targets: Required<PhaseTargets>,
  config: PhysicsConfig
): GeneratedPhase {
  const { sampleRate, startTime, startSequence } = config;
  const { duration, meanVelocity, peakVelocity, meanForce, peakForce } = targets;

  const velocities = generateVelocityCurve(duration, meanVelocity, peakVelocity, sampleRate);
  const numSamples = velocities.length;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;

  const sampleInterval = (duration * 1000) / Math.max(1, numSamples - 1);

  for (let i = 0; i < numSamples; i++) {
    const velocity = velocities[i];

    let position: number;
    if (phaseType === MovementPhase.CONCENTRIC) {
      position = i / Math.max(1, numSamples - 1);
    } else {
      position = 1 - i / Math.max(1, numSamples - 1);
    }

    const forceProgress = i / Math.max(1, numSamples - 1);
    const forceCurve = Math.sin(Math.PI * forceProgress);
    const force = meanForce + (peakForce - meanForce) * forceCurve;

    samples.push(makeSample(sequence++, currentTime, phaseType, position, velocity, force));
    currentTime += sampleInterval;
  }

  return { samples, endTime: currentTime, endSequence: sequence };
}

export function generateHoldSamples(
  duration: number,
  position: number,
  config: PhysicsConfig
): GeneratedPhase {
  const { sampleRate, startTime, startSequence, weight } = config;

  if (duration <= 0) {
    return { samples: [], endTime: startTime, endSequence: startSequence };
  }

  const numSamples = Math.max(1, Math.round(duration * sampleRate));
  const sampleInterval = (duration * 1000) / Math.max(1, numSamples);
  const baseForce = weight * 0.5;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;

  for (let i = 0; i < numSamples; i++) {
    samples.push(makeSample(sequence++, currentTime, MovementPhase.HOLD, position, 0, baseForce));
    currentTime += sampleInterval;
  }

  return { samples, endTime: currentTime, endSequence: sequence };
}

// =============================================================================
// Target Resolution
// =============================================================================

export function resolveRepTargets(targets: RepTargets): ResolvedRepTargets {
  const base = deepMerge({}, BEHAVIOR_PRESETS_INTERNAL.normal) as RepTargets;

  if (targets.total) {
    const { concentric, eccentric } = derivePhasesFromTotal(targets.total);
    base.concentric = deepMerge(base.concentric ?? {}, concentric);
    if (targets.eccentric !== null) {
      base.eccentric = deepMerge(base.eccentric ?? {}, eccentric);
    }
  }

  if (targets.concentric) {
    base.concentric = deepMerge(base.concentric ?? {}, targets.concentric);
  }
  if (targets.eccentric === undefined && base.eccentric !== undefined) {
    // Keep base eccentric
  } else if (targets.eccentric === null) {
    base.eccentric = undefined;
  } else if (targets.eccentric) {
    base.eccentric = deepMerge(base.eccentric ?? {}, targets.eccentric);
  }

  if (targets.hold) {
    base.hold = { ...base.hold, ...targets.hold };
  }

  if (targets.rangeOfMotion !== undefined) {
    base.rangeOfMotion = targets.rangeOfMotion;
  }

  const concentric = deriveVelocities(fillPhaseDefaults(base.concentric ?? {}));
  let eccentric: Required<PhaseTargets> | null = null;
  if (base.eccentric !== undefined) {
    eccentric = deriveVelocities(fillPhaseDefaults(base.eccentric));
  }

  return {
    concentric,
    eccentric,
    hold: { top: base.hold?.top ?? 0.1, bottom: base.hold?.bottom ?? 0 },
    rangeOfMotion: base.rangeOfMotion ?? 1.0,
    repNumber: targets.repNumber ?? 1,
  };
}

export function derivePhasesFromTotal(total: PhaseTargets): {
  concentric: PhaseTargets;
  eccentric: PhaseTargets;
} {
  const concentric: PhaseTargets = {};
  const eccentric: PhaseTargets = {};

  if (total.duration !== undefined) {
    concentric.duration = total.duration * CONCENTRIC_TO_TOTAL_RATIO;
    eccentric.duration = total.duration * (1 - CONCENTRIC_TO_TOTAL_RATIO);
  }

  if (total.meanVelocity !== undefined) {
    concentric.meanVelocity = total.meanVelocity;
    eccentric.meanVelocity = total.meanVelocity * ECCENTRIC_VELOCITY_RATIO;
  }

  if (total.peakVelocity !== undefined) {
    concentric.peakVelocity = total.peakVelocity;
    eccentric.peakVelocity = total.peakVelocity * ECCENTRIC_VELOCITY_RATIO;
  }

  if (total.peakForce !== undefined) {
    concentric.peakForce = total.peakForce;
    eccentric.peakForce = total.peakForce * 0.8;
  }

  if (total.meanForce !== undefined) {
    concentric.meanForce = total.meanForce;
    eccentric.meanForce = total.meanForce * 0.8;
  }

  return { concentric, eccentric };
}

export function deriveVelocities(phase: PhaseTargets): Required<PhaseTargets> {
  const result = { ...DEFAULT_PHASE_TARGETS, ...phase };

  if (phase.meanVelocity !== undefined && phase.peakVelocity === undefined) {
    result.peakVelocity = phase.meanVelocity / MEAN_TO_PEAK_RATIO;
  } else if (phase.peakVelocity !== undefined && phase.meanVelocity === undefined) {
    result.meanVelocity = phase.peakVelocity * MEAN_TO_PEAK_RATIO;
  }

  return result;
}

function fillPhaseDefaults(phase: PhaseTargets): PhaseTargets {
  return {
    duration: phase.duration ?? DEFAULT_PHASE_TARGETS.duration,
    meanVelocity: phase.meanVelocity,
    peakVelocity: phase.peakVelocity,
    meanForce: phase.meanForce ?? DEFAULT_PHASE_TARGETS.meanForce,
    peakForce: phase.peakForce ?? DEFAULT_PHASE_TARGETS.peakForce,
  };
}

// =============================================================================
// Rep Generation
// =============================================================================

/**
 * Generate samples for a rep from targets using target-seeking physics.
 * Returns raw WorkoutSample[] -- feed these to the library's pipeline
 * (createSet/addSampleToSet/completeSet) to produce Set objects.
 */
export function generateRepFromTargets(
  targets: RepTargets,
  config: Partial<PhysicsConfig> = {}
): GeneratedRep {
  const fullConfig: PhysicsConfig = { ...DEFAULT_CONFIG, ...config };
  const resolved = resolveRepTargets(targets);

  const concentricResult = generatePhaseSamples(
    MovementPhase.CONCENTRIC,
    resolved.concentric,
    fullConfig
  );

  let currentTime = concentricResult.endTime;
  let currentSequence = concentricResult.endSequence;

  let holdTopResult: GeneratedPhase = { samples: [], endTime: currentTime, endSequence: currentSequence };
  if (resolved.hold.top > 0) {
    holdTopResult = generateHoldSamples(resolved.hold.top, resolved.rangeOfMotion, {
      ...fullConfig,
      startTime: currentTime,
      startSequence: currentSequence,
    });
    currentTime = holdTopResult.endTime;
    currentSequence = holdTopResult.endSequence;
  }

  let eccentricResult: GeneratedPhase = { samples: [], endTime: currentTime, endSequence: currentSequence };
  if (resolved.eccentric) {
    eccentricResult = generatePhaseSamples(MovementPhase.ECCENTRIC, resolved.eccentric, {
      ...fullConfig,
      startTime: currentTime,
      startSequence: currentSequence,
    });
    currentTime = eccentricResult.endTime;
    currentSequence = eccentricResult.endSequence;
  }

  const idleSample = makeSample(currentSequence++, currentTime, MovementPhase.IDLE, 0, 0, 0);
  currentTime += 1000 / fullConfig.sampleRate;

  const allSamples = [
    ...concentricResult.samples,
    ...holdTopResult.samples,
    ...eccentricResult.samples,
    idleSample,
  ];

  return { samples: allSamples, endTime: currentTime, endSequence: currentSequence };
}

// =============================================================================
// Utilities
// =============================================================================

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        target[key] = deepMerge({ ...targetValue }, sourceValue as Partial<typeof targetValue>) as T[keyof T];
      } else if (sourceValue !== undefined) {
        target[key] = sourceValue as T[keyof T];
      }
    }
  }
  return target;
}
