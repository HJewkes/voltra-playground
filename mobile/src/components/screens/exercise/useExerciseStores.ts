/**
 * useExerciseStores — encapsulates all Zustand store subscriptions
 * for the exercise screen, keeping the main component lean.
 */

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { createRecordingStore, createExerciseSessionStore } from '@/stores';
import type { VoltraStoreApi } from '@/stores/voltra-store';

export function useExerciseStores(voltraStore: VoltraStoreApi) {
  const recordingStore = useMemo(() => createRecordingStore(), []);
  const sessionStore = useMemo(() => createExerciseSessionStore(), []);

  const device = useStore(
    voltraStore,
    useShallow((s) => ({
      mode: s.mode,
      setMode: s.setMode,
      weight: s.weight,
      eccentric: s.eccentric,
      setEccentric: s.setEccentric,
      chains: s.chains,
      inverseChains: s.inverseChains,
      setChains: s.setChains,
      setInverseChains: s.setInverseChains,
    }))
  );

  const recording = useStore(
    recordingStore,
    useShallow((s) => ({
      repCount: s.repCount,
      rpe: s.rpe,
      rir: s.rir,
      liveMessage: s.liveMessage,
      currentPhase: s.currentPhase,
      phaseElapsedMs: s.phaseElapsedMs,
      repPhaseDurations: s.repPhaseDurations,
      liveSamples: s.liveSamples,
      meanVelocity: s.meanVelocity,
      velocityLoss: s.velocityLoss,
    }))
  );

  const session = useStore(
    sessionStore,
    useShallow((s) => ({
      uiState: s.uiState,
      setLog: s.setLog,
      restElapsedMs: s.restElapsedMs,
      currentSetIndex: s.currentSetIndex,
      currentPlannedSet: s.currentPlannedSet,
      session: s.session,
      autoRegulation: s.autoRegulation,
    }))
  );

  return { recordingStore, sessionStore, device, recording, session } as const;
}
