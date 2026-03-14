/**
 * ExerciseFrequencyCard
 *
 * Shows most frequently trained exercises.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computeExerciseFrequency } from '@/domain/history/services/cross-session-analytics';

const t = getSemanticColors('dark');

export interface ExerciseFrequencyCardProps {
  sessions: StoredExerciseSession[];
}

/**
 * ExerciseFrequencyCard - top exercises by frequency.
 */
export function ExerciseFrequencyCard({ sessions }: ExerciseFrequencyCardProps) {
  const exercises = useMemo(
    () => computeExerciseFrequency(sessions, 5),
    [sessions]
  );

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <Text className="mb-3 font-bold text-text-secondary">Top Exercises</Text>

        {exercises.length === 0 ? (
          <Text className="py-4 text-center text-sm text-text-disabled">
            No exercises recorded yet
          </Text>
        ) : (
          <View>
            {exercises.map((exercise, i) => (
              <View key={exercise.exerciseId} className="mb-2 flex-row items-center">
                <View
                  className="mr-3 h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: alpha(t['brand-primary-dark'], 0.12) }}
                >
                  <Text className="text-xs font-bold" style={{ color: t['brand-primary'] }}>
                    {i + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {exercise.exerciseName}
                  </Text>
                  <Text className="text-xs text-text-disabled">
                    {exercise.avgSetsPerSession} sets/session avg
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold" style={{ color: t['brand-primary'] }}>
                    {exercise.sessionCount}x
                  </Text>
                  <Text className="text-xs text-text-disabled">sessions</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}
