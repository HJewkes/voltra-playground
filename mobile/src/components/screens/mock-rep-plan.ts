/**
 * Mock Rep Plan Generator
 *
 * Generates a realistic PlannedRepProfile[] from an ExercisePlan for use
 * with the mock BLE adapter. Only called in mock mode (?mock URL param).
 *
 * Produces visible fatigue progression: ROM decreases and concentric time
 * increases across reps within each set.
 */

import type { ExercisePlan } from '@/domain/workout';

interface PlannedRepProfile {
  conSeconds: number;
  holdSeconds: number;
  eccSeconds: number;
  idleSeconds: number;
  romMm: number;
}

const BASE_CON_SECONDS = 1.5;
const BASE_HOLD_SECONDS = 0.5;
const BASE_ECC_SECONDS = 2.0;
const INTER_REP_IDLE_SECONDS = 1.0;
const INTER_SET_IDLE_SECONDS = 8.0;
const BASE_ROM_MM = 800;
const FATIGUE_ROM_DECAY = 0.05;
const FATIGUE_CON_INCREMENT = 0.1;
const DEFAULT_REPS = 8;

export function generateMockRepPlan(plan: ExercisePlan): PlannedRepProfile[] {
  const reps: PlannedRepProfile[] = [];

  for (let setIdx = 0; setIdx < plan.sets.length; setIdx++) {
    const plannedSet = plan.sets[setIdx];
    const repCount = plannedSet.targetReps > 0 ? plannedSet.targetReps : DEFAULT_REPS;
    const isLastSet = setIdx === plan.sets.length - 1;

    for (let repIdx = 0; repIdx < repCount; repIdx++) {
      const isLastRepOfSet = repIdx === repCount - 1;
      const fatigueFactor = repIdx;

      const rom = BASE_ROM_MM * (1 - FATIGUE_ROM_DECAY * fatigueFactor);
      const con = BASE_CON_SECONDS + FATIGUE_CON_INCREMENT * fatigueFactor;

      let idle = INTER_REP_IDLE_SECONDS;
      if (isLastRepOfSet && !isLastSet) {
        idle = INTER_SET_IDLE_SECONDS;
      }

      reps.push({
        conSeconds: con,
        holdSeconds: BASE_HOLD_SECONDS,
        eccSeconds: BASE_ECC_SECONDS,
        idleSeconds: idle,
        romMm: Math.round(rom),
      });
    }
  }

  return reps;
}
