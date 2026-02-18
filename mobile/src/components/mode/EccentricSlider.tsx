/**
 * EccentricSlider
 *
 * Slider for eccentric load adjustment (-195 to +195).
 * Positive values = eccentric overload (harder lowering)
 * Negative values = eccentric underload (easier lowering)
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

interface EccentricSliderProps {
  value: number;
  onChange: (value: number) => Promise<void>;
}

export function EccentricSlider({ value, onChange }: EccentricSliderProps) {
  const [localValue, setLocalValue] = useState(Math.round(value));
  const sliding = useRef(false);

  // Sync external value → local (only when not actively sliding)
  useEffect(() => {
    if (!sliding.current) {
      setLocalValue(Math.round(value));
    }
  }, [value]);

  const handleValueChange = (newValue: number) => {
    sliding.current = true;
    setLocalValue(Math.round(newValue));
  };

  const handleSlidingComplete = (newValue: number) => {
    sliding.current = false;
    const rounded = Math.round(newValue);
    setLocalValue(rounded);
    onChange(rounded);
  };

  // Determine the color based on value
  const getValueColor = () => {
    if (localValue > 0) return t['status-success'];
    if (localValue < 0) return t['status-error'];
    return t['text-disabled'];
  };

  // Format the display value with sign
  const formatValue = (v: number) => {
    if (v > 0) return `+${v}`;
    return String(v);
  };

  return (
    <View>
      {/* Current value display */}
      <View className="mb-4 items-center">
        <Text
          className="text-4xl font-bold"
          style={{ color: getValueColor() }}
        >
          {formatValue(localValue)}
        </Text>
        <Text className="text-sm text-text-tertiary">
          {localValue > 0 ? 'Overload' : localValue < 0 ? 'Underload' : 'Balanced'}
        </Text>
      </View>

      {/* Slider */}
      <View className="px-2">
        <Slider
          value={localValue}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumValue={-195}
          maximumValue={195}
          step={1}
          minimumTrackTintColor={localValue >= 0 ? t['brand-primary'] : t['status-error']}
          maximumTrackTintColor={t['surface-elevated']}
          thumbTintColor={localValue >= 0 ? t['brand-primary'] : t['status-error']}
        />

        {/* Labels */}
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-text-disabled">-195</Text>
          <Text className="text-xs text-text-disabled">0</Text>
          <Text className="text-xs text-text-disabled">+195</Text>
        </View>
      </View>

      {/* Description */}
      <Text className="mt-4 text-center text-sm text-text-disabled">
        {localValue > 0
          ? 'Eccentric overload: more resistance when lowering'
          : localValue < 0
            ? 'Eccentric underload: less resistance when lowering'
            : 'Equal resistance for lifting and lowering'}
      </Text>
    </View>
  );
}
