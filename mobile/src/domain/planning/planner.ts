/**
 * Unified Exercise Planner
 *
 * Single entry point for all planning decisions:
 * - Initial plan generation (no completed sets)
 * - Intra-workout adaptation (has completed sets)
 * - Weight discovery (no history, building profile)
 *
 * Uses the same PlanningContext interface for all scenarios,
 * routing to appropriate strategies based on context.
 */

import type { PlannedSet } from '@/domain/workout/models/plan';
// FatigueEstimate removed - not currently used
import {
  createEmptySessionMetrics,
  createEmptyFatigueEstimate,
  createDefaultReadinessEstimate,
  createEmptyStrengthEstimate,
} from '@/domain/workout/metrics/types';

import type { PlanningContext, PlanResult, PlanAdjustment } from './types';
import {
  REST_DEFAULTS,
  RIR_DEFAULTS,
  VELOCITY_LOSS_TARGETS,
  getWarmupSets,
  DEFAULT_WARMUP_SCHEME,
} from './types';

import {
  calculateWeightAdjustment,
  calculateRestAdjustment,
  shouldStop,
  canAddSet,
  createAdjustment,
  type StandardStrategyConfig,
  type SetPerformance,
} from './strategies/standard';

import {
  createDiscoveryState,
  getFirstDiscoveryStep,
  getNextDiscoveryStep,
  type DiscoveryState,
} from './strategies/discovery';

// =============================================================================
// Main Planner Function
// =============================================================================

/**
 * Unified planning function.
 *
 * Handles all planning scenarios:
 * - Initial planning: completedSets is empty, generates first plan
 * - Mid-workout: has completedSets, adapts based on performance
 * - Discovery: isDiscovery is true, guides through weight finding
 *
 * @param context - Complete planning context
 * @returns Plan result with next set recommendation
 */
export function planExercise(context: PlanningContext): PlanResult {
  // Route to appropriate handler
  if (context.isDiscovery) {
    return handleDiscovery(context);
  }

  if (context.completedSets.length === 0) {
    return handleInitialPlan(context);
  }

  return handleAdaptation(context);
}

// =============================================================================
// Initial Planning
// =============================================================================

/**
 * Generate initial plan when starting an exercise.
 * No sets completed yet - create full plan from scratch or history.
 */
function handleInitialPlan(context: PlanningContext): PlanResult {
  const { goal, exerciseType, historicalMetrics, overrides } = context;

  // Determine working weight
  let workingWeight: number;
  if (overrides?.weight) {
    workingWeight = overrides.weight;
  } else if (historicalMetrics?.lastWorkingWeight) {
    workingWeight = historicalMetrics.lastWorkingWeight;
  } else {
    // No history - need discovery
    return createDiscoveryNeededResult(context);
  }

  // Determine rep range
  const repRange: [number, number] = overrides?.repRange ?? getDefaultRepRange(goal);

  // Determine number of sets
  const numSets = overrides?.numSets ?? 3;

  // Create warmup sets if not skipping
  const warmupSets: PlannedSet[] = [];
  if (!overrides?.skipWarmups) {
    const warmups = getWarmupSets(workingWeight, DEFAULT_WARMUP_SCHEME);
    warmups.forEach((w, i) => {
      warmupSets.push({
        setNumber: i + 1,
        weight: w.weight,
        targetReps: w.reps,
        rirTarget: 5, // Warmups should be easy
        isWarmup: true,
      });
    });
  }

  // Create working sets
  const workingSets: PlannedSet[] = [];
  const startSetNumber = warmupSets.length + 1;
  for (let i = 0; i < numSets; i++) {
    workingSets.push({
      setNumber: startSetNumber + i,
      weight: workingWeight,
      targetReps: repRange[0],
      repRange,
      rirTarget: RIR_DEFAULTS[exerciseType],
      isWarmup: false,
    });
  }

  const allSets = [...warmupSets, ...workingSets];
  const [nextSet, ...remainingSets] = allSets;

  return {
    nextSet: nextSet ?? null,
    remainingSets,
    restSeconds: nextSet?.isWarmup ? DEFAULT_WARMUP_SCHEME.warmupRestSeconds : REST_DEFAULTS[goal],
    adjustments: [],
    message: createInitialMessage(workingWeight, repRange, numSets, warmupSets.length > 0),
    updatedMetrics: {
      strength: createEmptyStrengthEstimate(),
      readiness: createDefaultReadinessEstimate(),
      fatigue: createEmptyFatigueEstimate(),
      volumeAccumulated: 0,
      effectiveVolume: 0,
    },
    shouldStop: false,
  };
}

