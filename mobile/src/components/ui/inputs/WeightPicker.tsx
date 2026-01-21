/**
 * WeightPicker
 *
 * A +/- stepper control for selecting weight values.
 * Large, touch-friendly buttons with prominent display.
 */

import React from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface WeightPickerProps {
  /** Current weight value */
  value: number;
  /** Called when weight changes */
  onChange: (value: number) => void;
  /** Minimum weight (default: 5) */
  min?: number;
  /** Maximum weight (default: 200) */
  max?: number;
  /** Step increment (default: 5) */
  step?: number;
  /** Unit label (default: "lbs") */
  unit?: string;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * WeightPicker component - +/- stepper for weight selection.
 *
 * @example
 * ```tsx
 * <WeightPicker
 *   value={selectedWeight}
 *   onChange={setSelectedWeight}
 *   min={5}
 *   max={200}
 * />
 * ```
 */
export function WeightPicker({
  value,
  onChange,
  min = 5,
  max = 200,
  step = 5,
  unit = 'lbs',
  style,
}: WeightPickerProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <View className="flex-row items-center justify-center" style={style}>
      <TouchableOpacity
        onPress={handleDecrement}
        disabled={value <= min}
        className="h-14 w-14 items-center justify-center rounded-full border border-surface-100"
        style={{
          backgroundColor: colors.surface.dark,
          opacity: value <= min ? 0.5 : 1,
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={28} color={colors.text.secondary} />
      </TouchableOpacity>

      <View className="mx-10 items-center">
        <Text className="text-6xl font-bold" style={{ color: colors.primary[500] }}>
          {value}
        </Text>
        <Text className="text-lg text-content-tertiary">{unit}</Text>
      </View>

      <TouchableOpacity
        onPress={handleIncrement}
        disabled={value >= max}
        className="h-14 w-14 items-center justify-center rounded-full border border-surface-100"
        style={{
          backgroundColor: colors.surface.dark,
          opacity: value >= max ? 0.5 : 1,
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={28} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}
