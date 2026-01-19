/**
 * Workout Session Store
 * 
 * Orchestrates a full workout session with planning:
 * - Warmup with readiness checking
 * - Intra-workout adaptation
 * - Post-workout progression decisions
 * 
 * Uses VoltraStore for device control and HistoryStore for computed baselines.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { progressionRepository } from '@/data/repositories';
import { useHistoryStore } from './history-store';
import {
  ReadinessChecker,
  AdaptiveEngine,
  ProgressionEngine,
  createSessionState,
  createSessionSummary,
} from '@/planning';
import type {
  ReadinessCheckResult,
  WarmupSetData,
  ExercisePrescription,
  SetPerformance,
  NextSetRecommendation,
  ProgressionDecision,
  AdaptiveSessionState,
} from '@/planning';

// =============================================================================
// Types
// =============================================================================

interface WorkoutSessionState {
  // Current workout context
  exerciseId: string | null;
  prescription: ExercisePrescription | null;
  sessionState: AdaptiveSessionState | null;
  
  // Readiness (from warmups)
  readinessResult: ReadinessCheckResult | null;
  warmupSets: WarmupSetData[];
  
  // Intra-workout adaptation
  setHistory: SetPerformance[];
  nextSetRecommendation: NextSetRecommendation | null;
  
  // Post-workout
  progressionDecision: ProgressionDecision | null;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startExercise: (exerciseId: string, prescription: ExercisePrescription) => Promise<void>;
  recordWarmupSet: (data: WarmupSetData) => ReadinessCheckResult | null;
  recordWorkSet: (performance: SetPerformance) => NextSetRecommendation;
  completeExercise: () => Promise<ProgressionDecision | null>;
  reset: () => void;
  
  // Persistence
  loadProgressionState: () => Promise<void>;
  saveProgressionState: () => Promise<void>;
  
  // Internal planning engines
  _readinessChecker: ReadinessChecker;
  _adaptiveEngine: AdaptiveEngine;
  _progressionEngine: ProgressionEngine;
  _initializeBaselines: (exerciseId: string) => Promise<void>;
}

// =============================================================================
// Store
// =============================================================================

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  devtools(
    (set, get) => ({
      exerciseId: null,
      prescription: null,
      sessionState: null,
      readinessResult: null,
      warmupSets: [],
      setHistory: [],
      nextSetRecommendation: null,
      progressionDecision: null,
      isLoading: false,
      error: null,
      
      // Planning engines
      _readinessChecker: new ReadinessChecker(),
      _adaptiveEngine: new AdaptiveEngine(),
      _progressionEngine: new ProgressionEngine(),
      
      startExercise: async (exerciseId, prescription) => {
        set({ isLoading: true, error: null });
        
        try {
          // Initialize baselines from history
          await get()._initializeBaselines(exerciseId);
          
          // Reset adaptive engine for this exercise
          const { _adaptiveEngine } = get();
          _adaptiveEngine.reset();
          
          // Create initial session state from prescription
          const sessionState = createSessionState(prescription);
          
          set({
            exerciseId,
            prescription,
            sessionState,
            readinessResult: null,
            warmupSets: [],
            setHistory: [],
            nextSetRecommendation: null,
            progressionDecision: null,
            isLoading: false,
          });
        } catch (e) {
          set({ 
            error: `Failed to start exercise: ${e}`, 
            isLoading: false 
          });
        }
      },
      
      recordWarmupSet: (data) => {
        const { exerciseId, prescription, _readinessChecker, warmupSets } = get();
        if (!exerciseId || !prescription) return null;
        
        // Add to warmup history
        const updatedWarmups = [...warmupSets, data];
        set({ warmupSets: updatedWarmups });
        
        // Check readiness using the warmup data
        const result = _readinessChecker.checkReadiness(
          exerciseId,
          data.weight,
          data.meanVelocity,
          prescription.weightLbs ?? 0
        );
        
        set({ readinessResult: result });
        return result;
      },
      
      recordWorkSet: (performance) => {
        const { 
          _adaptiveEngine, 
          prescription, 
          sessionState,
          setHistory,
        } = get();
        
        if (!prescription || !sessionState) {
          throw new Error('No active exercise session');
        }
        
        // Record set in adaptive engine and get recommendation
        const recommendation = _adaptiveEngine.getNextSetRecommendation(
          prescription,
          sessionState,
          performance
        );
        
        // Update session state
        const updatedHistory = [...setHistory, performance];
        const updatedSessionState: AdaptiveSessionState = {
          ...sessionState,
          setsCompleted: sessionState.setsCompleted + 1,
          totalReps: sessionState.totalReps + performance.reps,
          adjustedWeight: recommendation.weight,
          avgVelocityLoss: calculateAvgVelocityLoss(updatedHistory),
          avgRir: calculateAvgRir(updatedHistory),
          setAdjustments: sessionState.setAdjustments,
        };
        
        set({
          setHistory: updatedHistory,
          sessionState: updatedSessionState,
          nextSetRecommendation: recommendation,
        });
        
        return recommendation;
      },
      
      completeExercise: async () => {
        const { 
          exerciseId, 
          prescription, 
          sessionState,
          _progressionEngine,
        } = get();
        
        if (!exerciseId || !prescription || !sessionState) {
          return null;
        }
        
        // Create session summary for progression tracking
        const summary = createSessionSummary(sessionState, prescription);
        
        // Record session in progression engine
        _progressionEngine.recordSession(summary);
        
        // Get progression decision for next workout
        const decision = _progressionEngine.getProgressionDecision(
          prescription,
          sessionState
        );
        
        // Save progression state
        await get().saveProgressionState();
        
        set({ progressionDecision: decision });
        return decision;
      },
      
      reset: () => {
        const { _adaptiveEngine } = get();
        _adaptiveEngine.reset();
        
        set({
          exerciseId: null,
          prescription: null,
          sessionState: null,
          readinessResult: null,
          warmupSets: [],
          setHistory: [],
          nextSetRecommendation: null,
          progressionDecision: null,
          error: null,
        });
      },
      
      loadProgressionState: async () => {
        set({ isLoading: true });
        
        try {
          const rawState = await progressionRepository.getRawState();
          if (rawState) {
            const { _progressionEngine } = get();
            _progressionEngine.importState(rawState);
          }
        } catch (e) {
          console.warn('[WorkoutSession] Failed to load progression state:', e);
        } finally {
          set({ isLoading: false });
        }
      },
      
      saveProgressionState: async () => {
        try {
          const { _progressionEngine } = get();
          const state = _progressionEngine.exportState();
          await progressionRepository.saveRawState(state);
        } catch (e) {
          console.warn('[WorkoutSession] Failed to save progression state:', e);
        }
      },
      
      _initializeBaselines: async (exerciseId) => {
        const { _readinessChecker } = get();
        
        // Get computed baselines from HistoryStore
        const baseline = await useHistoryStore.getState().getVelocityBaseline(exerciseId);
        
        if (baseline) {
          // Load baselines into ReadinessChecker
          for (const point of baseline.dataPoints) {
            _readinessChecker.setBaseline(exerciseId, point.weight, point.velocity);
          }
        }
      },
    }),
    { name: 'workout-session-store' }
  )
);

// =============================================================================
// Helpers
// =============================================================================

function calculateAvgVelocityLoss(sets: SetPerformance[]): number {
  if (sets.length === 0) return 0;
  const total = sets.reduce((sum, s) => sum + s.velocityLossPercent, 0);
  return total / sets.length;
}

function calculateAvgRir(sets: SetPerformance[]): number {
  if (sets.length === 0) return 0;
  const total = sets.reduce((sum, s) => sum + s.estimatedRir, 0);
  return total / sets.length;
}
