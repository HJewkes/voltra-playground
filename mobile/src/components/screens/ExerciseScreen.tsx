/**
 * ExerciseScreen
 *
 * Unified screen for standard and discovery exercise sessions.
 * Renders different content based on ExerciseSessionUIState.
 *
 * State → UI mapping:
 * - preparing: "Setting weight..." spinner
 * - ready: SetTargetCard + START button
 * - countdown: 3-2-1 countdown display
 * - recording: Rep counter + velocity (auto-stops)
 * - processing: Brief spinner
 * - resting: Rest timer + next set preview
 * - results: RecommendationCard (discovery) or ExerciseSessionSummaryCard (standard)
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useStore } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSemanticColors } from '@titan-design/react-ui';

// Domain imports
import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan } from '@/domain/workout';

// Store imports
import { createExerciseSessionStore, createRecordingStore, type VoltraStoreApi } from '@/stores';

// Data imports
import type { ExerciseSessionRepository } from '@/data/exercise-session';

// Component imports
import { RecordingDisplayView, LiveMetrics } from '@/components/recording';
import { RecommendationCard } from '@/components/planning';
import {
  SetTargetCard,
  ExerciseSessionProgress,
  ExerciseSessionSummaryCard,
  ExerciseSessionActionButtons,
} from '@/components/exercise';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface ExerciseScreenProps {
  /** Exercise to perform */
  exercise: Exercise;
  /** Plan for the session */
  plan: ExercisePlan;
  /** Voltra store for device control */
  voltraStore: VoltraStoreApi;
  /** Repository for persistence */
  repository: ExerciseSessionRepository;
  /** Called when session is complete and user is done */
  onComplete?: () => void;
  /** Called to start a new session */
  onNewSession?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ExerciseScreen - main screen for exercise session execution.
 */
