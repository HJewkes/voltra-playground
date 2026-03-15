/**
 * WorkoutView — SetLog with active telemetry, charts, rest display, and coaching cues.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors } from '@titan-design/react-ui';

import type { PlannedSet, SetLogEntry } from '@/domain/workout';
import { SetLog, LoadSuggestionCard, VelocityWarning, JunkVolumeAlert } from '@/components/exercise';
import type { ActiveChartData } from '@/components/exercise/SetLog';
import type { AutoRegulationState } from '@/domain/planning/auto-regulation';
import { CoachingCueCard } from '@/components/coaching/CoachingCueCard';
import { CoachingSessionLog } from '@/components/coaching/CoachingSessionLog';
import { useCoachingStore, coachingStore } from '@/stores/coaching-store';
import type { AthleteReaction } from '@/stores/coaching-store';
import { speakCue, stopSpeaking } from '@/domain/notifications';
import { isVoiceCoachingEnabled } from '@/data/preferences';
import type { ConfigSectionRef } from './ConfigSection';

const t = getSemanticColors('dark');

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
  autoRegulation: AutoRegulationState | null;
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
  autoRegulation,
}: WorkoutViewProps) {
  const activeCue = useCoachingStore((s) => s.activeCue);
  const sessionLog = useCoachingStore((s) => s.sessionLog);
  const logVisible = useCoachingStore((s) => s.logVisible);
  const isResting = uiState === 'resting';

  // Flush queued cues when rest begins. Guard: never during recording.
  const prevUiStateRef = useRef(uiState);
  useEffect(() => {
    const enteredRest = uiState === 'resting' && prevUiStateRef.current !== 'resting';
    prevUiStateRef.current = uiState;
    if (enteredRest) coachingStore.getState().flushQueue();
  }, [uiState]);

  // Speak active cue via TTS when it becomes visible (if voice coaching is on).
  const prevCueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCue || activeCue.id === prevCueIdRef.current) return;
    prevCueIdRef.current = activeCue.id;

    isVoiceCoachingEnabled().then((enabled) => {
      if (enabled) speakCue(activeCue.message);
    });
  }, [activeCue]);

  // Stop speech when leaving rest so cues don't bleed into the next set.
  useEffect(() => {
    if (uiState !== 'resting') {
      stopSpeaking();
      prevCueIdRef.current = null;
    }
  }, [uiState]);

  const handleDismiss = useCallback(() => {
    coachingStore.getState().dismissActiveCue();
  }, []);

  const handleReact = useCallback((cueId: string, reaction: AthleteReaction) => {
    coachingStore.getState().reactToCue(cueId, reaction);
  }, []);

  const handleToggleLog = useCallback(() => {
    coachingStore.getState().toggleLog();
  }, []);

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
      {isResting && autoRegulation && (
        <View style={{ gap: 8, marginTop: 8 }}>
          {autoRegulation.velocityWarning && (
            <VelocityWarning warning={autoRegulation.velocityWarning} />
          )}
          {autoRegulation.junkVolumeAlert && (
            <JunkVolumeAlert alert={autoRegulation.junkVolumeAlert} />
          )}
          {autoRegulation.loadSuggestion && (
            <LoadSuggestionCard suggestion={autoRegulation.loadSuggestion} />
          )}
        </View>
      )}
      {isResting && activeCue && (
        <View className="mt-2">
          <CoachingCueCard cue={activeCue} onDismiss={handleDismiss} onReact={handleReact} />
        </View>
      )}
      {isResting && sessionLog.length > 0 && (
        <TouchableOpacity
          className="mt-2 flex-row items-center self-end"
          onPress={handleToggleLog}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="View coaching log"
          accessibilityRole="button"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={t['text-tertiary']} />
        </TouchableOpacity>
      )}
      <CoachingSessionLog
        visible={logVisible}
        entries={sessionLog}
        onClose={handleToggleLog}
      />
    </>
  );
}
