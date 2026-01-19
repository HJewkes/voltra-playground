/**
 * Progression Repository Implementation
 * 
 * Handles persistence of progression engine state.
 */

import { StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import { 
  StoredProgressionState, 
  ExerciseProgressionConfig,
  DEFAULT_PROGRESSION_CONFIG,
} from '@/data/models';
import type { ProgressionRepository } from './types';
import type { ExerciseSessionSummary } from '@/planning';

/**
 * Raw state format used by ProgressionEngine.
 * This is the internal format the engine uses for import/export.
 */
export interface ProgressionEngineState {
  exerciseHistory: Record<string, ExerciseSessionSummary[]>;
  consecutiveFailures: Record<string, number>;
  lastDeloadDate: number | null;
  weeksSinceDeload: number;
}

const RAW_STATE_KEY = 'voltra_progression_engine_state';

/**
 * Implementation of ProgressionRepository using a StorageAdapter.
 */
export class ProgressionRepositoryImpl implements ProgressionRepository {
  constructor(private adapter: StorageAdapter) {}
  
  async getState(): Promise<StoredProgressionState | null> {
    return this.adapter.get<StoredProgressionState>(STORAGE_KEYS.PROGRESSION_STATE);
  }
  
  async saveState(state: StoredProgressionState): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.PROGRESSION_STATE, {
      ...state,
      lastUpdated: Date.now(),
    });
  }
  
  /**
   * Get raw state in ProgressionEngine format.
   */
  async getRawState(): Promise<ProgressionEngineState | null> {
    return this.adapter.get<ProgressionEngineState>(RAW_STATE_KEY);
  }
  
  /**
   * Save raw state in ProgressionEngine format.
   */
  async saveRawState(state: ProgressionEngineState): Promise<void> {
    await this.adapter.set(RAW_STATE_KEY, state);
  }
  
  async getExerciseConfig(exerciseId: string): Promise<ExerciseProgressionConfig | null> {
    const key = `${STORAGE_KEYS.PROGRESSION_EXERCISE_PREFIX}${exerciseId}`;
    const config = await this.adapter.get<ExerciseProgressionConfig>(key);
    
    // Return default config if none saved
    if (!config) {
      return { ...DEFAULT_PROGRESSION_CONFIG };
    }
    
    return config;
  }
  
  async saveExerciseConfig(exerciseId: string, config: ExerciseProgressionConfig): Promise<void> {
    const key = `${STORAGE_KEYS.PROGRESSION_EXERCISE_PREFIX}${exerciseId}`;
    await this.adapter.set(key, config);
  }
}