export function ExerciseScreen({
  exercise,
  plan,
  voltraStore,
  repository,
  onComplete,
  onNewSession,
}: ExerciseScreenProps) {
  // Create stores
  const sessionStore = useMemo(() => createExerciseSessionStore(), []);
  const recordingStore = useMemo(() => createRecordingStore(), []);

  // Subscribe to session state
  const uiState = useStore(sessionStore, (s) => s.uiState);
  const session = useStore(sessionStore, (s) => s.session);
  const currentSetIndex = useStore(sessionStore, (s) => s.currentSetIndex);
  const currentPlannedSet = useStore(sessionStore, (s) => s.currentPlannedSet);
  const restCountdown = useStore(sessionStore, (s) => s.restCountdown);
  const startCountdown = useStore(sessionStore, (s) => s.startCountdown);
  const isDiscovery = useStore(sessionStore, (s) => s.isDiscovery);
  const terminationReason = useStore(sessionStore, (s) => s.terminationReason);
  const terminationMessage = useStore(sessionStore, (s) => s.terminationMessage);
  const recommendation = useStore(sessionStore, (s) => s.recommendation);
  const error = useStore(sessionStore, (s) => s.error);

  // Subscribe to recording state
  const repCount = useStore(recordingStore, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(recordingStore, (s) => s.lastRepPeakVelocity);
  const lastSet = useStore(recordingStore, (s) => s.lastSet);
  const _recordingUIState = useStore(recordingStore, (s) => s.uiState);

  // Initialize session on mount
  useEffect(() => {
    // Bind stores
    sessionStore.getState().bindRecordingStore(recordingStore);
    sessionStore.getState().bindVoltraStore(voltraStore);
    sessionStore.getState().bindRepository(repository);

    // Start session
    sessionStore.getState().startSession(exercise, plan);

    // Prepare first set
    sessionStore.getState().prepareFirstSet();
  }, [exercise, plan, voltraStore, repository, sessionStore, recordingStore]);

  // Sync recording store UI state based on session state
  useEffect(() => {
    if (uiState === 'countdown') {
      recordingStore.getState().setUIState('countdown');
    } else if (uiState === 'recording') {
      recordingStore.getState().setUIState('recording');
    } else if (uiState === 'resting') {
      recordingStore.getState().setUIState('resting');
    } else {
      recordingStore.getState().setUIState('idle');
    }
  }, [uiState, recordingStore]);

  // Connect voltra telemetry to recording store
  // Subscribe to currentSample changes from the voltra store
  useEffect(() => {
    if (uiState !== 'recording') return;

    // Subscribe to store updates
    const unsubscribe = voltraStore.subscribe((state, prevState) => {
      // Only process if we have a new sample
      if (state.currentSample && state.currentSample !== prevState.currentSample) {
        recordingStore.getState().processSample(state.currentSample);
      }
    });

    return unsubscribe;
  }, [voltraStore, recordingStore, uiState]);

  // Handle set completion from recording store
  useEffect(() => {
    if (lastSet && uiState === 'recording') {
      sessionStore.getState().onSetCompleted(lastSet);
    }
  }, [lastSet, uiState, sessionStore]);

  // Handlers
  const handleStart = () => {
    sessionStore.getState().startFirstSet();
  };

  const handleSkipRest = () => {
    sessionStore.getState().skipRest();
  };

  const handleStopAndSave = () => {
    sessionStore.getState().stopSession();
  };

  const handleManualStop = () => {
    console.log('[ExerciseScreen] handleManualStop called');
    sessionStore.getState().manualStopRecording();
  };

  const handleCancel = () => {
    // Stop any device activity and go back
    voltraStore.getState().stopRecording().catch(() => {});
    onComplete?.();
  };

  // Map session UI state to recording display UI state
  const displayUIState =
    uiState === 'recording'
      ? 'recording'
      : uiState === 'countdown'
        ? 'countdown'
        : uiState === 'resting'
          ? 'resting'
          : 'idle';

  // Results need scrolling, other states use flex layout
  if (uiState === 'results') {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {session &&
            (isDiscovery && recommendation ? (
              <RecommendationCard
                recommendation={{
                  workingWeight: recommendation.workingWeight,
                  repRange: recommendation.repRange,
                  warmupSets: recommendation.warmupSets.map((s) => ({
                    weight: s.weight,
                    reps: s.reps,
                    purpose: s.purpose ?? 'warmup',
                    restSeconds: s.restSeconds ?? 90,
                  })),
                  confidence: recommendation.confidence,
                  explanation: recommendation.explanation,
                  estimated1RM: recommendation.estimated1RM,
                  profile: recommendation.profile,
                }}
                exerciseId={exercise.id}
                goal={plan.goal!}
                onStartTraining={onNewSession}
                onDiscoverAnother={onComplete}
              />
            ) : (
              <ExerciseSessionSummaryCard
                session={session}
                terminationReason={terminationReason}
                terminationMessage={terminationMessage}
                onNewSession={onNewSession}
                onDone={onComplete}
              />
            ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-4 pt-2">
        {/* Progress indicator with exercise name */}
        {session && (
          <ExerciseSessionProgress
            exerciseName={exercise.name}
            plannedSets={plan.sets}
            completedSets={session.completedSets}
            currentSetIndex={currentSetIndex}
            isDiscovery={isDiscovery}
            error={error}
          />
        )}

        {/* Main content area - fills remaining space */}
        <View className="flex-1 justify-center" style={{ overflow: 'hidden' }}>
          {/* Preparing state */}
          {uiState === 'preparing' && (
            <View className="items-center">
              <ActivityIndicator size="large" color={t['brand-primary']} />
              <Text className="mt-4 text-text-disabled">Setting weight...</Text>
            </View>
          )}

          {/* Ready state */}
          {uiState === 'ready' && currentPlannedSet && (
            <SetTargetCard
              setNumber={currentSetIndex + 1}
              totalSets={plan.sets.length}
              plannedSet={currentPlannedSet}
              isDiscovery={isDiscovery}
            />
          )}

          {/* Countdown / Recording / Resting states */}
          {(uiState === 'countdown' || uiState === 'recording' || uiState === 'resting') && (
            <View>
              <RecordingDisplayView
                uiState={displayUIState}
                instruction={
                  uiState === 'recording' ? 'Lift!' : uiState === 'countdown' ? 'Get Ready' : 'Rest'
                }
                subInstruction={
                  currentPlannedSet
                    ? `${currentPlannedSet.weight} lbs × ${currentPlannedSet.targetReps} reps`
                    : undefined
                }
                targetReps={currentPlannedSet?.targetReps}
                restCountdown={restCountdown}
                startCountdown={startCountdown}
                repCount={repCount}
                lastRepPeakVelocity={lastRepPeakVelocity}
                onSkipRest={handleSkipRest}
              />

              {/* Live metrics during recording */}
              {uiState === 'recording' && (
                <LiveMetrics store={recordingStore} style={{ marginTop: 16 }} />
              )}
            </View>
          )}

          {/* Processing state */}
          {uiState === 'processing' && (
            <View className="items-center">
              <ActivityIndicator size="large" color={t['brand-primary']} />
              <Text className="mt-4 text-text-disabled">Processing...</Text>
            </View>
          )}
        </View>

        {/* Action buttons - pinned to bottom */}
        <View className="pb-4 pt-2" style={{ zIndex: 10 }}>
          <ExerciseSessionActionButtons
            uiState={uiState}
            onStart={handleStart}
            onSkipRest={handleSkipRest}
            onStopAndSave={handleStopAndSave}
            onManualStop={handleManualStop}
            onCancel={handleCancel}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
