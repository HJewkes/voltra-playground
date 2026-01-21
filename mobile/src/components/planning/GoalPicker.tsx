/**
 * GoalPicker
 *
 * A selection component for training goals (strength/hypertrophy/endurance).
 */

import React from 'react';
import { Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrainingGoal } from '@/domain/planning';
import { colors } from '@/theme';
import { Stack } from '../ui';

export interface GoalPickerProps {
  /** Currently selected goal */
  selected: TrainingGoal;
  /** Called when a goal is selected */
  onSelect: (goal: TrainingGoal) => void;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const GOALS: { goal: TrainingGoal; label: string; icon: 'flash' | 'body' | 'fitness' }[] = [
  { goal: TrainingGoal.STRENGTH, label: 'Strength', icon: 'flash' },
  { goal: TrainingGoal.HYPERTROPHY, label: 'Muscle', icon: 'body' },
  { goal: TrainingGoal.ENDURANCE, label: 'Endurance', icon: 'fitness' },
];

/**
 * GoalPicker component - training goal selection.
 *
 * @example
 * ```tsx
 * <GoalPicker
 *   selected={selectedGoal}
 *   onSelect={setSelectedGoal}
 * />
 * ```
 */
export function GoalPicker({ selected, onSelect, style }: GoalPickerProps) {
  return (
    <Stack direction="row" gap="sm" style={style}>
      {GOALS.map(({ goal, label, icon }) => {
        const isSelected = selected === goal;

        return (
          <TouchableOpacity
            key={goal}
            className="flex-1 items-center rounded-2xl p-4"
            style={[
              { backgroundColor: colors.surface.dark },
              isSelected && {
                backgroundColor: colors.primary[600] + '20',
                borderWidth: 2,
                borderColor: colors.primary[500],
              },
            ]}
            onPress={() => onSelect(goal)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={icon}
              size={28}
              color={isSelected ? colors.primary[500] : colors.text.muted}
            />
            <Text
              className="mt-2 text-sm font-semibold"
              style={{ color: isSelected ? colors.primary[500] : colors.text.secondary }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Stack>
  );
}
