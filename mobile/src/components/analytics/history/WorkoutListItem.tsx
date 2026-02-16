/**
 * WorkoutListItem
 *
 * A single workout in the history list.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, HStack, ListItem, ListItemContent, ListItemTrailing } from '@titan-design/react-ui';
import { colors } from '@/theme';
import type { CompletedSet } from '@/domain/workout';
import { estimateSetRIR } from '@voltras/workout-analytics';

export interface WorkoutListItemProps {
  workout: CompletedSet;
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
export function WorkoutListItem({ workout, onPress, onLongPress }: WorkoutListItemProps) {
  const rirEstimate = estimateSetRIR(workout.data);
  const avgRPE = Math.round(rirEstimate.rpe);
  const repCount = workout.data.reps.length;
  const formattedDate = new Date(workout.timestamp.start).toLocaleDateString();
  const badgeStyle = getRPEBadgeStyle(avgRPE);

  return (
    <Card elevation={1}>
      <ListItem onPress={onPress} onLongPress={onLongPress}>
        <View
          className="mr-3 items-center justify-center rounded-xl"
          style={{ width: 48, height: 48, backgroundColor: colors.primary[500] + '20' }}
        >
          <Ionicons name="fitness" size={24} color={colors.primary[500]} />
        </View>
        <ListItemContent title={workout.exerciseName || 'Set'} subtitle={formattedDate} />
        <ListItemTrailing>
          <HStack gap={2} align="center">
            <View className="mr-2 items-end">
              <Text className="text-base font-bold" style={{ color: colors.primary[500] }}>
                {repCount} reps
              </Text>
              <Text className="text-sm text-content-tertiary">{workout.weight} lbs</Text>
            </View>
            {avgRPE > 0 && (
              <View className="rounded-lg px-3 py-1.5" style={{ backgroundColor: badgeStyle.bg }}>
                <Text className="text-xs font-bold" style={{ color: badgeStyle.text }}>
                  RPE {avgRPE}
                </Text>
              </View>
            )}
          </HStack>
        </ListItemTrailing>
      </ListItem>
    </Card>
  );
}
