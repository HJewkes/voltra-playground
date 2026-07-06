/**
 * Plan Delivery Store
 *
 * Shared hand-off point for a workout plan that arrives from outside the
 * exercise screen (the coaching channel, a future upload, a deep link). A
 * producer calls receiveWorkoutPlan(payload) to validate + persist the plan
 * and stage it here; the exercise screen consumes pendingPlan and loads it
 * into the active session, then clears it.
 *
 * This is the bridge that makes the phase-1 loadWorkoutPlan service reachable
 * end-to-end without the plan living in component-local state.
 */

import { createStore, useStore, type StoreApi } from 'zustand';
import type { WorkoutPlan } from '@/domain/workout/models/workout-plan';
import type { WorkoutPlanRepository } from '@/data/workout-plan';
import { loadWorkoutPlan, type PlanLoadResult } from '@/domain/planning';

export interface PlanDeliveryState {
  /** A validated plan staged for the exercise screen to load, or null. */
  pendingPlan: WorkoutPlan | null;
  /** Stage a validated plan for consumption. */
  deliverPlan: (plan: WorkoutPlan) => void;
  /** Clear the staged plan once consumed. */
  consumePendingPlan: () => void;
}

export function createPlanDeliveryStore(): PlanDeliveryStoreApi {
  return createStore<PlanDeliveryState>()((set) => ({
    pendingPlan: null,
    deliverPlan: (plan: WorkoutPlan) => set({ pendingPlan: plan }),
    consumePendingPlan: () => set({ pendingPlan: null }),
  }));
}

export const planDeliveryStore: PlanDeliveryStoreApi = createPlanDeliveryStore();

export function usePlanDeliveryStore<T>(selector: (state: PlanDeliveryState) => T): T {
  return useStore(planDeliveryStore, selector);
}

export type PlanDeliveryStoreApi = StoreApi<PlanDeliveryState>;

/**
 * Receive a workout plan from any producer: validate + persist it via the
 * phase-1 loadWorkoutPlan service, and on success stage it for the exercise
 * screen to load. Never throws — returns the load result so callers can react
 * to a malformed/absent payload cleanly.
 */
export async function receiveWorkoutPlan(
  payload: unknown,
  repo?: WorkoutPlanRepository
): Promise<PlanLoadResult> {
  const result = await loadWorkoutPlan(payload, repo);
  if (result.ok) planDeliveryStore.getState().deliverPlan(result.plan);
  return result;
}
