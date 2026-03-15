/**
 * ExerciseBreadcrumbs — trail of completed exercises in the current workout.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface CompletedExerciseEntry {
  name: string;
  setCount: number;
}

export interface ExerciseBreadcrumbsProps {
  completedExercises: CompletedExerciseEntry[];
  currentExerciseName: string;
}

export function ExerciseBreadcrumbs({ completedExercises, currentExerciseName }: ExerciseBreadcrumbsProps) {
  if (completedExercises.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {completedExercises.map((ex, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <View
            style={{
              backgroundColor: alpha(t['brand-primary'], 0.15),
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 10, color: t['text-tertiary'] }}>
              {ex.name} ({ex.setCount}s)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={10} color={t['text-tertiary']} />
        </View>
      ))}
      <View
        style={{
          backgroundColor: alpha(t['brand-primary'], 0.25),
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: t['brand-primary'] }}>
          {currentExerciseName}
        </Text>
      </View>
    </View>
  );
}
