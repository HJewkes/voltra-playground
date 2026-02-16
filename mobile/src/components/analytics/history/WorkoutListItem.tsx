/**
 * WorkoutListItem
 *
 * A single workout in the history list.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, HStack, ListItem, ListItemContent, ListItemTrailing, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { CompletedSet } from '@/domain/workout';
import { estimateSetRIR } from '@voltras/workout-analytics';

const t = getSemanticColors('dark');

export interface WorkoutListItemProps {
  workout: CompletedSet;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * Get RPE badge styling.
 */
function getRPEBadgeStyle(rpe: number | undefined) {
  if (!rpe) return { bg: t['background-subtle'], text: t['text-disabled'] };
  if (rpe <= 6) return { bg: alpha(t['status-success'], 0.12), text: t['status-success'] };
  if (rpe <= 8) return { bg: alpha(t['status-warning'], 0.12), text: t['status-warning'] };
  return { bg: alpha(t['status-error'], 0.12), text: t['status-error'] };
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
          style={{ width: 48, height: 48, backgroundColor: alpha(t['brand-primary'], 0.12) }}
        >
          <Ionicons name="fitness" size={24} color={t['brand-primary']} />
        </View>
        <ListItemContent title={workout.exerciseName || 'Set'} subtitle={formattedDate} />
        <ListItemTrailing>
          <HStack gap={2} align="center">
            <View className="mr-2 items-end">
              <Text className="text-base font-bold text-brand-primary">
                {repCount} reps
              </Text>
              <Text className="text-sm text-text-tertiary">{workout.weight} lbs</Text>
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
