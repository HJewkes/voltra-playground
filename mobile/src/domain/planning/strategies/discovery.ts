/**
 * Discovery Planning Strategy
 * 
 * Logic for guiding users through weight discovery for new exercises.
 * Extracts workflow logic from WeightDiscoveryEngine, but delegates
 * profile building to domain/vbt/profile.ts.
 * 
 * Responsibilities:
 * - Determine first discovery step
 * - Guide through exploration phase
 * - Transition to dialing-in phase
 * - Generate final recommendations
 */

import type { TrainingGoal, DiscoveryPhase, DiscoveryStep, DiscoverySetResult } from '../types';
import {
  categorizeVelocity,
  buildLoadVelocityProfile,
  generateWorkingWeightRecommendation,
  type VelocityTrend,
  type LoadVelocityProfile,
  TRAINING_ZONES,
} from '@/domain/vbt';

// =============================================================================
// Types
// =============================================================================

export interface DiscoveryState {
  exerciseId: string;
  exerciseType: 'compound' | 'isolation';
  goal: TrainingGoal;
  phase: DiscoveryPhase;
  sets: DiscoverySetResult[];
  currentWeight: number;
  lastVelocity: number;
}

export interface DiscoveryRecommendation {
  /** Estimated 1RM */
  estimated1RM: number;
  /** Recommended warmup sets */
  warmupSets: Array<{ weight: number; reps: number; purpose: string; restSeconds: number }>;
  /** Recommended working weight */
  workingWeight: number;
  /** Recommended rep range */
  repRange: [number, number];
  /** Confidence in recommendations */
  confidence: 'high' | 'medium' | 'low';
  /** Explanation for the user */
  explanation: string;
  /** The profile used to generate this */
  profile: LoadVelocityProfile;
}

export interface UserEstimate {
  /** A weight the user knows they can handle easily */
  lightWeight?: number;
  /** A rough guess at their max */
  guessedMax?: number;
}

// =============================================================================
// Discovery Functions
// =============================================================================

/**
 * Create initial discovery state.
 */
export function createDiscoveryState(
  exerciseId: string,
  exerciseType: 'compound' | 'isolation',
  goal: TrainingGoal
): DiscoveryState {
  return {
    exerciseId,
    exerciseType,
    goal,
    phase: 'not_started',
    sets: [],
    currentWeight: 0,
    lastVelocity: 0,
  };
}

/**
 * Get the first discovery step based on user input.
 */
export function getFirstDiscoveryStep(
  state: DiscoveryState,
  userEstimate?: UserEstimate
): { step: DiscoveryStep; updatedState: DiscoveryState } {
  let startWeight: number;
  
  if (userEstimate?.guessedMax) {
    // User has a rough idea of their max - start at 30%
    startWeight = Math.round(userEstimate.guessedMax * 0.3 / 5) * 5;
  } else if (userEstimate?.lightWeight) {
    // User knows a "light" weight - use that
    startWeight = userEstimate.lightWeight;
  } else {
    // Complete beginner - start with minimum
    startWeight = state.exerciseType === 'compound' ? 20 : 10;
  }
  
  // Ensure minimum
  startWeight = Math.max(5, startWeight);
  
  const step: DiscoveryStep = {
    stepNumber: 1,
    instruction: `Start with ${startWeight} lbs - do 5 reps at a comfortable pace`,
    weight: startWeight,
    targetReps: 5,
    purpose: 'Establish baseline velocity at light weight',
    velocityExpectation: 'Should feel easy - expect fast bar speed',
  };
  
  return {
    step,
    updatedState: {
      ...state,
      phase: 'exploring',
      currentWeight: startWeight,
    },
  };
}

/**
 * Record a completed set and get the next step.
 */
export function getNextDiscoveryStep(
  state: DiscoveryState,
  result: DiscoverySetResult
): { step: DiscoveryStep; updatedState: DiscoveryState } | { recommendation: DiscoveryRecommendation; updatedState: DiscoveryState } {
  const updatedSets = [...state.sets, result];
  const updatedState: DiscoveryState = {
    ...state,
    sets: updatedSets,
    lastVelocity: result.meanVelocity,
  };
  
  // Check for failure
  if (result.failed) {
    return finalizeDiscovery(updatedState);
  }
  
  // Analyze current state
  const trend = categorizeVelocity(result.meanVelocity);
  const canEstimate = updatedSets.length >= 2 && hasAdequateSpread(updatedSets);
  
  // Decide next step based on phase and data
  if (state.phase === 'exploring') {
    return getExplorationStep(updatedState, trend, canEstimate);
  } else {
    return getDialingInStep(updatedState);
  }
}

/**
 * Check if we have enough data spread to estimate.
 */
function hasAdequateSpread(sets: DiscoverySetResult[]): boolean {
  if (sets.length < 2) return false;
  
  const weights = sets.map(s => s.weight);
  const velocities = sets.map(s => s.meanVelocity);
  
  // Need at least 20% weight spread
  const minWeight = Math.min(...weights);
  const weightSpread = minWeight > 0 
    ? (Math.max(...weights) - minWeight) / minWeight 
    : 0;
  
  // Need meaningful velocity difference
  const velocitySpread = Math.max(...velocities) - Math.min(...velocities);
  
  return weightSpread >= 0.2 && velocitySpread >= 0.15;
}

/**
 * Get next step during exploration phase.
 */
