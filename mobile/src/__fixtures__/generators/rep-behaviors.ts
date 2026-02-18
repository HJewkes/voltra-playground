/**
 * Rep Behavior Generators
 *
 * Physics-based generators that model specific rep behaviors at the sample level.
 * Each behavior type produces realistic WorkoutSample sequences that represent
 * distinct physical phenomena during exercise.
 *
 * Behaviors:
 * - explosive: High velocity, quick concentric, smooth curve
 * - normal: Moderate velocity, standard timing
 * - fatiguing: Slower velocity, eccentric may speed up (losing control)
 * - grinding: Very slow, long concentric, possible sticking point
 * - failed: Velocity drops to ~0 mid-concentric, no eccentric
 * - partial: Completes but with reduced range of motion
 */

import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';

function createSample(
  sequence: number, timestamp: number, phase: MovementPhase,
  position: number, velocity: number, force: number
): WorkoutSample {
  return { sequence, timestamp, phase, position, velocity, force };
}

// =============================================================================
// Types
// =============================================================================

/**
 * Rep behavior types that model distinct physical phenomena.
 */
export type RepBehavior = 'explosive' | 'normal' | 'fatiguing' | 'grinding' | 'failed' | 'partial';

/**
 * Options for generating rep samples.
 */
export interface RepBehaviorOptions {
  /** Weight in lbs (affects force calculations) */
  weight?: number;
  /** Override the default peak velocity for this behavior */
  peakVelocity?: number;
  /** Position (0-1) where sticking point occurs (for grinding/failed) */
  stickingPoint?: number;
  /** Include brief hold at top of rep */
  includeHold?: boolean;
  /** Starting timestamp for the rep */
  startTime?: number;
  /** Starting sequence number */
  startSequence?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
}

/**
 * Result of generating rep samples.
 */
export interface RepSamplesResult {
  samples: WorkoutSample[];
  endTime: number;
  endSequence: number;
}

// =============================================================================
// Physics Constants
// =============================================================================

/**
 * Physics constants for each rep behavior type.
 */
export const REP_BEHAVIOR_PHYSICS = {
  explosive: {
    peakVelocity: 0.95, // m/s - very fast
    concentricDuration: 650, // ms - quick
    eccentricDuration: 1200, // ms - controlled lowering
    eccentricVelocityRatio: 0.4, // eccentric is slower than concentric
    holdDuration: 100, // ms - brief pause
  },
  normal: {
    peakVelocity: 0.7, // m/s - moderate
    concentricDuration: 800, // ms - standard
    eccentricDuration: 1500, // ms - controlled
    eccentricVelocityRatio: 0.5,
    holdDuration: 150, // ms
  },
  fatiguing: {
    peakVelocity: 0.5, // m/s - slowing down
    concentricDuration: 1000, // ms - taking longer
    eccentricDuration: 1300, // ms - slightly faster (losing control)
    eccentricVelocityRatio: 0.6, // eccentric speeds up relative to concentric
    holdDuration: 100, // ms - shorter hold
  },
  grinding: {
    peakVelocity: 0.3, // m/s - very slow
    concentricDuration: 1400, // ms - long struggle
    eccentricDuration: 1200, // ms
    eccentricVelocityRatio: 0.7, // eccentric relatively faster (dropping)
    holdDuration: 50, // ms - minimal hold
    stickingPointPosition: 0.4, // where the grind happens
    stickingPointVelocityDip: 0.5, // velocity drops to 50% at sticking point
  },
  failed: {
    peakVelocity: 0.25, // m/s - started slow
    concentricDuration: 800, // ms - before failure
    stallDuration: 500, // ms - how long they try before giving up
    stickingPointPosition: 0.4, // where they stall
  },
  partial: {
    peakVelocity: 0.6, // m/s - moderate
    concentricDuration: 700, // ms
    eccentricDuration: 1200, // ms
    eccentricVelocityRatio: 0.5,
    holdDuration: 100, // ms
    maxPosition: 0.75, // only reaches 75% of full ROM
  },
} as const;

// =============================================================================
// Unified Entry Point
// =============================================================================

