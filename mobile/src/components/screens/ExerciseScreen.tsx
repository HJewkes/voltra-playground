/**
 * ExerciseScreen
 *
 * Unified screen for standard and discovery exercise sessions.
 * Renders different content based on ExerciseSessionUIState.
 *
 * State x UI mapping:
 * - preparing: "Setting weight..." spinner
 * - ready: DiscoveryStepCard (discovery) or SetTargetCard (standard) + START
 * - countdown: 3-2-1 countdown display
 * - recording: Rep counter + velocity (auto-stops)
 * - processing: Brief spinner
 * - resting: Rest timer + next set preview
 * - results: Recommendation + Profile (discovery) or Summary (standard)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSemanticColors } from '@titan-design/react-ui';

import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan } from '@/domain/workout';
import { TrainingGoal } from '@/domain/planning';
import {
  exerciseSessionStore,
  useExerciseSessionStore,
  recordingStore,
  useRecordingStore,
  type VoltraStoreApi,
} from '@/stores';
import { useDiscoverySession } from '@/hooks/usediscoverysession';
import type { ExerciseSessionRepository } from '@/data/exercise-session';
import { RecordingDisplayView, LiveMetrics } from '@/components/recording';
import {
  RecommendationCard,
  DiscoveryStepCard,
  DiscoveryProfileSummary,
} from '@/components/planning';
import {
  SetTargetCard,
  ExerciseSessionProgress,
  ExerciseSessionSummaryCard,
  ExerciseSessionActionButtons,
} from '@/components/exercise';

const t = getSemanticColors('dark');

export interface ExerciseScreenProps {
  exercise: Exercise;
  plan: ExercisePlan;
  voltraStore: VoltraStoreApi;
  repository: ExerciseSessionRepository;
  onComplete?: () => void;
  onNewSession?: () => void;
}

export function ExerciseScreen({
  exercise, plan, voltraStore, repository, onComplete, onNewSession,
}: ExerciseScreenProps) {
  const uiState = useExerciseSessionStore((s) => s.uiState);
  const session = useExerciseSessionStore((s) => s.session);
  const currentSetIndex = useExerciseSessionStore((s) => s.currentSetIndex);
  const currentPlannedSet = useExerciseSessionStore((s) => s.currentPlannedSet);
  const restCountdown = useExerciseSessionStore((s) => s.restCountdown);
  const startCountdown = useExerciseSessionStore((s) => s.startCountdown);
  const isDiscovery = useExerciseSessionStore((s) => s.isDiscovery);
  const terminationReason = useExerciseSessionStore((s) => s.terminationReason);
  const terminationMessage = useExerciseSessionStore((s) => s.terminationMessage);
  const recommendation = useExerciseSessionStore((s) => s.recommendation);
  const error = useExerciseSessionStore((s) => s.error);
  const repCount = useRecordingStore((s) => s.repCount);
  const lastRepPeakVelocity = useRecordingStore((s) => s.lastRepPeakVelocity);
  const lastSet = useRecordingStore((s) => s.lastSet);

  const exType = exercise.movementPattern === 'isolation' ? 'isolation' : 'compound';
  const goal = plan.goal ?? TrainingGoal.HYPERTROPHY;
  const { state: disc, actions: discActions } = useDiscoverySession(
    exercise.id, exType as 'compound' | 'isolation', goal
  );

  const discInitRef = useRef(false);

  useEffect(() => {
    if (isDiscovery && !discInitRef.current) {
      discInitRef.current = true;
      discActions.initialize();
    }
  }, [isDiscovery, discActions]);

  useEffect(() => {
    if (!isDiscovery || !lastSet || uiState !== 'recording') return;
    discActions.recordSet(lastSet);
  }, [isDiscovery, lastSet, uiState, discActions]);

  useEffect(() => {
    exerciseSessionStore.getState().bindRecordingStore(recordingStore);
    exerciseSessionStore.getState().bindVoltraStore(voltraStore);
    exerciseSessionStore.getState().bindRepository(repository);
    exerciseSessionStore.getState().startSession(exercise, plan);
    exerciseSessionStore.getState().prepareFirstSet();
    return () => {
      discInitRef.current = false;
      exerciseSessionStore.getState().dispose();
    };
  }, [exercise, plan, voltraStore, repository]);

  useEffect(() => {
    const mapping: Record<string, string> = {
      countdown: 'countdown', recording: 'recording', resting: 'resting',
    };
    recordingStore.getState().setUIState(mapping[uiState] ?? 'idle');
  }, [uiState]);

  useEffect(() => {
    if (uiState !== 'recording') return;
    const unsub = voltraStore.subscribe((s, prev) => {
      if (s.currentSample && s.currentSample !== prev.currentSample) {
        recordingStore.getState().processSample(s.currentSample);
      }
    });
    return unsub;
  }, [voltraStore, uiState]);

  useEffect(() => {
    if (lastSet && uiState === 'recording') {
      exerciseSessionStore.getState().onSetCompleted(lastSet);
    }
  }, [lastSet, uiState]);

  const handleStart = () => exerciseSessionStore.getState().startFirstSet();
  const handleSkipRest = () => exerciseSessionStore.getState().skipRest();
  const handleStop = () => exerciseSessionStore.getState().stopSession();
  const handleManualStop = () => exerciseSessionStore.getState().manualStopRecording();
  const handleCancel = () => {
    voltraStore.getState().stopRecording().catch(() => {});
    onComplete?.();
  };

  const dispUI = uiState === 'recording' ? 'recording'
    : uiState === 'countdown' ? 'countdown'
      : uiState === 'resting' ? 'resting' : 'idle';

  const hasDiscStep = isDiscovery && disc.currentStep && disc.uiPhase === 'active';

  if (uiState === 'results') {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {session && (isDiscovery && recommendation ? (
            <>
              <RecommendationCard
                recommendation={{
                  workingWeight: recommendation.workingWeight,
                  repRange: recommendation.repRange,
                  warmupSets: recommendation.warmupSets.map((s) => ({
                    weight: s.weight, reps: s.reps,
                    purpose: s.purpose ?? 'warmup', restSeconds: s.restSeconds ?? 90,
                  })),
                  confidence: recommendation.confidence,
                  explanation: recommendation.explanation,
                  estimated1RM: recommendation.estimated1RM,
                  profile: recommendation.profile,
                }}
                exerciseId={exercise.id} goal={plan.goal!}
                onStartTraining={onNewSession} onDiscoverAnother={onComplete}
              />
              {disc.completedResults.length > 0 && (
                <DiscoveryProfileSummary
                  completedSets={disc.completedResults}
                  estimated1RM={recommendation.estimated1RM}
                  confidence={recommendation.confidence}
                />
              )}
            </>
          ) : (
            <ExerciseSessionSummaryCard
              session={session} terminationReason={terminationReason}
              terminationMessage={terminationMessage}
              onNewSession={onNewSession} onDone={onComplete}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-4 pt-2">
        {session && (
          <ExerciseSessionProgress
            exerciseName={exercise.name} plannedSets={plan.sets}
            completedSets={session.completedSets} currentSetIndex={currentSetIndex}
            isDiscovery={isDiscovery} error={error}
          />
        )}
        <View className="flex-1 justify-center" style={{ overflow: 'hidden' }}>
          {uiState === 'preparing' && (
            <View className="items-center">
              <ActivityIndicator size="large" color={t['brand-primary']} />
              <Text className="mt-4 text-text-disabled">Setting weight...</Text>
            </View>
          )}
          {uiState === 'ready' && currentPlannedSet && (hasDiscStep ? (
            <DiscoveryStepCard
              step={disc.currentStep!} phase={disc.discoveryState.phase}
              completedCount={disc.completedResults.length}
            />
          ) : (
            <SetTargetCard
              setNumber={currentSetIndex + 1} totalSets={plan.sets.length}
              plannedSet={currentPlannedSet} isDiscovery={isDiscovery}
            />
          ))}
          {(uiState === 'countdown' || uiState === 'recording' || uiState === 'resting') && (
            <View>
              <RecordingDisplayView
                uiState={dispUI}
                instruction={uiState === 'recording' ? 'Lift!' : uiState === 'countdown' ? 'Get Ready' : 'Rest'}
                subInstruction={currentPlannedSet ? `${currentPlannedSet.weight} lbs × ${currentPlannedSet.targetReps} reps` : undefined}
                targetReps={currentPlannedSet?.targetReps}
                restCountdown={restCountdown} startCountdown={startCountdown}
                repCount={repCount} lastRepPeakVelocity={lastRepPeakVelocity}
                onSkipRest={handleSkipRest}
              />
              {uiState === 'recording' && <LiveMetrics store={recordingStore} style={{ marginTop: 16 }} />}
            </View>
          )}
          {uiState === 'processing' && (
            <View className="items-center">
              <ActivityIndicator size="large" color={t['brand-primary']} />
              <Text className="mt-4 text-text-disabled">Processing...</Text>
            </View>
          )}
        </View>
        <View className="pb-4 pt-2" style={{ zIndex: 10 }}>
          <ExerciseSessionActionButtons
            uiState={uiState} onStart={handleStart} onSkipRest={handleSkipRest}
            onStopAndSave={handleStop} onManualStop={handleManualStop} onCancel={handleCancel}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
