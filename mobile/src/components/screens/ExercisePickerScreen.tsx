/**
 * ExercisePickerScreen
 *
 * Entry point for starting a new exercise session.
 * Two modes: Standard (working weight) and Discovery (find working weight).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

// Domain imports
import { TrainingGoal } from '@/domain/planning';
import { type Exercise, getExercise } from '@/domain/exercise';
import { type ExercisePlan, createStandardPlan, createDiscoveryPlan } from '@/domain/workout';

// Component imports
import { Card, Stack, ActionButton, WeightPicker } from '@/components/ui';
import { ExerciseSelector, GoalPicker } from '@/components/planning';

// =============================================================================
// Types
// =============================================================================

type SessionMode = 'standard' | 'discovery';

export interface ExercisePickerScreenProps {
  /** Called when user starts a session */
  onStartSession: (exercise: Exercise, plan: ExercisePlan) => void;
  /** Called to go back */
  onBack?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ExercisePickerScreen - configure and start a new exercise session.
 */
export function ExercisePickerScreen({ onStartSession, onBack }: ExercisePickerScreenProps) {
  // Mode selection
  const [mode, setMode] = useState<SessionMode>('standard');

  // Exercise selection - default to 'general' for easier testing
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>('general');
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  // Standard mode settings
  const [workingWeight, setWorkingWeight] = useState(25);
  const [workingSets, setWorkingSets] = useState('3');
  const [workingReps, setWorkingReps] = useState('10');
  const [includeWarmups, setIncludeWarmups] = useState(false);

  // Discovery mode settings
  const [goal, setGoal] = useState<TrainingGoal>(TrainingGoal.HYPERTROPHY);
  const [estimatedMax, setEstimatedMax] = useState('');

  // Get selected exercise
  const selectedExercise = selectedExerciseId ? getExercise(selectedExerciseId) : null;

  // Validation
  const canStart =
    selectedExerciseId && (mode === 'discovery' || (mode === 'standard' && workingWeight > 0));

  // Handle exercise selection
  const handleSelectExercise = useCallback((exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setShowExerciseSelector(false);
  }, []);

  // Handle start session
  const handleStartSession = useCallback(() => {
    if (!selectedExercise) return;

    let plan: ExercisePlan;

    if (mode === 'standard') {
      plan = createStandardPlan({
        exerciseId: selectedExercise.id,
        workingWeight: workingWeight,
        workingSets: parseInt(workingSets) || 3,
        workingReps: parseInt(workingReps) || 10,
        goal: goal,
        includeWarmups: includeWarmups,
      });
    } else {
      plan = createDiscoveryPlan({
        exerciseId: selectedExercise.id,
        goal: goal,
        userEstimate: estimatedMax ? parseInt(estimatedMax) : undefined,
      });
    }

    onStartSession(selectedExercise, plan);
  }, [
    selectedExercise,
    mode,
    workingWeight,
    workingSets,
    workingReps,
    goal,
    estimatedMax,
    includeWarmups,
    onStartSession,
  ]);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-surface-100 px-4 py-3">
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.content.primary} />
          </TouchableOpacity>
        )}
        <Text className="text-xl font-bold text-content-primary">New Session</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          {/* Mode tabs */}
          <View className="mb-6 flex-row">
            <TouchableOpacity
              className="flex-1 items-center rounded-l-xl py-3"
              style={{
                backgroundColor: mode === 'standard' ? colors.primary[500] : colors.surface.card,
              }}
              onPress={() => setMode('standard')}
            >
              <Text
                className="font-bold"
                style={{
                  color: mode === 'standard' ? 'white' : colors.content.secondary,
                }}
              >
                Standard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center rounded-r-xl py-3"
              style={{
                backgroundColor: mode === 'discovery' ? colors.primary[500] : colors.surface.card,
              }}
              onPress={() => setMode('discovery')}
            >
              <Text
                className="font-bold"
                style={{
                  color: mode === 'discovery' ? 'white' : colors.content.secondary,
                }}
              >
                Discovery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Exercise selection */}
          <Card elevation={1} padding="lg">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
              Exercise
            </Text>
            <TouchableOpacity
              className="flex-row items-center justify-between rounded-xl p-4"
              style={{ backgroundColor: colors.surface.dark }}
              onPress={() => setShowExerciseSelector(true)}
            >
              <Text
                className="font-semibold"
                style={{
                  color: selectedExercise ? colors.content.primary : colors.content.muted,
                }}
              >
                {selectedExercise?.name ?? 'Select Exercise'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.content.muted} />
            </TouchableOpacity>
          </Card>

          {/* Standard mode settings */}
          {mode === 'standard' && (
            <Card elevation={1} padding="lg">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
                Working Set Configuration
              </Text>

              {/* Working weight */}
              <View className="mb-4">
                <Text className="mb-3 text-center text-sm text-content-secondary">
                  Working Weight
                </Text>
                <WeightPicker
                  value={workingWeight}
                  onChange={setWorkingWeight}
                  min={5}
                  max={200}
                  step={5}
                />
              </View>

              {/* Sets and Reps */}
              <Stack direction="row" gap="md">
                <View className="flex-1">
                  <Text className="mb-2 text-sm text-content-secondary">Sets</Text>
                  <TextInput
                    className="rounded-xl p-4 text-center text-lg font-bold"
                    style={{
                      backgroundColor: colors.surface.dark,
                      color: colors.content.primary,
                    }}
                    value={workingSets}
                    onChangeText={setWorkingSets}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-2 text-sm text-content-secondary">Reps</Text>
                  <TextInput
                    className="rounded-xl p-4 text-center text-lg font-bold"
                    style={{
                      backgroundColor: colors.surface.dark,
                      color: colors.content.primary,
                    }}
                    value={workingReps}
                    onChangeText={setWorkingReps}
                    keyboardType="numeric"
                  />
                </View>
              </Stack>

              {/* Warmup toggle */}
              <TouchableOpacity
                className="mt-4 flex-row items-center justify-between rounded-xl p-4"
                style={{ backgroundColor: colors.surface.dark }}
                onPress={() => setIncludeWarmups(!includeWarmups)}
                activeOpacity={0.7}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-content-primary">Include Warmup Sets</Text>
                  <Text className="mt-1 text-xs text-content-muted">
                    Adds sets at 50% and 75% of working weight
                  </Text>
                </View>
                <View
                  className="h-7 w-12 rounded-full p-1"
                  style={{
                    backgroundColor: includeWarmups ? colors.primary[500] : colors.surface.card,
                  }}
                >
                  <View
                    className="h-5 w-5 rounded-full"
                    style={{
                      backgroundColor: 'white',
                      transform: [{ translateX: includeWarmups ? 20 : 0 }],
                    }}
                  />
                </View>
              </TouchableOpacity>
            </Card>
          )}

          {/* Discovery mode settings */}
          {mode === 'discovery' && (
            <>
              <Card elevation={1} padding="lg">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
                  Training Goal
                </Text>
                <GoalPicker selected={goal} onSelect={setGoal} />
              </Card>

              <Card elevation={1} padding="lg">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
                  Estimated Max (Optional)
                </Text>
                <Text className="mb-3 text-sm text-content-muted">
                  If you have an idea of your max, enter it here. This helps us start at the right
                  weight and save time.
                </Text>
                <TextInput
                  className="rounded-xl p-4 text-lg font-bold"
                  style={{
                    backgroundColor: colors.surface.dark,
                    color: colors.content.primary,
                  }}
                  value={estimatedMax}
                  onChangeText={setEstimatedMax}
                  keyboardType="numeric"
                  placeholder="e.g., 200"
                  placeholderTextColor={colors.content.muted}
                />
              </Card>
            </>
          )}

          {/* Info card - only for discovery mode */}
          {mode === 'discovery' && (
            <Card
              elevation={0}
              padding="md"
              style={{
                backgroundColor: colors.primary[500] + '10',
                borderWidth: 1,
                borderColor: colors.primary[500] + '30',
              }}
            >
              <View className="flex-row items-start">
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={colors.primary[500]}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <View className="flex-1">
                  <Text className="text-sm text-content-secondary">
                    Discovery mode will guide you through increasing weights to find your optimal
                    working weight. The session will automatically stop when you reach your limit.
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>

        {/* Start button */}
        <View className="p-4">
          <ActionButton
            label={mode === 'standard' ? 'Start Session' : 'Start Discovery'}
            icon="play"
            variant="primary"
            size="lg"
            onPress={handleStartSession}
            disabled={!canStart}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Exercise selector modal */}
      <ExerciseSelector
        visible={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        selectedExercise={selectedExerciseId}
        onSelect={handleSelectExercise}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Helpers
// =============================================================================
