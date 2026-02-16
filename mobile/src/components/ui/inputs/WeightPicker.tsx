/**
 * WeightPicker
 *
 * A slider control for selecting weight values.
 * Shows current weight prominently with a draggable thumb slider.
 */

import React, { useState, useEffect, useRef } from 'react';
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
 * Uses local state to buffer slider values and only commits to the store
 * on onSlidingComplete, preventing infinite update loops on web where
 * onValueChange fires during render.
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
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const [localValue, setLocalValue] = useState(() => clamp(value));
  const sliding = useRef(false);

  // Sync external value → local (only when not actively sliding)
  useEffect(() => {
    if (!sliding.current) {
      setLocalValue(clamp(value));
    }
  }, [value, min, max, step]);

  const handleValueChange = (newValue: number) => {
    sliding.current = true;
    setLocalValue(clamp(newValue));
  };

  const handleSlidingComplete = (newValue: number) => {
    sliding.current = false;
    const clamped = clamp(newValue);
    setLocalValue(clamped);
    onChange(clamped);
  };

  return (
    <View style={style}>
      {/* Current value display */}
      <View className="mb-4 items-center">
        <Text className="text-5xl font-bold" style={{ color: colors.primary[500] }}>
          {localValue}
        </Text>
        <Text className="text-lg text-content-tertiary">{unit}</Text>
      </View>

      {/* Slider */}
      <View className="px-2">
        <Slider
          value={localValue}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
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