/**
 * Generate samples for a rep with specific behavior.
 *
 * @param behavior - The type of rep behavior to generate
 * @param options - Optional configuration
 * @returns Samples and metadata about the generated rep
 */
export function generateRepSamples(
  behavior: RepBehavior,
  options: RepBehaviorOptions = {}
): RepSamplesResult {
  switch (behavior) {
    case 'explosive':
      return generateExplosiveRep(options);
    case 'normal':
      return generateNormalRep(options);
    case 'fatiguing':
      return generateFatiguingRep(options);
    case 'grinding':
      return generateGrindingRep(options);
    case 'failed':
      return generateFailedRep(options);
    case 'partial':
      return generatePartialRep(options);
  }
}

// =============================================================================
// Individual Behavior Generators
// =============================================================================

/**
 * Generate an explosive rep - high velocity, quick concentric, smooth curve.
 */
export function generateExplosiveRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.explosive;
  return generateCompletedRep({
    ...options,
    peakVelocity: options.peakVelocity ?? physics.peakVelocity,
    concentricDuration: physics.concentricDuration,
    eccentricDuration: physics.eccentricDuration,
    eccentricVelocityRatio: physics.eccentricVelocityRatio,
    holdDuration: options.includeHold !== false ? physics.holdDuration : 0,
  });
}

/**
 * Generate a normal rep - moderate velocity, standard timing.
 */
export function generateNormalRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.normal;
  return generateCompletedRep({
    ...options,
    peakVelocity: options.peakVelocity ?? physics.peakVelocity,
    concentricDuration: physics.concentricDuration,
    eccentricDuration: physics.eccentricDuration,
    eccentricVelocityRatio: physics.eccentricVelocityRatio,
    holdDuration: options.includeHold !== false ? physics.holdDuration : 0,
  });
}

/**
 * Generate a fatiguing rep - slower velocity, eccentric speeds up (losing control).
 */
export function generateFatiguingRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.fatiguing;
  return generateCompletedRep({
    ...options,
    peakVelocity: options.peakVelocity ?? physics.peakVelocity,
    concentricDuration: physics.concentricDuration,
    eccentricDuration: physics.eccentricDuration,
    eccentricVelocityRatio: physics.eccentricVelocityRatio,
    holdDuration: options.includeHold !== false ? physics.holdDuration : 0,
  });
}

/**
 * Generate a grinding rep - very slow, long concentric with sticking point.
 */