// =============================================================================
// Mid-Workout Adaptation
// =============================================================================

/**
 * Adapt plan based on completed sets.
 * Uses SessionMetrics to make weight, rest, and stop decisions.
 */
function handleAdaptation(context: PlanningContext): PlanResult {
  const { goal, exerciseType, sessionMetrics, completedSets, originalPlanSetCount } = context;

  // Compute current metrics if not provided
  const metrics = sessionMetrics ?? createEmptySessionMetrics();

  // Get last set performance
  const lastSet = completedSets[completedSets.length - 1];
  if (!lastSet) {
    return handleInitialPlan(context);
  }

  // Build config for standard strategy
  const config: StandardStrategyConfig = {
    goal,
    exerciseType,
    allowWeightAdjustment: true,
    allowSetAdjustment: true,
    maxSets: 5,
    minSets: 2,
    velocityLossTarget: VELOCITY_LOSS_TARGETS[goal],
    baseRestSeconds: REST_DEFAULTS[goal],
  };

  // Convert to SetPerformance for strategy functions
  // Access metrics from the Set's metrics property
  const velocityLoss = lastSet.metrics?.fatigue?.fatigueIndex ?? 0;
  const estimatedRir = lastSet.metrics?.effort?.rir ?? 2;
  const firstRepVelocity = lastSet.reps[0]?.metrics?.concentricMeanVelocity ?? 0;
  const avgVelocity = lastSet.metrics?.velocity?.concentricBaseline ?? 0;

  const lastSetPerformance: SetPerformance = {
    setNumber: completedSets.length,
    reps: lastSet.reps.length,
    weight: lastSet.weight,
    velocityLossPercent: velocityLoss,
    estimatedRir: estimatedRir,
    firstRepVelocity: firstRepVelocity,
    avgVelocity: avgVelocity,
    grindingDetected: velocityLoss > 40,
  };

  const adjustments: PlanAdjustment[] = [];

  // Check if should stop
  const plannedSets = originalPlanSetCount ?? 3;
  const stopDecision = shouldStop(metrics, completedSets.length, plannedSets, config);

  if (stopDecision.shouldStop) {
    return {
      nextSet: null,
      remainingSets: [],
      restSeconds: 0,
      adjustments,
      message: stopDecision.message,
      updatedMetrics: {
        strength: metrics.strength,
        readiness: metrics.readiness,
        fatigue: metrics.fatigue,
        volumeAccumulated: metrics.volumeAccumulated,
        effectiveVolume: metrics.effectiveVolume,
      },
      shouldStop: true,
      stopReason: stopDecision.reason ?? undefined,
    };
  }

  // Calculate adjustments
  const weightResult = calculateWeightAdjustment(
    metrics,
    lastSetPerformance.velocityLossPercent,
    config
  );

  const restResult = calculateRestAdjustment(
    metrics,
    lastSetPerformance.velocityLossPercent,
    config
  );

  // Determine next weight
  let nextWeight = lastSet.weight;
  if (weightResult.shouldAdjust) {
    nextWeight = Math.max(5, Math.round((lastSet.weight + weightResult.adjustment) / 5) * 5);
    adjustments.push(
      createAdjustment('weight', weightResult.reason, 'medium', lastSet.weight, nextWeight)
    );
  }

  // Determine rest period
  let restSeconds = config.baseRestSeconds ?? REST_DEFAULTS[goal];
  if (restResult.shouldExtend) {
    restSeconds += restResult.extraRest;
    adjustments.push(
      createAdjustment('rest', restResult.reason, 'medium', config.baseRestSeconds, restSeconds)
    );
  }

  // Check for extra set eligibility
  const setsRemaining = plannedSets - completedSets.length;
  let optionalExtraSet = false;

  if (setsRemaining <= 0) {
    const extraSetEligibility = canAddSet(
      metrics,
      lastSetPerformance,
      completedSets.length,
      config
    );
    optionalExtraSet = extraSetEligibility.canAddSet;
  }

  // Create next set
  const repRange = getDefaultRepRange(goal);
  const nextSet: PlannedSet = {
    setNumber: completedSets.length + 1,
    weight: nextWeight,
    targetReps: repRange[0],
    repRange,
    rirTarget: RIR_DEFAULTS[exerciseType],
    isWarmup: false,
  };

  // Create remaining sets
  const remainingSets: PlannedSet[] = [];
  for (let i = 1; i < setsRemaining; i++) {
    remainingSets.push({
      setNumber: completedSets.length + 1 + i,
      weight: nextWeight,
      targetReps: repRange[0],
      repRange,
      rirTarget: RIR_DEFAULTS[exerciseType],
      isWarmup: false,
    });
  }

  return {
    nextSet: setsRemaining > 0 || optionalExtraSet ? nextSet : null,
    remainingSets,
    restSeconds,
    adjustments,
    message: createAdaptationMessage(nextWeight, lastSet.weight, setsRemaining, optionalExtraSet),
    updatedMetrics: {
      strength: metrics.strength,
      readiness: metrics.readiness,
      fatigue: metrics.fatigue,
      volumeAccumulated: metrics.volumeAccumulated,
      effectiveVolume: metrics.effectiveVolume,
    },
    shouldStop: setsRemaining <= 0 && !optionalExtraSet,
  };
}

