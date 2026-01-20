/**
 * WorkoutListItem
 * 
 * A single workout in the history list.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Card, Stack, ListItem } from '@/components';
import { colors } from '@/theme';
import type { Set } from '@/domain/workout';

export interface WorkoutListItemProps {
  workout: Set;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * Get RPE badge styling.
 */
function getRPEBadgeStyle(rpe: number | undefined) {
  if (!rpe) return { bg: colors.surface.dark, text: colors.text.muted };
  if (rpe <= 6) return { bg: colors.success.DEFAULT + '20', text: colors.success.DEFAULT };
  if (rpe <= 8) return { bg: colors.warning.DEFAULT + '20', text: colors.warning.DEFAULT };
  return { bg: colors.danger.DEFAULT + '20', text: colors.danger.DEFAULT };
}

/**
 * WorkoutListItem - displays a single workout entry.
 */
export function WorkoutListItem({
  workout,
  onPress,
  onLongPress,
}: WorkoutListItemProps) {
  const avgRPE = Math.round(workout.metrics?.effort.rpe ?? 0);
  const repCount = workout.reps?.length ?? 0;
  const formattedDate = new Date(workout.timestamp.start).toLocaleDateString();
  const badgeStyle = getRPEBadgeStyle(avgRPE);
  
  return (
    <Card elevation={1} padding="none" marginBottom={false}>
      <ListItem
        icon="fitness"
        iconColor={colors.primary[500]}
        title={workout.exerciseName || 'Set'}
        subtitle={formattedDate}
        onPress={onPress}
        onLongPress={onLongPress}
        trailing={
          <Stack direction="row" gap="sm" align="center">
            <View className="items-end mr-2">
              <Text className="font-bold text-base" style={{ color: colors.primary[500] }}>
                {repCount} reps
              </Text>
              <Text className="text-content-tertiary text-sm">
                {workout.weight} lbs
              </Text>
            </View>
            {avgRPE > 0 && (
              <View 
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: badgeStyle.bg }}
              >
                <Text className="text-xs font-bold" style={{ color: badgeStyle.text }}>
                  RPE {avgRPE}
                </Text>
              </View>
            )}
          </Stack>
        }
      />
    </Card>
  );
}
