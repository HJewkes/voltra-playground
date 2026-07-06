/**
 * Workout Plan Repository
 *
 * AsyncStorage-backed persistence for coach-programmed workout plans.
 * Uses the StorageAdapter abstraction for testability.
 */

import type { StorageAdapter } from '@/data/adapters';
import type { WorkoutPlan } from '@/domain/workout/models/workout-plan';

const KEY_PREFIX = 'voltra:workout-plans:';
const INDEX_KEY = 'voltra:workout-plans:index';

export interface WorkoutPlanRepository {
  saveWorkoutPlan(plan: WorkoutPlan): Promise<void>;
  getWorkoutPlan(id: string): Promise<WorkoutPlan | null>;
  getTodaysPlan(): Promise<WorkoutPlan | null>;
  getAllPlans(): Promise<WorkoutPlan[]>;
  deletePlan(id: string): Promise<void>;
}

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

class WorkoutPlanRepositoryImpl implements WorkoutPlanRepository {
  constructor(private adapter: StorageAdapter) {}

  async saveWorkoutPlan(plan: WorkoutPlan): Promise<void> {
    const key = `${KEY_PREFIX}${plan.id}`;
    await this.adapter.set(key, plan);

    const index = (await this.adapter.get<string[]>(INDEX_KEY)) ?? [];
    if (!index.includes(plan.id)) {
      index.push(plan.id);
      await this.adapter.set(INDEX_KEY, index);
    }
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | null> {
    const key = `${KEY_PREFIX}${id}`;
    return this.adapter.get<WorkoutPlan>(key);
  }

  async getTodaysPlan(): Promise<WorkoutPlan | null> {
    const today = todayDateString();
    const plans = await this.getAllPlans();
    return plans.find((p) => p.date === today) ?? null;
  }

  async getAllPlans(): Promise<WorkoutPlan[]> {
    const index = (await this.adapter.get<string[]>(INDEX_KEY)) ?? [];
    if (index.length === 0) return [];

    const keys = index.map((id) => `${KEY_PREFIX}${id}`);
    const entries = await this.adapter.getMultiple<WorkoutPlan>(keys);

    const plans: WorkoutPlan[] = [];
    for (const [, plan] of entries) {
      if (plan) plans.push(plan);
    }
    return plans;
  }

  async deletePlan(id: string): Promise<void> {
    const key = `${KEY_PREFIX}${id}`;
    await this.adapter.remove(key);

    const index = (await this.adapter.get<string[]>(INDEX_KEY)) ?? [];
    const updated = index.filter((i) => i !== id);
    await this.adapter.set(INDEX_KEY, updated);
  }
}

export function createWorkoutPlanRepository(adapter: StorageAdapter): WorkoutPlanRepository {
  return new WorkoutPlanRepositoryImpl(adapter);
}
