/**
 * Discovery Store
 * 
 * Manages the weight discovery workflow state.
 * Uses the primary device from SessionStore for commands.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { discoveryRepository } from '@/data/repositories';
import type { 
  DiscoverySession, 
  DiscoverySetTelemetry,
  DiscoveryRecommendation as StoredDiscoveryRecommendation,
} from '@/data/models';
import type { RepData, WorkoutStats } from '@/protocol/telemetry';
import {
  WeightDiscoveryEngine,
  DiscoverySetResult,
  DiscoveryStep,
  DiscoveryRecommendation,
  TrainingGoal,
} from '@/planning';
import type { DiscoveryPhase, ExerciseType } from '@/planning';

// =============================================================================
// Types
// =============================================================================

type Goal = 'strength' | 'hypertrophy' | 'endurance';

interface DiscoveryState {
  // Current session
  session: DiscoverySession | null;
  engine: WeightDiscoveryEngine | null;
  
  // Workflow state
  phase: DiscoveryPhase;
  exercise: string | null;
  exerciseName: string | null;
  goal: Goal | null;
  currentStep: DiscoveryStep | null;
  
  // Progress
  completedSets: DiscoverySetTelemetry[];
  recommendation: StoredDiscoveryRecommendation | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  start: (exerciseId: string, exerciseName: string, goal: Goal) => DiscoveryStep;
  recordSet: (reps: RepData[], stats: WorkoutStats) => Promise<DiscoveryStep | StoredDiscoveryRecommendation>;
  skipSet: () => DiscoveryStep | StoredDiscoveryRecommendation | null;
  complete: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
  
  // Persistence
  loadCurrentSession: () => Promise<void>;
  saveCurrentSession: () => Promise<void>;
}

// =============================================================================
// Store
// =============================================================================

export const useDiscoveryStore = create<DiscoveryState>()(
  devtools(
    (set, get) => ({
      session: null,
      engine: null,
      phase: 'not_started' as DiscoveryPhase,
      exercise: null,
      exerciseName: null,
      goal: null,
      currentStep: null,
      completedSets: [],
      recommendation: null,
      isLoading: false,
      error: null,
      
      start: (exerciseId, exerciseName, goal) => {
        // Map goal to TrainingGoal enum
        const trainingGoal = mapGoalToTrainingGoal(goal);
        
        // Create engine
        const engine = new WeightDiscoveryEngine(
          exerciseId,
          'compound' as ExerciseType, // Default for now
          trainingGoal
        );
        
        // Get first step
        const firstStep = engine.getFirstStep();
        
        // Create session
        const session: DiscoverySession = {
          id: `discovery-${Date.now()}`,
          exerciseId,
          exerciseName,
          goal,
          startTime: Date.now(),
          endTime: null,
          completed: false,
          sets: [],
        };
        
        set({
          session,
          engine,
          phase: 'exploring' as DiscoveryPhase,
          exercise: exerciseId,
          exerciseName,
          goal,
          currentStep: firstStep,
          completedSets: [],
          recommendation: null,
          error: null,
        });
        
        // Save session
        get().saveCurrentSession();
        
        return firstStep;
      },
      
      recordSet: async (reps, stats) => {
        const { engine, session, completedSets } = get();
        if (!engine || !session) {
          throw new Error('No active discovery session');
        }
        
        const currentStep = get().currentStep;
        if (!currentStep) {
          throw new Error('No current step');
        }
        
        // Build set result for engine
        const result: DiscoverySetResult = {
          weight: currentStep.weight,
          reps: reps.length,
          meanVelocity: reps.length > 0 
            ? reps.reduce((sum, r) => sum + r.maxVelocity, 0) / reps.length 
            : 0,
          peakVelocity: Math.max(...reps.map(r => r.maxVelocity), 0),
          failed: reps.length < currentStep.targetReps,
        };
        
        // Record in engine and get next step or recommendation
        const nextResult = engine.recordSetAndGetNext(result);
        
        // Build telemetry record
        const setTelemetry: DiscoverySetTelemetry = {
          setNumber: completedSets.length + 1,
          weight: currentStep.weight,
          targetReps: currentStep.targetReps,
          actualReps: reps.length,
          meanVelocity: result.meanVelocity,
          peakVelocity: result.peakVelocity,
          failed: result.failed,
          timestamp: Date.now(),
          reps: reps.map(r => ({ ...r, frames: [] })), // Remove frames for storage
          stats: {
            avgPeakForce: stats.avgPeakForce,
            maxPeakForce: stats.maxPeakForce,
            avgRepDuration: stats.avgRepDuration,
          },
        };
        
        // Update session
        const updatedSets = [...completedSets, setTelemetry];
        const updatedSession = {
          ...session,
          sets: updatedSets,
        };
        
        // Check if we got a recommendation (complete) or next step
        if ('workingWeight' in nextResult) {
          // It's a recommendation
          const recommendation = nextResult as DiscoveryRecommendation;
          
          // Convert to stored format
          const storedRecommendation: StoredDiscoveryRecommendation = {
            warmupSequence: recommendation.warmupSets.map(s => ({
              weight: s.weight,
              reps: s.reps,
              restSeconds: 60,
            })),
            workingWeight: recommendation.workingWeight,
            repRange: recommendation.repRange,
            targetVelocity: 0, // Not provided directly
            confidence: recommendation.confidence,
            explanation: recommendation.explanation,
          };
          
          set({
            session: updatedSession,
            completedSets: updatedSets,
            phase: 'complete' as DiscoveryPhase,
            recommendation: storedRecommendation,
            currentStep: null,
          });
          
          // Save session
          get().saveCurrentSession();
          
          return storedRecommendation;
        }
        
        // It's a next step
        const nextStep = nextResult as DiscoveryStep;
        
        set({
          session: updatedSession,
          completedSets: updatedSets,
          phase: engine.getPhase(),
          currentStep: nextStep,
        });
        
        // Save session
        get().saveCurrentSession();
        
        return nextStep;
      },
      
      skipSet: () => {
        const { engine, currentStep } = get();
        if (!engine || !currentStep) return null;
        
        // Record a "skipped" set with zero data
        const result: DiscoverySetResult = {
          weight: currentStep.weight,
          reps: 0,
          meanVelocity: 0,
          peakVelocity: 0,
          failed: true,
          notes: 'Skipped',
        };
        
        const nextResult = engine.recordSetAndGetNext(result);
        
        // Check if we got a recommendation or next step
        if ('workingWeight' in nextResult) {
          const recommendation = nextResult as DiscoveryRecommendation;
          const storedRecommendation: StoredDiscoveryRecommendation = {
            warmupSequence: recommendation.warmupSets.map(s => ({
              weight: s.weight,
              reps: s.reps,
              restSeconds: 60,
            })),
            workingWeight: recommendation.workingWeight,
            repRange: recommendation.repRange,
            targetVelocity: 0,
            confidence: recommendation.confidence,
            explanation: recommendation.explanation,
          };
          set({
            phase: 'complete' as DiscoveryPhase,
            recommendation: storedRecommendation,
            currentStep: null,
          });
          return storedRecommendation;
        }
        
        const nextStep = nextResult as DiscoveryStep;
        set({ currentStep: nextStep, phase: engine.getPhase() });
        return nextStep;
      },
      
      complete: async () => {
        const { session, recommendation } = get();
        if (!session) return;
        
        // Finalize session
        const finalSession: DiscoverySession = {
          ...session,
          endTime: Date.now(),
          completed: true,
          recommendation: recommendation ?? undefined,
        };
        
        // Save to repository (permanent storage)
        await discoveryRepository.save(finalSession);
        
        // Clear current session
        await discoveryRepository.clearCurrentSession();
        
        set({
          session: finalSession,
          phase: 'complete' as DiscoveryPhase,
        });
      },
      
      cancel: async () => {
        // Clear current session from storage
        await discoveryRepository.clearCurrentSession();
        
        get().reset();
      },
      
      reset: () => {
        set({
          session: null,
          engine: null,
          phase: 'not_started' as DiscoveryPhase,
          exercise: null,
          exerciseName: null,
          goal: null,
          currentStep: null,
          completedSets: [],
          recommendation: null,
          error: null,
        });
      },
      
      loadCurrentSession: async () => {
        set({ isLoading: true });
        
        try {
          const session = await discoveryRepository.getCurrentSession();
          if (session && !session.completed) {
            // Restore session state
            set({
              session,
              exercise: session.exerciseId,
              exerciseName: session.exerciseName ?? null,
              goal: session.goal,
              completedSets: session.sets,
              phase: session.completed ? 'complete' as DiscoveryPhase : 'exploring' as DiscoveryPhase,
              recommendation: session.recommendation ?? null,
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },
      
      saveCurrentSession: async () => {
        const { session } = get();
        if (session) {
          await discoveryRepository.saveCurrentSession(session);
        }
      },
    }),
    { name: 'discovery-store' }
  )
);

// =============================================================================
// Helpers
// =============================================================================

function mapGoalToTrainingGoal(goal: Goal): TrainingGoal {
  switch (goal) {
    case 'strength':
      return TrainingGoal.STRENGTH;
    case 'hypertrophy':
      return TrainingGoal.HYPERTROPHY;
    case 'endurance':
      return TrainingGoal.ENDURANCE;
    default:
      return TrainingGoal.HYPERTROPHY;
  }
}
