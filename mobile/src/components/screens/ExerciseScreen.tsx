/**
 * ExerciseScreen
 *
 * Unified screen for standard and discovery exercise sessions.
 * Renders different content based on ExerciseSessionUIState.
 *
 * State x UI mapping:
 * - preparing: "Setting weight..." spinner
 * - ready: DiscoveryStepCard (discovery) or SetTargetCard (standard) + START button
 * - countdown: 3-2-1 countdown display
 * - recording: Rep counter + velocity (auto-stops)
 * - processing: Brief spinner
 * - resting: Rest timer + next set preview
 * - results: RecommendationCard + DiscoveryProfileSummary (discovery) or ExerciseSessionSummaryCard (standard)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { getSemanticColors } from '@titan-design/react-ui';

// Domain imports
import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan } from '@/domain/workout';
import { TrainingGoal } from '@/domain/planning';

// Store imports
import {
  exerciseSessionStore,
  useExerciseSessionStore,
  recordingStore,
  useRecordingStore,
  type VoltraStoreApi,
} from '@/stores';

// Hook imports
import { useDiscoverySession } from '@/hooks/use-discovery-session';
import { useExerciseProgression } from '@/hooks/use-exercise-progression';

// Data imports
import type { ExerciseSessionRepository } from '@/data/exercise-session';

// Component imports
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
  ProgressionCard,
  LastSessionBanner,
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
  // Subscribe to session core state (ui phase, active set, discovery flag, error)
  const { uiState, session, currentSetIndex, currentPlannedSet, isDiscovery, error } =
    useExerciseSessionStore(
      useShallow((s) => ({
        uiState: s.uiState,
        session: s.session,
        currentSetIndex: s.currentSetIndex,
        currentPlannedSet: s.currentPlannedSet,
        isDiscovery: s.isDiscovery,
        error: s.error,
      })),
    );

  // Subscribe to session timing and results state
  const { restCountdown, startCountdown, terminationReason, terminationMessage, recommendation } =
    useExerciseSessionStore(
      useShallow((s) => ({
        restCountdown: s.restCountdown,
        startCountdown: s.startCountdown,
        terminationReason: s.terminationReason,
        terminationMessage: s.terminationMessage,
        recommendation: s.recommendation,
      })),
    );

  // Subscribe to recording state (module-level singleton)
  const { repCount, lastRepPeakVelocity, lastSet } = useRecordingStore(
    useShallow((s) => ({
      repCount: s.repCount,
      lastRepPeakVelocity: s.lastRepPeakVelocity,
      lastSet: s.lastSet,
    })),
  );

  // Progression tracking - compare against previous sessions
  const { progression, lastSession } = useExerciseProgression(exercise.id, repository);

  // Discovery session hook - adaptive step-by-step guidance
  const exerciseType = exercise.movementPattern === 'isolation' ? 'isolation' : 'compound';
  const discoveryGoal = plan.goal ?? TrainingGoal.HYPERTROPHY;
  const { state: discoveryState, actions: discoveryActions } = useDiscoverySession(
    exercise.id,
    exerciseType as 'compound' | 'isolation',
    discoveryGoal
  );

  // Track whether discovery has been initialized
  const discoveryInitializedRef = useRef(false);

  // Initialize discovery on mount for discovery sessions
  useEffect(() => {
    if (isDiscovery && !discoveryInitializedRef.current) {
      discoveryInitializedRef.current = true;
      discoveryActions.initialize();
    }
  }, [isDiscovery, discoveryActions]);

  // Feed completed sets into the discovery hook
  useEffect(() => {
    if (!isDiscovery || !lastSet || uiState !== 'recording') return;
    discoveryActions.recordSet(lastSet);
  }, [isDiscovery, lastSet, uiState, discoveryActions]);

  // Initialize session on mount, dispose on unmount
  useEffect(() => {
    // Bind stores
    exerciseSessionStore.getState().bindRecordingStore(recordingStore);
    exerciseSessionStore.getState().bindVoltraStore(voltraStore);
    exerciseSessionStore.getState().bindRepository(repository);

    // Start session
    exerciseSessionStore.getState().startSession(exercise, plan);

    // Prepare first set
    exerciseSessionStore.getState().prepareFirstSet();

    return () => {
      discoveryInitializedRef.current = false;
      exerciseSessionStore.getState().dispose();
    };
  }, [exercise, plan, voltraStore, repository]);

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
  }, [uiState]);

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
  }, [voltraStore, uiState]);

  // Handle set completion from recording store
  useEffect(() => {
    if (lastSet && uiState === 'recording') {
      exerciseSessionStore.getState().onSetCompleted(lastSet);
    }
  }, [lastSet, uiState]);

  // Handlers
  const handleStart = () => {
    exerciseSessionStore.getState().startFirstSet();
  };

  const handleSkipRest = () => {
    exerciseSessionStore.getState().skipRest();
  };

  const handleStopAndSave = () => {
    exerciseSessionStore.getState().stopSession();
  };

  const handleManualStop = () => {
    console.log('[ExerciseScreen] handleManualStop called');
    exerciseSessionStore.getState().manualStopRecording();
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

  // Discovery-aware current step
  const hasDiscoveryStep =
    isDiscovery && discoveryState.currentStep && discoveryState.uiPhase === 'active';

  // Results need scrolling, other states use flex layout
  if (uiState === 'results') {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {session &&
            (isDiscovery && recommendation ? (
              <>
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
                {discoveryState.completedResults.length > 0 && (
                  <DiscoveryProfileSummary
                    completedSets={discoveryState.completedResults}
                    estimated1RM={recommendation.estimated1RM}
                    confidence={recommendation.confidence}
                  />
                )}
              </>
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

          {/* Ready state - discovery uses adaptive DiscoveryStepCard */}
          {uiState === 'ready' &&
            currentPlannedSet &&
            (hasDiscoveryStep ? (
              <DiscoveryStepCard
                step={discoveryState.currentStep!}
                phase={discoveryState.discoveryState.phase}
                completedCount={discoveryState.completedResults.length}
              />
            ) : (
              <>
                {lastSession && currentSetIndex === 0 && (
                  <LastSessionBanner
                    exerciseName={lastSession.exerciseName}
                    date={lastSession.date}
                    weight={lastSession.weight}
                    velocity={lastSession.velocity}
                    sets={lastSession.sets}
                    reps={lastSession.reps}
                  />
                )}
                <SetTargetCard
                  setNumber={currentSetIndex + 1}
                  totalSets={plan.sets.length}
                  plannedSet={currentPlannedSet}
                  isDiscovery={isDiscovery}
                />
              </>
            ))}

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

              {/* Progression comparison during rest */}
              {uiState === 'resting' && progression && (
                <View style={{ marginTop: 12 }}>
                  <ProgressionCard progression={progression} />
                </View>
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
