/**
 * History Store
 * 
 * Manages workout history with caching.
 * Computes derived data (velocity baselines, PRs, trends) on demand.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { workoutRepository } from '@/data/repositories';
import type { 
  StoredWorkout, 
  WorkoutSummary,
  VelocityBaseline,
  PersonalRecord,
  TrendAnalysis,
} from '@/data/models';
import { computeVelocityBaseline } from '@/data/models';

// =============================================================================
// Types
// =============================================================================

interface HistoryState {
  // Cached data (loaded on demand)
  recentWorkouts: StoredWorkout[];
  exerciseWorkouts: Map<string, StoredWorkout[]>;
  isLoading: boolean;
  
  // COMPUTED data caches (derived from workouts, not stored separately)
  velocityBaselineCache: Map<string, VelocityBaseline>;
  personalRecordCache: Map<string, PersonalRecord[]>;
  
  // Aggregate stats
  aggregateStats: {
    totalWorkouts: number;
    totalReps: number;
    totalVolume: number;
  };
  
  // Load actions
  loadRecentWorkouts: (count?: number) => Promise<void>;
  loadExerciseWorkouts: (exerciseId: string) => Promise<void>;
  loadAggregateStats: () => Promise<void>;
  
  // Save action (also invalidates computed caches)
  saveWorkout: (workout: StoredWorkout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  
  // Get single workout
  getWorkout: (id: string) => Promise<StoredWorkout | null>;
  
  // COMPUTED queries (cache in memory, recompute when workouts change)
  getVelocityBaseline: (exerciseId: string) => Promise<VelocityBaseline | null>;
  getPersonalRecords: (exerciseId: string) => Promise<PersonalRecord[]>;
  
  // Cache invalidation (call after saving workout)
  invalidateExerciseCache: (exerciseId: string) => void;
  invalidateAll: () => void;
}

// =============================================================================
// Store
// =============================================================================

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      recentWorkouts: [],
      exerciseWorkouts: new Map(),
      velocityBaselineCache: new Map(),
      personalRecordCache: new Map(),
      isLoading: false,
      aggregateStats: {
        totalWorkouts: 0,
        totalReps: 0,
        totalVolume: 0,
      },
      
      loadRecentWorkouts: async (count = 20) => {
        set({ isLoading: true });
        try {
          const workouts = await workoutRepository.getRecent(count);
          set({ recentWorkouts: workouts });
        } finally {
          set({ isLoading: false });
        }
      },
      
      loadExerciseWorkouts: async (exerciseId) => {
        set({ isLoading: true });
        try {
          const workouts = await workoutRepository.getByExercise(exerciseId);
          set(state => ({
            exerciseWorkouts: new Map(state.exerciseWorkouts).set(exerciseId, workouts),
          }));
        } finally {
          set({ isLoading: false });
        }
      },
      
      loadAggregateStats: async () => {
        const stats = await workoutRepository.getAggregateStats();
        set({ aggregateStats: stats });
      },
      
      saveWorkout: async (workout) => {
        await workoutRepository.save(workout);
        
        // Update recent cache (add to front)
        set(state => ({
          recentWorkouts: [workout, ...state.recentWorkouts.filter(w => w.id !== workout.id)].slice(0, 20),
        }));
        
        // Invalidate computed data for this exercise (will recompute on next query)
        get().invalidateExerciseCache(workout.exerciseId);
        
        // Reload aggregate stats
        get().loadAggregateStats();
      },
      
      deleteWorkout: async (id) => {
        // Find the workout to get its exerciseId for cache invalidation
        const workout = await workoutRepository.getById(id);
        
        await workoutRepository.delete(id);
        
        // Update recent cache
        set(state => ({
          recentWorkouts: state.recentWorkouts.filter(w => w.id !== id),
        }));
        
        // Invalidate exercise cache if we found the workout
        if (workout) {
          get().invalidateExerciseCache(workout.exerciseId);
        }
        
        // Reload aggregate stats
        get().loadAggregateStats();
      },
      
      getWorkout: async (id) => {
        // Check cache first
        const cached = get().recentWorkouts.find(w => w.id === id);
        if (cached) return cached;
        
        // Load from repository
        return workoutRepository.getById(id);
      },
      
      getVelocityBaseline: async (exerciseId) => {
        // Check cache first
        const cached = get().velocityBaselineCache.get(exerciseId);
        if (cached) return cached;
        
        // Query workouts and COMPUTE baseline
        const workouts = await workoutRepository.getByExercise(exerciseId);
        if (workouts.length === 0) return null;
        
        // Compute baseline from first-rep velocities
        const baseline = computeVelocityBaseline(exerciseId, workouts);
        
        // Cache it
        set(state => ({
          velocityBaselineCache: new Map(state.velocityBaselineCache).set(exerciseId, baseline),
        }));
        
        return baseline;
      },
      
      getPersonalRecords: async (exerciseId) => {
        // Check cache first
        const cached = get().personalRecordCache.get(exerciseId);
        if (cached) return cached;
        
        // Query workouts and compute PRs
        const workouts = await workoutRepository.getByExercise(exerciseId);
        if (workouts.length === 0) return [];
        
        const records: PersonalRecord[] = [];
        
        // Max weight
        let maxWeightWorkout = workouts[0];
        for (const w of workouts) {
          if (w.weight > maxWeightWorkout.weight) {
            maxWeightWorkout = w;
          }
        }
        records.push({
          type: 'max_weight',
          value: maxWeightWorkout.weight,
          weight: maxWeightWorkout.weight,
          reps: maxWeightWorkout.reps.length,
          date: maxWeightWorkout.date,
          workoutId: maxWeightWorkout.id,
        });
        
        // Max reps (at any weight)
        let maxRepsWorkout = workouts[0];
        for (const w of workouts) {
          if (w.reps.length > maxRepsWorkout.reps.length) {
            maxRepsWorkout = w;
          }
        }
        records.push({
          type: 'max_reps',
          value: maxRepsWorkout.reps.length,
          weight: maxRepsWorkout.weight,
          reps: maxRepsWorkout.reps.length,
          date: maxRepsWorkout.date,
          workoutId: maxRepsWorkout.id,
        });
        
        // Max velocity
        let maxVelWorkout = workouts[0];
        let maxVel = maxVelWorkout.analytics.peakVelocity;
        for (const w of workouts) {
          if (w.analytics.peakVelocity > maxVel) {
            maxVel = w.analytics.peakVelocity;
            maxVelWorkout = w;
          }
        }
        records.push({
          type: 'max_velocity',
          value: maxVel,
          weight: maxVelWorkout.weight,
          date: maxVelWorkout.date,
          workoutId: maxVelWorkout.id,
        });
        
        // Max volume (weight × reps)
        let maxVolWorkout = workouts[0];
        let maxVol = maxVolWorkout.weight * maxVolWorkout.reps.length;
        for (const w of workouts) {
          const vol = w.weight * w.reps.length;
          if (vol > maxVol) {
            maxVol = vol;
            maxVolWorkout = w;
          }
        }
        records.push({
          type: 'max_volume',
          value: maxVol,
          weight: maxVolWorkout.weight,
          reps: maxVolWorkout.reps.length,
          date: maxVolWorkout.date,
          workoutId: maxVolWorkout.id,
        });
        
        // Cache it
        set(state => ({
          personalRecordCache: new Map(state.personalRecordCache).set(exerciseId, records),
        }));
        
        return records;
      },
      
      invalidateExerciseCache: (exerciseId) => {
        set(state => {
          const baselineCache = new Map(state.velocityBaselineCache);
          const prCache = new Map(state.personalRecordCache);
          const workoutCache = new Map(state.exerciseWorkouts);
          
          baselineCache.delete(exerciseId);
          prCache.delete(exerciseId);
          workoutCache.delete(exerciseId);
          
          return { 
            velocityBaselineCache: baselineCache, 
            personalRecordCache: prCache, 
            exerciseWorkouts: workoutCache,
          };
        });
      },
      
      invalidateAll: () => {
        set({
          recentWorkouts: [],
          exerciseWorkouts: new Map(),
          velocityBaselineCache: new Map(),
          personalRecordCache: new Map(),
        });
      },
    }),
    { name: 'history-store' }
  )
);
