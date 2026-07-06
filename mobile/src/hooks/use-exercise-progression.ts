/**
 * useExerciseProgression
 *
 * Loads progression comparison data for an exercise from session history.
 * Fetches on mount and provides progression + last session banner data.
 */

import { useState, useEffect } from 'react';
import type { ExerciseSessionRepository } from '@/data/exercise-session';
import {
  computeProgressionFromHistory,
  buildLastSessionBanner,
  type ExerciseProgression,
  type LastSessionBanner,
} from '@/domain/history/services/progression-service';

export interface UseExerciseProgressionReturn {
  progression: ExerciseProgression | null;
  lastSession: LastSessionBanner | null;
  isLoading: boolean;
}

/**
 * Hook to load and compute exercise progression data.
 *
 * @param exerciseId - The exercise to fetch history for
 * @param repository - Session repository for data access
 */
export function useExerciseProgression(
  exerciseId: string,
  repository: ExerciseSessionRepository
): UseExerciseProgressionReturn {
  const [progression, setProgression] = useState<ExerciseProgression | null>(null);
  const [lastSession, setLastSession] = useState<LastSessionBanner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessions = await repository.getByExercise(exerciseId);
        if (cancelled) return;

        setProgression(computeProgressionFromHistory(sessions, exerciseId));
        setLastSession(buildLastSessionBanner(sessions, exerciseId));
      } catch (err) {
        console.warn('[useExerciseProgression] Failed to load:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, repository]);

  return { progression, lastSession, isLoading };
}
