/**
 * OptionSelector
 *
 * A row of selectable options (radio-style selection).
 * Used for training goals, modes, etc.
 */

import React from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export interface Option<T> {
  /** Unique value for this option */
  value: T;
  /** Display label */
  label: string;
  /** Optional Ionicon name */
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface OptionSelectorProps<T> {
  /** Available options */
  options: Option<T>[];
  /** Currently selected value */
  selected: T;
  /** Called when selection changes */
  onSelect: (value: T) => void;
  /** Direction of layout (default: row) */
  direction?: 'row' | 'column';
  /** Gap between options (default: sm) */
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const gapMap = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

/**
 * OptionSelector component - selectable options row.
 *
 * @example
 * ```tsx
 * <OptionSelector
 *   options={[
 *     { value: 'strength', label: 'Strength', icon: 'flash' },
 *     { value: 'hypertrophy', label: 'Hypertrophy', icon: 'fitness' },
 *   ]}
 *   selected={goal}
 *   onSelect={setGoal}
 * />
 * ```
 */
export function OptionSelector<T extends string | number>({
  options,
  selected,
  onSelect,
  direction = 'row',
  gap = 'sm',
  style,
}: OptionSelectorProps<T>) {
  const gapValue = gapMap[gap];

  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: gapValue,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;

        return (
          <TouchableOpacity
            key={String(option.value)}
            onPress={() => onSelect(option.value)}
            className="flex-1 items-center rounded-2xl p-4"
            style={{
              backgroundColor: isSelected ? colors.primary[600] + '30' : colors.surface.dark,
              borderWidth: 2,
              borderColor: isSelected ? colors.primary[500] : 'transparent',
            }}
            activeOpacity={0.7}
          >
            {option.icon && (
              <Ionicons
                name={option.icon}
                size={24}
                color={isSelected ? colors.primary[500] : colors.text.muted}
                style={{ marginBottom: spacing.xs }}
              />
            )}
            <Text
              className="text-center text-sm font-semibold"
              style={{
                color: isSelected ? colors.primary[500] : colors.text.secondary,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
