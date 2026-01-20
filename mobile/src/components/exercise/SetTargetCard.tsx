/**
 * SetTargetCard
 *
 * Shows the planned weight/reps for the current set.
 * Displayed in the 'ready' state before recording starts.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Card, Surface, Stack } from '@/components/ui';
import type { PlannedSet } from '@/domain/workout';

export interface SetTargetCardProps {
  /** Current set number (1-based for display) */
  setNumber: number;
  /** Total planned sets */
  totalSets: number;
  /** The planned set targets */
  plannedSet: PlannedSet;
  /** Whether this is a discovery session */
  isDiscovery?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * SetTargetCard - displays the target for the current set.
 */
export function SetTargetCard({
  setNumber,
  totalSets,
  plannedSet,
  isDiscovery = false,
  style,
}: SetTargetCardProps) {
  return (
    <Card elevation={2} padding="lg" style={style}>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-content-muted font-semibold">
          {isDiscovery ? 'Discovery Set' : 'Set'} {setNumber} of {totalSets}
        </Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: colors.primary[500] + '20' }}
        >
          <Text className="font-bold" style={{ color: colors.primary[500] }}>
            {isDiscovery ? 'Testing' : 'Working'}
          </Text>
        </View>
      </View>

      {/* Main target display */}
      <View className="items-center py-4">
        <Text className="text-7xl font-bold" style={{ color: colors.primary[500] }}>
          {plannedSet.weight}
        </Text>
        <Text className="text-2xl text-content-muted mt-1">lbs</Text>
      </View>

      {/* Target details */}
      <Surface elevation="inset" radius="lg" border={false}>
        <Stack direction="row" justify="space-between" style={{ padding: 16 }}>
          <View className="items-center flex-1">
            <Ionicons name="repeat" size={20} color={colors.neutral[500]} />
            <Text className="text-content-muted text-sm mt-1">Target Reps</Text>
            <Text className="text-content-primary font-bold text-xl mt-1">
              {plannedSet.targetReps}
            </Text>
          </View>
          {plannedSet.rirTarget !== undefined && (
            <>
              <View className="w-px bg-surface-100" />
              <View className="items-center flex-1">
                <Ionicons name="fitness" size={20} color={colors.neutral[500]} />
                <Text className="text-content-muted text-sm mt-1">Target RIR</Text>
                <Text className="text-content-primary font-bold text-xl mt-1">
                  {plannedSet.rirTarget}
                </Text>
              </View>
            </>
          )}
        </Stack>
      </Surface>

      {/* Instructions */}
      <Text className="text-content-muted text-center text-sm mt-4">
        {isDiscovery
          ? 'Complete all reps with good form. Stop if weight feels too heavy.'
          : 'Press START when ready to begin recording.'}
      </Text>
    </Card>
  );
}
