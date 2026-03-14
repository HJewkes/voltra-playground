/**
 * DayDetail
 *
 * Shows sessions for a selected day in the training log calendar.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, VStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { WorkoutDay } from '@/domain/history';

const t = getSemanticColors('dark');

export interface DayDetailProps {
  day: WorkoutDay | null;
  dateLabel: string;
  onSessionPress?: (sessionId: string) => void;
}

/**
 * Format volume for display.
 */
function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(volume);
}

/**
 * DayDetail - session list for a selected day.
 */
export function DayDetail({ day, dateLabel, onSessionPress }: DayDetailProps) {
  if (!day) {
    return (
      <View className="items-center py-8">
        <Ionicons name="calendar-outline" size={32} color={t['text-disabled']} />
        <Text className="mt-2 text-sm text-text-disabled">
          No workouts on {dateLabel}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-text-secondary">{dateLabel}</Text>
        <Text className="text-xs text-text-disabled">
          {day.totalSets} sets | {formatVolume(day.totalVolume)} lbs
        </Text>
      </View>

      <VStack gap={2}>
        {day.sessions.map((session) => {
          const totalReps = session.completedSets.reduce(
            (sum, s) => sum + s.reps.length,
            0
          );
          const isDiscovery = session.plan.generatedBy === 'discovery';

          return (
            <TouchableOpacity
              key={session.id}
              onPress={() => onSessionPress?.(session.id)}
              activeOpacity={0.7}
            >
              <Card elevation={1}>
                <CardContent>
                  <View className="flex-row items-center">
                    <View
                      className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: alpha(t['brand-primary-dark'], 0.12) }}
                    >
                      <Ionicons
                        name={isDiscovery ? 'compass' : 'fitness'}
                        size={20}
                        color={t['brand-primary']}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-text-primary">
                        {session.exerciseName ?? 'Exercise'}
                      </Text>
                      <Text className="text-xs text-text-disabled">
                        {isDiscovery ? 'Discovery' : 'Training'} |{' '}
                        {session.completedSets.length} sets | {totalReps} reps
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={t['text-disabled']}
                    />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          );
        })}
      </VStack>
    </View>
  );
}
