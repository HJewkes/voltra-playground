/**
 * Superset & Circuit Support
 *
 * A superset groups two or more exercises that alternate with minimal rest.
 * A circuit is the generalized case (N exercises rotating).
 *
 * Design:
 * - SupersetConfig defines the exercise rotation and rest policy
 * - SupersetState tracks position within the rotation during a session
 * - Pure functions handle rotation advancement and completion checks
 * - The session store consumes these to drive the UI state machine
 *
 * Example superset: chest press -> cable row -> chest press -> cable row
 * Example circuit:  squat -> press -> row -> squat -> press -> row
 */

import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan } from './models/plan';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for a superset or circuit.
 *
 * Each slot has its own exercise and plan. The rotation cycles through
 * slots in order, completing one set per slot before repeating.
 */
export interface SupersetConfig {
  /** Ordered list of exercise slots in the rotation */
  slots: SupersetSlot[];

  /** Rest between exercises within a round (seconds, default 30) */
  transitionRestSeconds: number;

  /** Rest between rounds - after all slots complete one set (seconds) */
  roundRestSeconds: number;

  /** Total rounds to perform (each round = one set per slot) */
  totalRounds: number;
}

/**
 * A single slot in a superset rotation.
 */
export interface SupersetSlot {
  exercise: Exercise;
  plan: ExercisePlan;
}

/**
 * Tracks current position within a superset rotation.
 * Immutable - all mutations return new objects.
 */
export interface SupersetState {
  /** Index of current slot (0-based, into config.slots) */
  currentSlotIndex: number;

  /** Current round (0-based) */
  currentRound: number;

  /** Total sets completed across all slots */
  totalSetsCompleted: number;
}

/**
 * Result of advancing the superset rotation after a set completes.
 */
export interface SupersetAdvanceResult {
  /** Updated state after advancing */
  state: SupersetState;

  /** The next slot to perform (null if superset is complete) */
  nextSlot: SupersetSlot | null;

  /** Rest duration before next set (seconds) */
  restSeconds: number;

  /** Whether the entire superset is complete */
  isComplete: boolean;

  /** Whether this advance crosses a round boundary */
  isNewRound: boolean;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create initial superset state.
 */
export function createSupersetState(): SupersetState {
  return {
    currentSlotIndex: 0,
    currentRound: 0,
    totalSetsCompleted: 0,
  };
}

/**
 * Create a superset config from exercises and plans.
 */
export function createSupersetConfig(
  slots: SupersetSlot[],
  options?: {
    transitionRestSeconds?: number;
    roundRestSeconds?: number;
    totalRounds?: number;
  }
): SupersetConfig {
  if (slots.length < 2) {
    throw new Error('Superset requires at least 2 exercises');
  }

  return {
    slots,
    transitionRestSeconds: options?.transitionRestSeconds ?? 30,
    roundRestSeconds: options?.roundRestSeconds ?? 90,
    totalRounds: options?.totalRounds ?? 3,
  };
}

// =============================================================================
// Pure Functions
// =============================================================================

/**
 * Get the current slot in the rotation.
 */
export function getCurrentSlot(config: SupersetConfig, state: SupersetState): SupersetSlot {
  return config.slots[state.currentSlotIndex];
}

/**
 * Advance the superset rotation after completing a set.
 *
 * Cycles: slot0 -> slot1 -> ... -> slotN -> slot0 (next round) -> ...
 * When all rounds are complete, returns isComplete: true.
 */
export function advanceSuperset(
  config: SupersetConfig,
  state: SupersetState
): SupersetAdvanceResult {
  const nextTotalSets = state.totalSetsCompleted + 1;
  const nextSlotIndex = state.currentSlotIndex + 1;
  const isEndOfRound = nextSlotIndex >= config.slots.length;

  if (isEndOfRound) {
    const nextRound = state.currentRound + 1;
    const isComplete = nextRound >= config.totalRounds;

    if (isComplete) {
      return {
        state: {
          currentSlotIndex: 0,
          currentRound: nextRound,
          totalSetsCompleted: nextTotalSets,
        },
        nextSlot: null,
        restSeconds: 0,
        isComplete: true,
        isNewRound: true,
      };
    }

    return {
      state: {
        currentSlotIndex: 0,
        currentRound: nextRound,
        totalSetsCompleted: nextTotalSets,
      },
      nextSlot: config.slots[0],
      restSeconds: config.roundRestSeconds,
      isComplete: false,
      isNewRound: true,
    };
  }

  return {
    state: {
      currentSlotIndex: nextSlotIndex,
      currentRound: state.currentRound,
      totalSetsCompleted: nextTotalSets,
    },
    nextSlot: config.slots[nextSlotIndex],
    restSeconds: config.transitionRestSeconds,
    isComplete: false,
    isNewRound: false,
  };
}

/**
 * Check if the superset is complete.
 */
export function isSupersetComplete(config: SupersetConfig, state: SupersetState): boolean {
  return state.currentRound >= config.totalRounds;
}

/**
 * Get total sets expected across the entire superset.
 */
export function getTotalSupersetSets(config: SupersetConfig): number {
  return config.slots.length * config.totalRounds;
}

/**
 * Get the upcoming exercise sequence for display.
 * Returns the next N exercises in the rotation.
 */
export function getUpcomingExercises(
  config: SupersetConfig,
  state: SupersetState,
  count: number
): Array<{ exercise: Exercise; round: number; slotIndex: number }> {
  const result: Array<{ exercise: Exercise; round: number; slotIndex: number }> = [];
  let slotIndex = state.currentSlotIndex;
  let round = state.currentRound;

  for (let i = 0; i < count && round < config.totalRounds; i++) {
    result.push({
      exercise: config.slots[slotIndex].exercise,
      round,
      slotIndex,
    });

    slotIndex++;
    if (slotIndex >= config.slots.length) {
      slotIndex = 0;
      round++;
    }
  }

  return result;
}

/**
 * Get the planned set for the current position in the superset.
 * Uses the round index to look up the correct set in the slot's plan.
 */
export function getSupersetPlannedSet(
  config: SupersetConfig,
  state: SupersetState
): { weight: number; targetReps: number } | null {
  const slot = config.slots[state.currentSlotIndex];
  if (!slot) return null;

  const setInPlan = slot.plan.sets[state.currentRound];
  if (!setInPlan) return null;

  return { weight: setInPlan.weight, targetReps: setInPlan.targetReps };
}