// =============================================================================
// Discovery Handling
// =============================================================================

/**
 * Handle weight discovery flow.
 */
function handleDiscovery(context: PlanningContext): PlanResult {
  const { exerciseId, exerciseType, goal, discoveryPhase, discoveryHistory } = context;

  // Create or continue discovery state
  let state: DiscoveryState;

  if (!discoveryPhase || discoveryPhase === 'not_started') {
    state = createDiscoveryState(exerciseId, exerciseType, goal);
    const { step } = getFirstDiscoveryStep(state);

    return {
      nextSet: null,
      remainingSets: [],
      restSeconds: 60, // Short rest during discovery
      adjustments: [],
      message: step.instruction,
      updatedMetrics: {
        strength: createEmptyStrengthEstimate(),
        readiness: createDefaultReadinessEstimate(),
        fatigue: createEmptyFatigueEstimate(),
        volumeAccumulated: 0,
        effectiveVolume: 0,
      },
      shouldStop: false,
      discoveryStep: step,
    };
  }

  // Continue discovery with last result
  state = {
    exerciseId,
    exerciseType,
    goal,
    phase: discoveryPhase,
    sets: discoveryHistory ?? [],
    currentWeight: discoveryHistory?.length
      ? discoveryHistory[discoveryHistory.length - 1].weight
      : 0,
    lastVelocity: discoveryHistory?.length
      ? discoveryHistory[discoveryHistory.length - 1].meanVelocity
      : 0,
  };

  const lastResult = discoveryHistory?.[discoveryHistory.length - 1];
  if (!lastResult) {
    // No result yet - return first step
    const { step } = getFirstDiscoveryStep(state);
    return {
      nextSet: null,
      remainingSets: [],
      restSeconds: 60,
      adjustments: [],
      message: step.instruction,
      updatedMetrics: {
        strength: createEmptyStrengthEstimate(),
        readiness: createDefaultReadinessEstimate(),
        fatigue: createEmptyFatigueEstimate(),
        volumeAccumulated: 0,
        effectiveVolume: 0,
      },
      shouldStop: false,
      discoveryStep: step,
    };
  }

  // Get next step based on last result
  const result = getNextDiscoveryStep(state, lastResult);

  if ('recommendation' in result) {
    // Discovery complete - return recommendation as initial plan
    const rec = result.recommendation;

    // Create working sets from recommendation
    const repRange = rec.repRange;
    const workingSets: PlannedSet[] = [];
    for (let i = 0; i < 3; i++) {
      workingSets.push({
        setNumber: i + 1,
        weight: rec.workingWeight,
        targetReps: repRange[0],
        repRange,
        rirTarget: RIR_DEFAULTS[exerciseType],
        isWarmup: false,
      });
    }

    return {
      nextSet: workingSets[0],
      remainingSets: workingSets.slice(1),
      restSeconds: REST_DEFAULTS[goal],
      adjustments: [],
      message: rec.explanation,
      updatedMetrics: {
        strength: {
          estimated1RM: rec.estimated1RM,
          confidence: rec.confidence === 'high' ? 0.9 : rec.confidence === 'medium' ? 0.7 : 0.5,
          source: 'discovery',
        },
        readiness: createDefaultReadinessEstimate(),
        fatigue: createEmptyFatigueEstimate(),
        volumeAccumulated: 0,
        effectiveVolume: 0,
      },
      shouldStop: false,
    };
  }

  // Return next discovery step
  return {
    nextSet: null,
    remainingSets: [],
    restSeconds: 60,
    adjustments: [],
    message: result.step.instruction,
    updatedMetrics: {
      strength: createEmptyStrengthEstimate(),
      readiness: createDefaultReadinessEstimate(),
      fatigue: createEmptyFatigueEstimate(),
      volumeAccumulated: 0,
      effectiveVolume: 0,
    },
    shouldStop: false,
    discoveryStep: result.step,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function getDefaultRepRange(goal: string): [number, number] {
  switch (goal) {
    case 'strength':
      return [3, 5];
    case 'hypertrophy':
      return [8, 12];
    case 'endurance':
      return [15, 20];
    default:
      return [8, 12];
  }
}

function createInitialMessage(
  weight: number,
  repRange: [number, number],
  numSets: number,
  hasWarmups: boolean
): string {
  const repStr = repRange[0] === repRange[1] ? `${repRange[0]}` : `${repRange[0]}-${repRange[1]}`;
  if (hasWarmups) {
    return `Start with warmups, then ${numSets} sets of ${repStr} at ${weight} lbs`;
  }
  return `${numSets} sets of ${repStr} at ${weight} lbs`;
}

function createAdaptationMessage(
  nextWeight: number,
  lastWeight: number,
  setsRemaining: number,
  optionalExtraSet: boolean
): string {
  if (optionalExtraSet) {
    return "Target reached - optional extra set if you're feeling strong";
  }

  if (nextWeight > lastWeight) {
    return `Bump up to ${nextWeight} lbs - ${setsRemaining} sets remaining`;
  } else if (nextWeight < lastWeight) {
    return `Drop to ${nextWeight} lbs - working hard, ${setsRemaining} sets remaining`;
  }

  return `Same weight (${nextWeight} lbs) - ${setsRemaining} sets remaining`;
}

function createDiscoveryNeededResult(_context: PlanningContext): PlanResult {
  return {
    nextSet: null,
    remainingSets: [],
    restSeconds: 0,
    adjustments: [],
    message: 'No working weight established - start weight discovery',
    updatedMetrics: {
      strength: createEmptyStrengthEstimate(),
      readiness: createDefaultReadinessEstimate(),
      fatigue: createEmptyFatigueEstimate(),
      volumeAccumulated: 0,
      effectiveVolume: 0,
    },
    shouldStop: true,
    stopReason: 'user_requested',
  };
}
