/**
 * ExerciseSelector
 *
 * A modal for selecting exercises, grouped by muscle group.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getKnownExercises,
  getExerciseName,
  EXERCISE_MUSCLE_GROUPS,
  MuscleGroup,
} from '@/domain/exercise';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface ExerciseSelectorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** Currently selected exercise ID */
  selectedExercise: string | null;
  /** Called when an exercise is selected */
  onSelect: (exerciseId: string) => void;
}

/**
 * Group exercises by muscle group.
 */
function groupExercisesByMuscle(): Record<string, string[]> {
  const exercises = getKnownExercises();
  const grouped: Record<string, string[]> = {};

  for (const ex of exercises) {
    const muscle = EXERCISE_MUSCLE_GROUPS[ex] ?? MuscleGroup.BACK;
    if (!grouped[muscle]) {
      grouped[muscle] = [];
    }
    grouped[muscle].push(ex);
  }

  return grouped;
}

/**
 * ExerciseSelector component - grouped exercise selection modal.
 *
 * @example
 * ```tsx
 * <ExerciseSelector
 *   visible={showExerciseModal}
 *   onClose={() => setShowExerciseModal(false)}
 *   selectedExercise={selectedExercise}
 *   onSelect={(id) => {
 *     setSelectedExercise(id);
 *     setShowExerciseModal(false);
 *   }}
 * />
 * ```
 */
export function ExerciseSelector({
  visible,
  onClose,
  selectedExercise,
  onSelect,
}: ExerciseSelectorProps) {
  const groupedExercises = useMemo(() => groupExercisesByMuscle(), []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: t['background-default'] }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b px-5 py-5"
          style={{ backgroundColor: t['surface-elevated'], borderColor: t['border-strong'] }}
        >
          <Text className="text-xl font-bold text-text-primary">Select Exercise</Text>
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: t['background-subtle'] }}
          >
            <Ionicons name="close" size={22} color={t['text-secondary']} />
          </TouchableOpacity>
        </View>

        {/* Exercise List */}
        <ScrollView className="flex-1 p-4">
          {Object.entries(groupedExercises).map(([muscle, exercises]) => (
            <View key={muscle} className="mb-6">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
                {muscle}
              </Text>
              {exercises.map((ex) => {
                const isSelected = selectedExercise === ex;
                return (
                  <TouchableOpacity
                    key={ex}
                    className="mb-2 rounded-2xl p-4"
                    style={[
                      { backgroundColor: t['surface-elevated'] },
                      isSelected && {
                        borderWidth: 2,
                        borderColor: t['brand-primary'],
                        backgroundColor: alpha(t['brand-primary-dark'], 0.08),
                      },
                    ]}
                    onPress={() => onSelect(ex)}
                    activeOpacity={0.7}
                  >
                    <Text
                      className="font-semibold"
                      style={{ color: isSelected ? t['brand-primary'] : t['text-primary'] }}
                    >
                      {getExerciseName(ex)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
