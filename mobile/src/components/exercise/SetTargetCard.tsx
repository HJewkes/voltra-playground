/**
 * SetTargetCard
 *
 * Shows the planned weight/reps for the current set.
 * Displayed in the 'ready' state before recording starts.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Card, CardContent, HStack, Surface } from '@titan-design/react-ui';
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
    <Card elevation={2} className="mb-4" style={style}>
      <CardContent className="p-6">
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-semibold text-content-muted">
          {isDiscovery ? 'Discovery Set' : plannedSet.isWarmup ? 'Warmup' : 'Set'} {setNumber} of{' '}
          {totalSets}
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{
            backgroundColor: plannedSet.isWarmup
              ? colors.warning.DEFAULT + '20'
              : colors.primary[500] + '20',
          }}
        >
          <Text
            className="font-bold"
            style={{ color: plannedSet.isWarmup ? colors.warning.DEFAULT : colors.primary[500] }}
          >
            {isDiscovery ? 'Testing' : plannedSet.isWarmup ? 'Warmup' : 'Working'}
          </Text>
        </View>
      </View>

      {/* Main target display */}
      <View className="items-center py-4">
        <Text className="text-7xl font-bold" style={{ color: colors.primary[500] }}>
          {plannedSet.weight}
        </Text>
        <Text className="mt-1 text-2xl text-content-muted">lbs</Text>
      </View>

      {/* Target details */}
      <Surface elevation={0} className="rounded-xl bg-surface-input">
        <HStack justify="between" style={{ padding: 16 }}>
          <View className="flex-1 items-center">
            <Ionicons name="repeat" size={20} color={colors.neutral[500]} />
            <Text className="mt-1 text-sm text-content-muted">Target Reps</Text>
            <Text className="mt-1 text-xl font-bold text-content-primary">
              {plannedSet.targetReps}
            </Text>
          </View>
          {plannedSet.rirTarget !== undefined && (
            <>
              <View className="w-px bg-surface-100" />
              <View className="flex-1 items-center">
                <Ionicons name="fitness" size={20} color={colors.neutral[500]} />
                <Text className="mt-1 text-sm text-content-muted">Target RIR</Text>
                <Text className="mt-1 text-xl font-bold text-content-primary">
                  {plannedSet.rirTarget}
                </Text>
              </View>
            </>
          )}
        </HStack>
      </Surface>

      {/* Instructions */}
      <Text className="mt-4 text-center text-sm text-content-muted">
        {isDiscovery
          ? 'Complete all reps with good form. Stop if weight feels too heavy.'
          : 'Press START when ready to begin recording.'}
      </Text>
      </CardContent>
    </Card>
  );
}
