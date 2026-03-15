/**
 * NextExerciseButton — CTA shown after completing all sets for an exercise.
 */

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface NextExerciseButtonProps {
  nextExerciseName: string | null;
  onPress: () => void;
}

export function NextExerciseButton({ nextExerciseName, onPress }: NextExerciseButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: t['brand-primary'],
        borderRadius: 16,
        paddingVertical: 14,
      }}
      accessibilityRole="button"
      accessibilityLabel={nextExerciseName ? 'Next plan exercise' : 'Next Exercise'}
    >
      <Ionicons name="arrow-forward" size={22} color="#fff" />
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
        {nextExerciseName ? `Next: ${nextExerciseName}` : 'Next Exercise'}
      </Text>
    </TouchableOpacity>
  );
}
