/**
 * Velocity Profile Repository
 *
 * Persists load-velocity profiles so they survive between sessions.
 * Each exercise gets its own stored profile keyed by exerciseId.
 *
 * Uses the same index + prefix pattern as ExerciseSessionRepository.
 */

import { type StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import type { LoadVelocityProfile } from '@/domain/vbt/profile';
import type { StoredVelocityBaseline } from '@/domain/workout/metrics/baseline';

// =============================================================================
// Types
// =============================================================================

export interface StoredVelocityProfile {
  exerciseId: string;
  profile: LoadVelocityProfile;
  dataPoints: { weight: number; velocity: number; date: number }[];
  baseline: StoredVelocityBaseline | null;
  lastUpdated: number;
  sessionCount: number;
}

export interface VelocityProfileRepository {
  save(exerciseId: string, profile: StoredVelocityProfile): Promise<void>;
  get(exerciseId: string): Promise<StoredVelocityProfile | null>;
  getAll(): Promise<Record<string, StoredVelocityProfile>>;
  delete(exerciseId: string): Promise<void>;
}

// =============================================================================
// Implementation
// =============================================================================

export class VelocityProfileRepositoryImpl implements VelocityProfileRepository {
  constructor(private adapter: StorageAdapter) {}

  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.VELOCITY_PROFILES_INDEX);
    return index ?? [];
  }

  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.VELOCITY_PROFILES_INDEX, ids);
  }

  private getKey(exerciseId: string): string {
    return `${STORAGE_KEYS.VELOCITY_PROFILE_PREFIX}${exerciseId}`;
  }

  async save(exerciseId: string, profile: StoredVelocityProfile): Promise<void> {
    await this.adapter.set(this.getKey(exerciseId), profile);

    const index = await this.getIndex();
    if (!index.includes(exerciseId)) {
      await this.saveIndex([exerciseId, ...index]);
    }
  }

  async get(exerciseId: string): Promise<StoredVelocityProfile | null> {
    return this.adapter.get<StoredVelocityProfile>(this.getKey(exerciseId));
  }

  async getAll(): Promise<Record<string, StoredVelocityProfile>> {
    const index = await this.getIndex();
    const keys = index.map((id) => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredVelocityProfile>(keys);

    const profiles: Record<string, StoredVelocityProfile> = {};
    for (const exerciseId of index) {
      const profile = results.get(this.getKey(exerciseId));
      if (profile) {
        profiles[exerciseId] = profile;
      }
    }

    return profiles;
  }

  async delete(exerciseId: string): Promise<void> {
    await this.adapter.remove(this.getKey(exerciseId));

    const index = await this.getIndex();
    await this.saveIndex(index.filter((id) => id !== exerciseId));
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createVelocityProfileRepository(
  adapter: StorageAdapter,
): VelocityProfileRepository {
  return new VelocityProfileRepositoryImpl(adapter);
}
