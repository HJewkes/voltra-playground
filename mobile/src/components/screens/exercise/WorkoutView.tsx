/**
 * WorkoutView — SetLog with active telemetry, charts, and rest display.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';

import type { PlannedSet, SetLogEntry } from '@/domain/workout';
import { SetLog } from '@/components/exercise';
import type { ActiveChartData } from '@/components/exercise/SetLog';
import type { ConfigSectionRef } from './ConfigSection';

export interface WorkoutViewProps {
  configRef: React.RefObject<ConfigSectionRef | null>;
  setLog: SetLogEntry[];
  isActive: boolean;
  isRecording: boolean;
  uiState: string;
  plannedSetCount: number;
  currentSetIndex: number;
  repCount: number;
  weight: number;
  currentPlannedSet: PlannedSet | null;
  liveSamples: ActiveChartData["samples"];
  rpe: number;
  rir: number;
  currentPhase: number;
  phaseElapsedMs: number;
  repPhaseDurations: { phase: number; durationMs: number }[];
  liveMessage: string | null;
  meanVelocity: number;
  velocityLoss: number;
  plannedSets: PlannedSet[];
  totalSets: number | null;
  exerciseSetupNotes: string | undefined;
  restElapsedMs: number;
  defaultRestSeconds: number | undefined;
  onPlannedRestChange: (setIdx: number, secs: number) => void;
}

export function WorkoutView({
  configRef,
  setLog,
  isActive,
  isRecording,
  uiState,
  plannedSetCount,
  currentSetIndex,
  repCount,
  weight,
  currentPlannedSet,
  liveSamples,
  rpe,
  rir,
  currentPhase,
  phaseElapsedMs,
  repPhaseDurations,
  liveMessage,
  meanVelocity,
  velocityLoss,
  plannedSets,
  totalSets,
  exerciseSetupNotes,
  restElapsedMs,
  defaultRestSeconds,
  onPlannedRestChange,
}: WorkoutViewProps) {
  const showSetLog = setLog.length > 0 || isActive || uiState === 'resting' || plannedSetCount > 0;

  const expectedSetDurationMs = useMemo(() => {
    const targets = configRef.current?.getTargets();
    const tempo = currentPlannedSet?.targetTempo ?? (targets?.tempoEnabled ? targets.targetTempo : null);
    const targetRepsForDisplay = currentPlannedSet?.targetReps ?? null;
    const isReps = (targets?.targetMode ?? 'reps') === 'reps';
    const reps = targetRepsForDisplay ?? (targets?.effortEnabled && isReps ? targets.targetReps : 10);
    if (tempo && (tempo.concentric > 0 || tempo.eccentric > 0)) {
      const repMs = ((tempo.concentric || 2) + (tempo.pauseTop || 0.5) + (tempo.eccentric || 3) + (tempo.pauseBottom || 1)) * 1000;
      return reps * repMs;
    }
    return 30_000;
  }, [configRef, currentPlannedSet]);

  if (!showSetLog) return null;

  return (
    <>
      <View className="mt-3" />
      <SetLog
        setLog={setLog}
        activeSet={isActive ? {
          setIndex: currentSetIndex,
          repCount,
          weight: currentPlannedSet?.weight ?? weight,
          targetReps: currentPlannedSet?.targetReps ?? null,
        } : null}
        activeChart={isRecording ? {
          samples: liveSamples,
          expectedDurationMs: expectedSetDurationMs,
        } : null}
        activeTelemetry={isRecording ? {
          rpe, rir, currentPhase, phaseElapsedMs, repPhaseDurations,
          targetTempo: currentPlannedSet?.targetTempo,
          liveMessage: liveMessage || undefined,
          meanVelocity, velocityLoss,
        } : null}
        plannedSets={plannedSets}
        totalSets={totalSets}
        exerciseSetupNotes={exerciseSetupNotes}
        isResting={uiState === 'resting'}
        restElapsedMs={restElapsedMs}
        defaultRestSeconds={defaultRestSeconds}
        onPlannedRestChange={onPlannedRestChange}
      />
    </>
  );
}
