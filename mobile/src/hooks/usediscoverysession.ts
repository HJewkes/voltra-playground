/**
 * useDiscoverySession Hook
 *
 * Bridges the adaptive discovery strategy (domain/planning/strategies/discovery)
 * into the exercise session UI. Manages DiscoveryState and provides
 * step-by-step guidance with velocity-based progression.
 *
 * The exercise-session-store handles recording and device control.
 * This hook layers discovery-specific logic on top:
 * - Tracking discovery phase (exploring -> dialing_in -> complete)
 * - Computing next step from velocity data after each set
 * - Building the LV profile and generating recommendations
 */

import { useState, useCallback, useMemo } from 'react';
import { getSetMeanVelocity, getSetPeakVelocity } from '@voltras/workout-analytics';

import type { DiscoveryStep, DiscoverySetResult, TrainingGoal } from '@/domain/planning';
import type {
  DiscoveryState,
  DiscoveryRecommendation,
  UserEstimate,
} from '@/domain/planning/strategies/discovery';
import {
  createDiscoveryState,
  getFirstDiscoveryStep,
  getNextDiscoveryStep,
} from '@/domain/planning/strategies/discovery';
import type { CompletedSet } from '@/domain/workout';

// =============================================================================
// Types
// =============================================================================

export type DiscoveryUIPhase = 'setup' | 'active' | 'complete';

export interface DiscoverySessionState {
  /** Current UI phase */
  uiPhase: DiscoveryUIPhase;
  /** Internal discovery state from the strategy */
  discoveryState: DiscoveryState;
  /** Current step to display */
  currentStep: DiscoveryStep | null;
  /** All completed discovery set results */
  completedResults: DiscoverySetResult[];
  /** Final recommendation (when complete) */
  recommendation: DiscoveryRecommendation | null;
}

export interface DiscoverySessionActions {
  /** Initialize discovery and get the first step */
  initialize: (userEstimate?: UserEstimate) => void;
  /** Record a completed set and advance to next step */
  recordSet: (completedSet: CompletedSet) => void;
  /** Reset to start over */
  reset: () => void;
}

export interface UseDiscoverySessionReturn {
  state: DiscoverySessionState;
  actions: DiscoverySessionActions;
}

// =============================================================================
// Hook
// =============================================================================

export function useDiscoverySession(
  exerciseId: string,
  exerciseType: 'compound' | 'isolation',
  goal: TrainingGoal
): UseDiscoverySessionReturn {
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(() =>
    createDiscoveryState(exerciseId, exerciseType, goal)
  );
  const [currentStep, setCurrentStep] = useState<DiscoveryStep | null>(null);
  const [completedResults, setCompletedResults] = useState<DiscoverySetResult[]>([]);
  const [recommendation, setRecommendation] = useState<DiscoveryRecommendation | null>(null);
  const [uiPhase, setUIPhase] = useState<DiscoveryUIPhase>('setup');

  const initialize = useCallback(
    (userEstimate?: UserEstimate) => {
      const freshState = createDiscoveryState(exerciseId, exerciseType, goal);
      const { step, updatedState } = getFirstDiscoveryStep(freshState, userEstimate);

      setDiscoveryState(updatedState);
      setCurrentStep(step);
      setCompletedResults([]);
      setRecommendation(null);
      setUIPhase('active');
    },
    [exerciseId, exerciseType, goal]
  );

  const recordSet = useCallback(
    (completedSet: CompletedSet) => {
      const meanVelocity = getSetMeanVelocity(completedSet.data);
      const peakVelocity = getSetPeakVelocity(completedSet.data);
      const reps = completedSet.data.reps.length;

      const setResult: DiscoverySetResult = {
        weight: completedSet.weight,
        reps,
        meanVelocity,
        peakVelocity,
        failed: reps === 0,
      };

      const result = getNextDiscoveryStep(discoveryState, setResult);
      const newResults = [...completedResults, setResult];

      setDiscoveryState(result.updatedState);
      setCompletedResults(newResults);

      if ('recommendation' in result) {
        setRecommendation(result.recommendation);
        setCurrentStep(null);
        setUIPhase('complete');
      } else {
        setCurrentStep(result.step);
      }
    },
    [discoveryState, completedResults]
  );

  const reset = useCallback(() => {
    const freshState = createDiscoveryState(exerciseId, exerciseType, goal);
    setDiscoveryState(freshState);
    setCurrentStep(null);
    setCompletedResults([]);
    setRecommendation(null);
    setUIPhase('setup');
  }, [exerciseId, exerciseType, goal]);

  const state = useMemo<DiscoverySessionState>(
    () => ({
      uiPhase,
      discoveryState,
      currentStep,
      completedResults,
      recommendation,
    }),
    [uiPhase, discoveryState, currentStep, completedResults, recommendation]
  );

  const actions = useMemo<DiscoverySessionActions>(
    () => ({ initialize, recordSet, reset }),
    [initialize, recordSet, reset]
  );

  return { state, actions };
}