function getExplorationStep(
  state: DiscoveryState,
  trend: VelocityTrend,
  canEstimate: boolean
): { step: DiscoveryStep; updatedState: DiscoveryState } | { recommendation: DiscoveryRecommendation; updatedState: DiscoveryState } {
  const stepNumber = state.sets.length + 1;
  
  // Determine weight increment based on velocity
  let increment: number;
  let message: string;
  
  switch (trend) {
    case 'fast':
      // Way too light - big jump
      increment = state.exerciseType === 'compound' ? 20 : 10;
      message = 'That was very light - making a bigger jump';
      break;
      
    case 'moderate':
      // Getting closer - moderate jump
      increment = state.exerciseType === 'compound' ? 10 : 5;
      message = "Good pace - let's go a bit heavier";
      break;
      
    case 'slow':
      // Getting heavy - small jump or switch to dialing in
      if (canEstimate) {
        return getDialingInStep({ ...state, phase: 'dialing_in' });
      }
      increment = 5;
      message = 'Starting to slow down - small increase';
      break;
      
    case 'grinding':
      // Near limit - we have enough data
      if (state.sets.length >= 2) {
        return finalizeDiscovery(state);
      }
      // Go back down if we jumped too fast
      increment = -10;
      message = "That was hard! Let's try a lighter weight";
      break;
  }
  
  const newWeight = Math.max(5, Math.round((state.currentWeight + increment) / 5) * 5);
  const targetReps = trend === 'slow' || trend === 'grinding' ? 3 : 5;
  
  const step: DiscoveryStep = {
    stepNumber,
    instruction: `Try ${newWeight} lbs - ${targetReps} reps, max intent`,
    weight: newWeight,
    targetReps,
    purpose: message,
    velocityExpectation: getVelocityExpectation(trend),
  };
  
  return {
    step,
    updatedState: {
      ...state,
      currentWeight: newWeight,
    },
  };
}

/**
 * Get next step during dialing-in phase.
 */
function getDialingInStep(
  state: DiscoveryState
): { step: DiscoveryStep; updatedState: DiscoveryState } | { recommendation: DiscoveryRecommendation; updatedState: DiscoveryState } {
  // Build profile with current data
  const dataPoints = state.sets.map(s => ({
    weight: s.weight,
    velocity: s.meanVelocity,
  }));
  const profile = buildLoadVelocityProfile(state.exerciseId, dataPoints);
  
  if (profile.confidence !== 'low') {
    // Good enough - finalize
    return {
      recommendation: generateRecommendation(profile, state.goal),
      updatedState: { ...state, phase: 'complete' },
    };
  }
  
  // Need one more data point near the working zone
  const targetZone = TRAINING_ZONES[state.goal];
  const targetWeight = Math.round(profile.estimated1RM * (targetZone.optimal / 100) / 5) * 5;
  
  // Check if we've already tested near this weight
  const nearTarget = state.sets.some(s => 
    Math.abs(s.weight - targetWeight) / targetWeight < 0.1
  );
  
  if (!nearTarget && targetWeight > 0) {
    const step: DiscoveryStep = {
      stepNumber: state.sets.length + 1,
      instruction: `Let's test ${targetWeight} lbs - this should be close to your working weight`,
      weight: targetWeight,
      targetReps: 3,
      purpose: 'Confirming working weight zone',
    };
    
    return {
      step,
      updatedState: {
        ...state,
        currentWeight: targetWeight,
      },
    };
  }
  
  // We've tested near target - good enough
  return {
    recommendation: generateRecommendation(profile, state.goal),
    updatedState: { ...state, phase: 'complete' },
  };
}

/**
 * Finalize discovery and generate recommendation.
 */
function finalizeDiscovery(
  state: DiscoveryState
): { recommendation: DiscoveryRecommendation; updatedState: DiscoveryState } {
  const dataPoints = state.sets.map(s => ({
    weight: s.weight,
    velocity: s.meanVelocity,
  }));
  const profile = buildLoadVelocityProfile(state.exerciseId, dataPoints);
  
  return {
    recommendation: generateRecommendation(profile, state.goal),
    updatedState: { ...state, phase: 'complete' },
  };
}

/**
 * Generate final recommendation from profile.
 */
function generateRecommendation(
  profile: LoadVelocityProfile,
  goal: TrainingGoal
): DiscoveryRecommendation {
  const recommendation = generateWorkingWeightRecommendation(profile, goal);
  
  return {
    estimated1RM: profile.estimated1RM,
    warmupSets: recommendation.warmupSets,
    workingWeight: recommendation.workingWeight,
    repRange: recommendation.repRange,
    confidence: recommendation.confidence,
    explanation: recommendation.explanation,
    profile: recommendation.profile,
  };
}

/**
 * Get velocity expectation message for user.
 */
export function getVelocityExpectation(trend: VelocityTrend): string {
  switch (trend) {
    case 'fast':
      return 'Expect velocity to slow as weight increases';
    case 'moderate':
      return 'Getting into working territory';
    case 'slow':
      return 'This is challenging weight - good data point';
    case 'grinding':
      return 'Near your limit - be careful';
  }
}

/**
 * Get a quick recommendation if user wants to skip detailed discovery.
 * Uses just 2 sets: one light, one moderate.
 */
export function getQuickRecommendation(
  exerciseId: string,
  goal: TrainingGoal,
  lightSet: DiscoverySetResult,
  moderateSet: DiscoverySetResult
): DiscoveryRecommendation {
  const dataPoints = [
    { weight: lightSet.weight, velocity: lightSet.meanVelocity },
    { weight: moderateSet.weight, velocity: moderateSet.meanVelocity },
  ];
  const profile = buildLoadVelocityProfile(exerciseId, dataPoints);
  return generateRecommendation(profile, goal);
}