export function generateGrindingRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.grinding;
  const {
    weight = 100,
    peakVelocity = physics.peakVelocity,
    stickingPoint = physics.stickingPointPosition,
    includeHold = true,
    startTime = Date.now(),
    startSequence = 0,
    sampleRate = 11,
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;
  const baseForce = weight * 1.5;

  // Concentric with sticking point
  const concentricSamples = Math.floor((physics.concentricDuration / 1000) * sampleRate);
  for (let i = 0; i < concentricSamples; i++) {
    const progress = i / concentricSamples;
    const position = progress;

    // Velocity curve with sticking point dip
    let velocityMultiplier: number;
    const distanceFromStickingPoint = Math.abs(progress - stickingPoint);
    if (distanceFromStickingPoint < 0.15) {
      // Near sticking point - velocity dips
      const dipAmount = 1 - (0.15 - distanceFromStickingPoint) / 0.15;
      velocityMultiplier =
        physics.stickingPointVelocityDip + (1 - physics.stickingPointVelocityDip) * dipAmount;
    } else {
      velocityMultiplier = 1;
    }

    const velocityCurve = Math.sin(progress * Math.PI) * peakVelocity * velocityMultiplier;
    const force = baseForce * (1 - progress * 0.3);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.CONCENTRIC,
        position,
        velocityCurve,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Brief hold (minimal for grinding)
  if (includeHold && physics.holdDuration > 0) {
    const holdSamples = Math.max(1, Math.floor((physics.holdDuration / 1000) * sampleRate));
    for (let i = 0; i < holdSamples; i++) {
      samples.push(
        createSample(sequence++, currentTime, MovementPhase.HOLD, 1, 0, baseForce * 0.5)
      );
      currentTime += 1000 / sampleRate;
    }
  }

  // Eccentric (faster than normal - losing control)
  const eccentricSamples = Math.floor((physics.eccentricDuration / 1000) * sampleRate);
  for (let i = 0; i < eccentricSamples; i++) {
    const progress = i / eccentricSamples;
    const position = 1 - progress;
    const eccentricVelocity =
      peakVelocity * physics.eccentricVelocityRatio * Math.sin(progress * Math.PI);
    const force = baseForce * 0.8 * (1 - progress * 0.2);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.ECCENTRIC,
        position,
        eccentricVelocity,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Final IDLE sample to complete the rep (triggers RepDetector completion)
  samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
  currentTime += 1000 / sampleRate;

  return { samples, endTime: currentTime, endSequence: sequence };
}

/**
 * Generate a failed rep - velocity drops to ~0 mid-concentric, no eccentric.
 *
 * Key physics:
 * 1. Starts concentric normally
 * 2. Velocity drops approaching sticking point
 * 3. Velocity reaches near-zero, position stalls
 * 4. Transitions directly to IDLE (no HOLD, no ECCENTRIC)
 */
export function generateFailedRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.failed;
  const {
    weight = 100,
    peakVelocity = physics.peakVelocity,
    stickingPoint = physics.stickingPointPosition,
    startTime = Date.now(),
    startSequence = 0,
    sampleRate = 11,
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;
  const baseForce = weight * 1.5;

  // Concentric until sticking point - velocity decreasing
  const concentricSamples = Math.floor((physics.concentricDuration / 1000) * sampleRate);
  const stickingPointSample = Math.floor(stickingPoint * concentricSamples);

  for (let i = 0; i <= stickingPointSample; i++) {
    const progress = i / concentricSamples;
    const position = progress;

    // Velocity starts normal but drops toward sticking point
    let velocity: number;
    if (i < stickingPointSample * 0.6) {
      // Early phase - relatively normal
      velocity = Math.sin(progress * Math.PI * 1.2) * peakVelocity;
    } else {
      // Approaching sticking point - velocity drops
      const dropProgress = (i - stickingPointSample * 0.6) / (stickingPointSample * 0.4);
      velocity = peakVelocity * 0.6 * (1 - dropProgress * 0.9);
    }

    const force = baseForce * (1 + (stickingPoint - progress) * 0.5); // Force increases as they struggle

    samples.push(
      createSample(sequence++, currentTime, MovementPhase.CONCENTRIC, position, velocity, force)
    );
    currentTime += 1000 / sampleRate;
  }

  // Stall at sticking point - very low velocity, position barely moving
  const stallSamples = Math.floor((physics.stallDuration / 1000) * sampleRate);
  for (let i = 0; i < stallSamples; i++) {
    const stallProgress = i / stallSamples;
    // Position barely moves, velocity near zero but still trying
    const position = stickingPoint + 0.02 * Math.sin(stallProgress * Math.PI);
    const velocity = 0.05 * (1 - stallProgress); // Velocity fades to near zero
    const force = baseForce * 1.2 * (1 - stallProgress * 0.3); // Force decreases as they give up

    samples.push(
      createSample(sequence++, currentTime, MovementPhase.CONCENTRIC, position, velocity, force)
    );
    currentTime += 1000 / sampleRate;
  }

  // Give up - transition directly to IDLE (NO HOLD, NO ECCENTRIC)
  samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));

  return { samples, endTime: currentTime, endSequence: sequence };
}

/**
 * Generate a partial rep - completes but with reduced range of motion.
 */
