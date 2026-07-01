/**
 * Plan Delivery Store Tests (VLT-08.27a)
 *
 * The bridge that makes a delivered workout plan reachable by the exercise
 * screen: receiveWorkoutPlan validates + persists via the phase-1 service and
 * stages the plan; a malformed payload is rejected cleanly and stages nothing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPlanDeliveryStore,
  planDeliveryStore,
  receiveWorkoutPlan,
} from '../plan-delivery-store';
import type { WorkoutPlan } from '@/domain/workout/models/workout-plan';
import type { WorkoutPlanRepository } from '@/data/workout-plan';

function validPlan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'plan-1',
    name: 'Push Day',
    date: '2026-07-01',
    coach: 'Claude',
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        sets: [{ weight: 135, reps: 5, type: 'working' }],
      },
    ],
    ...overrides,
  };
}

function fakeRepo(): WorkoutPlanRepository & { saveWorkoutPlan: ReturnType<typeof vi.fn> } {
  return {
    saveWorkoutPlan: vi.fn(async () => {}),
    getWorkoutPlan: vi.fn(async () => null),
    getTodaysPlan: vi.fn(async () => null),
    getAllPlans: vi.fn(async () => []),
    deletePlan: vi.fn(async () => {}),
  };
}

describe('plan delivery store', () => {
  beforeEach(() => {
    planDeliveryStore.getState().consumePendingPlan();
  });

  it('starts with no pending plan', () => {
    expect(planDeliveryStore.getState().pendingPlan).toBeNull();
  });

  it('deliverPlan stages a plan and consumePendingPlan clears it', () => {
    const store = createPlanDeliveryStore();
    const plan = validPlan();

    store.getState().deliverPlan(plan);
    expect(store.getState().pendingPlan).toBe(plan);

    store.getState().consumePendingPlan();
    expect(store.getState().pendingPlan).toBeNull();
  });
});

describe('receiveWorkoutPlan', () => {
  beforeEach(() => {
    planDeliveryStore.getState().consumePendingPlan();
  });

  it('validates + persists a valid payload and stages it for the exercise screen', async () => {
    const repo = fakeRepo();
    const result = await receiveWorkoutPlan(validPlan(), repo);

    expect(result.ok).toBe(true);
    expect(repo.saveWorkoutPlan).toHaveBeenCalledTimes(1);
    expect(planDeliveryStore.getState().pendingPlan).toMatchObject({ id: 'plan-1', name: 'Push Day' });
  });

  it('accepts a valid plan delivered as a JSON string', async () => {
    const repo = fakeRepo();
    const result = await receiveWorkoutPlan(JSON.stringify(validPlan()), repo);

    expect(result.ok).toBe(true);
    expect(planDeliveryStore.getState().pendingPlan?.name).toBe('Push Day');
  });

  it('rejects a malformed payload cleanly and stages nothing', async () => {
    const repo = fakeRepo();
    const result = await receiveWorkoutPlan('{ not json', repo);

    expect(result).toEqual({ ok: false, error: 'Plan payload is not valid JSON' });
    expect(repo.saveWorkoutPlan).not.toHaveBeenCalled();
    expect(planDeliveryStore.getState().pendingPlan).toBeNull();
  });

  it('rejects a structurally invalid plan and stages nothing', async () => {
    const repo = fakeRepo();
    const result = await receiveWorkoutPlan(validPlan({ exercises: [] }), repo);

    expect(result.ok).toBe(false);
    expect(planDeliveryStore.getState().pendingPlan).toBeNull();
  });
});
