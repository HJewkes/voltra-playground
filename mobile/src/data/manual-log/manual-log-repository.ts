/**
 * Manual Log Repository
 *
 * Simple per-day storage for manually logged free weight sets.
 * Uses the StorageAdapter abstraction so tests can inject InMemoryAdapter.
 */

import type { StorageAdapter } from '@/data/adapters';
import type { ManualSetLog } from './manual-set-log';

const KEY_PREFIX = 'voltra:manual-logs:';
const EXERCISE_NAMES_KEY = 'voltra:manual-logs:exercise-names';

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${KEY_PREFIX}${y}-${m}-${d}`;
}

export interface ManualLogRepository {
  logSet(log: ManualSetLog): Promise<void>;
  getToday(): Promise<ManualSetLog[]>;
  getByDate(date: Date): Promise<ManualSetLog[]>;
  getExerciseNames(): Promise<string[]>;
}

class ManualLogRepositoryImpl implements ManualLogRepository {
  constructor(private adapter: StorageAdapter) {}

  async logSet(log: ManualSetLog): Promise<void> {
    const key = dateKey(new Date(log.timestamp));
    const existing = await this.adapter.get<ManualSetLog[]>(key);
    const logs = existing ?? [];
    logs.push(log);
    await this.adapter.set(key, logs);

    await this.addExerciseName(log.exerciseName);
  }

  async getToday(): Promise<ManualSetLog[]> {
    return this.getByDate(new Date());
  }

  async getByDate(date: Date): Promise<ManualSetLog[]> {
    const key = dateKey(date);
    return (await this.adapter.get<ManualSetLog[]>(key)) ?? [];
  }

  async getExerciseNames(): Promise<string[]> {
    return (await this.adapter.get<string[]>(EXERCISE_NAMES_KEY)) ?? [];
  }

  private async addExerciseName(name: string): Promise<void> {
    const names = await this.getExerciseNames();
    const normalized = name.trim();
    if (names.includes(normalized)) return;
    names.push(normalized);
    await this.adapter.set(EXERCISE_NAMES_KEY, names);
  }
}

export function createManualLogRepository(
  adapter: StorageAdapter,
): ManualLogRepository {
  return new ManualLogRepositoryImpl(adapter);
}