export function generatePartialRep(options: RepBehaviorOptions = {}): RepSamplesResult {
  const physics = REP_BEHAVIOR_PHYSICS.partial;
  const {
    weight = 100,
    peakVelocity = physics.peakVelocity,
    startTime = Date.now(),
    startSequence = 0,
    sampleRate = 11,
    includeHold = true,
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;
  const baseForce = weight * 1.5;
  const maxPosition = physics.maxPosition;

  // Concentric to partial ROM
  const concentricSamples = Math.floor((physics.concentricDuration / 1000) * sampleRate);
  for (let i = 0; i < concentricSamples; i++) {
    const progress = i / concentricSamples;
    const position = progress * maxPosition; // Only goes to 75%
    const velocityCurve = Math.sin(progress * Math.PI) * peakVelocity;
    const force = baseForce * (1 - progress * 0.3);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.CONCENTRIC,
        position,
        velocityCurve,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Hold at partial position
  if (includeHold && physics.holdDuration > 0) {
    const holdSamples = Math.max(1, Math.floor((physics.holdDuration / 1000) * sampleRate));
    for (let i = 0; i < holdSamples; i++) {
      samples.push(
        createSample(sequence++, currentTime, MovementPhase.HOLD, maxPosition, 0, baseForce * 0.5)
      );
      currentTime += 1000 / sampleRate;
    }
  }

  // Eccentric from partial position
  const eccentricSamples = Math.floor((physics.eccentricDuration / 1000) * sampleRate);
  for (let i = 0; i < eccentricSamples; i++) {
    const progress = i / eccentricSamples;
    const position = maxPosition * (1 - progress);
    const eccentricVelocity =
      peakVelocity * physics.eccentricVelocityRatio * Math.sin(progress * Math.PI);
    const force = baseForce * 0.8 * (1 - progress * 0.2);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.ECCENTRIC,
        position,
        eccentricVelocity,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Final IDLE sample to complete the rep (triggers RepDetector completion)
  samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
  currentTime += 1000 / sampleRate;

  return { samples, endTime: currentTime, endSequence: sequence };
}

// =============================================================================
// Helper Functions
// =============================================================================

interface CompletedRepOptions extends RepBehaviorOptions {
  concentricDuration: number;
  eccentricDuration: number;
  eccentricVelocityRatio: number;
  holdDuration: number;
}

/**
 * Generate a standard completed rep (used by explosive, normal, fatiguing).
 */
function generateCompletedRep(options: CompletedRepOptions): RepSamplesResult {
  const {
    weight = 100,
    peakVelocity = 0.7,
    concentricDuration,
    eccentricDuration,
    eccentricVelocityRatio,
    holdDuration,
    startTime = Date.now(),
    startSequence = 0,
    sampleRate = 11,
  } = options;

  const samples: WorkoutSample[] = [];
  let currentTime = startTime;
  let sequence = startSequence;
  const baseForce = weight * 1.5;

  // Concentric phase
  const concentricSamples = Math.floor((concentricDuration / 1000) * sampleRate);
  for (let i = 0; i < concentricSamples; i++) {
    const progress = i / concentricSamples;
    const position = progress;
    const velocityCurve = Math.sin(progress * Math.PI) * peakVelocity;
    const force = baseForce * (1 - progress * 0.3);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.CONCENTRIC,
        position,
        velocityCurve,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Hold phase
  if (holdDuration > 0) {
    const holdSamples = Math.max(1, Math.floor((holdDuration / 1000) * sampleRate));
    for (let i = 0; i < holdSamples; i++) {
      samples.push(
        createSample(sequence++, currentTime, MovementPhase.HOLD, 1, 0, baseForce * 0.5)
      );
      currentTime += 1000 / sampleRate;
    }
  }

  // Eccentric phase
  const eccentricSamples = Math.floor((eccentricDuration / 1000) * sampleRate);
  for (let i = 0; i < eccentricSamples; i++) {
    const progress = i / eccentricSamples;
    const position = 1 - progress;
    const eccentricVelocity = peakVelocity * eccentricVelocityRatio * Math.sin(progress * Math.PI);
    const force = baseForce * 0.8 * (1 - progress * 0.2);

    samples.push(
      createSample(
        sequence++,
        currentTime,
        MovementPhase.ECCENTRIC,
        position,
        eccentricVelocity,
        force
      )
    );
    currentTime += 1000 / sampleRate;
  }

  // Final IDLE sample to complete the rep (triggers RepDetector completion)
  samples.push(createSample(sequence++, currentTime, MovementPhase.IDLE, 0, 0, 0));
  currentTime += 1000 / sampleRate;

  return { samples, endTime: currentTime, endSequence: sequence };
}
