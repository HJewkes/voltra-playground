/**
 * WeightSetupCard
 * 
 * Weight picker with set button for pre-workout setup.
 */

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Card, WeightPicker } from '@/components/ui';
import { colors } from '@/theme';

export interface WeightSetupCardProps {
  /** Currently selected weight */
  selectedWeight: number;
  /** Current device weight */
  deviceWeight: number;
  /** Called when weight selection changes */
  onWeightChange: (weight: number) => void;
  /** Called when set weight button is pressed */
  onSetWeight: () => void;
}

/**
 * WeightSetupCard - weight selection for pre-workout.
 */
export function WeightSetupCard({
  selectedWeight,
  deviceWeight,
  onWeightChange,
  onSetWeight,
}: WeightSetupCardProps) {
  return (
    <Card elevation={1} header="Set Weight" padding="lg">
      <WeightPicker
        value={selectedWeight}
        onChange={onWeightChange}
        min={5}
        max={200}
        step={5}
        style={{ marginBottom: 24 }}
      />
      
      <TouchableOpacity
        onPress={onSetWeight}
        className="rounded-2xl py-4"
        style={{ backgroundColor: colors.primary[600] }}
        activeOpacity={0.8}
      >
        <Text className="text-white text-center font-bold text-lg">
          Set Weight
        </Text>
      </TouchableOpacity>
      
      {deviceWeight > 0 && (
        <Text className="text-center text-content-tertiary mt-3">
          Current: {deviceWeight} lbs
        </Text>
      )}
    </Card>
  );
}
