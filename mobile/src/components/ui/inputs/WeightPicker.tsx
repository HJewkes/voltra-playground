/**
 * WeightPicker
 *
 * A slider control for selecting weight values.
 * Shows current weight prominently with a draggable thumb slider.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';
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
 * WeightPicker component - slider for weight selection.
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
  // Round to nearest step to ensure clean values
  const handleChange = (newValue: number) => {
    const rounded = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, rounded)));
  };

  return (
    <View style={style}>
      {/* Current value display */}
      <View className="mb-4 items-center">
        <Text className="text-5xl font-bold" style={{ color: colors.primary[500] }}>
          {value}
        </Text>
        <Text className="text-lg text-content-tertiary">{unit}</Text>
      </View>

      {/* Slider */}
      <View className="px-2">
        <Slider
          value={value}
          onValueChange={handleChange}
          minimumValue={min}
          maximumValue={max}
          step={step}
          minimumTrackTintColor={colors.primary[500]}
          maximumTrackTintColor={colors.surface.card}
          thumbTintColor={colors.primary[500]}
        />

        {/* Min/Max labels */}
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-content-muted">{min}</Text>
          <Text className="text-xs text-content-muted">{max}</Text>
        </View>
      </View>
    </View>
  );
}
