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
import { colors } from '@/theme';

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
      <View className="flex-1" style={{ backgroundColor: colors.surface.background }}>
        {/* Header */}
        <View 
          className="px-5 py-5 flex-row justify-between items-center border-b"
          style={{ backgroundColor: colors.surface.elevated, borderColor: colors.surface.light }}
        >
          <Text className="text-xl font-bold text-content-primary">Select Exercise</Text>
          <TouchableOpacity 
            onPress={onClose}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        {/* Exercise List */}
        <ScrollView className="flex-1 p-4">
          {Object.entries(groupedExercises).map(([muscle, exercises]) => (
            <View key={muscle} className="mb-6">
              <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
                {muscle}
              </Text>
              {exercises.map(ex => {
                const isSelected = selectedExercise === ex;
                return (
                  <TouchableOpacity
                    key={ex}
                    className="rounded-2xl p-4 mb-2"
                    style={[
                      { backgroundColor: colors.surface.card },
                      isSelected && { 
                        borderWidth: 2, 
                        borderColor: colors.primary[500],
                        backgroundColor: colors.primary[600] + '15',
                      }
                    ]}
                    onPress={() => onSelect(ex)}
                    activeOpacity={0.7}
                  >
                    <Text 
                      className="font-semibold"
                      style={{ color: isSelected ? colors.primary[500] : colors.text.primary }}
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
