/**
 * ExerciseSessionSummaryCard
 *
 * Shows completed sets summary when a standard session finishes.
 * Displays planned vs actual comparison.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Card, Surface, Stack } from '@/components/ui';
import type { ExerciseSession, SetComparison, TerminationReason } from '@/domain/workout';
import { getAllSetComparisons } from '@/domain/workout';

export interface ExerciseSessionSummaryCardProps {
  /** The completed session */
  session: ExerciseSession;
  /** Termination reason */
  terminationReason?: TerminationReason | null;
  /** Termination message */
  terminationMessage?: string | null;
  /** Called when user wants to start new session */
  onNewSession?: () => void;
  /** Called when done */
  onDone?: () => void;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * Get icon and color for termination reason.
 */
function getTerminationDisplay(reason?: TerminationReason | null): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
} {
  switch (reason) {
    case 'plan_exhausted':
      return { icon: 'checkmark-circle', color: colors.success.DEFAULT, label: 'Complete!' };
    case 'failure':
      return { icon: 'alert-circle', color: colors.warning.DEFAULT, label: 'Reached Failure' };
    case 'velocity_grinding':
      return { icon: 'trending-down', color: colors.warning.DEFAULT, label: 'Max Effort' };
    case 'junk_volume':
      return { icon: 'warning', color: colors.danger.light, label: 'Volume Limit' };
    case 'user_stopped':
      return { icon: 'stop-circle', color: colors.primary[500], label: 'Stopped Early' };
    default:
      return { icon: 'checkmark-circle', color: colors.success.DEFAULT, label: 'Session Complete' };
  }
}

/**
 * ExerciseSessionSummaryCard - displays session results.
 */
export function ExerciseSessionSummaryCard({
  session,
  terminationReason,
  terminationMessage,
  onNewSession,
  onDone,
  style,
}: ExerciseSessionSummaryCardProps) {
  const totalReps = session.completedSets.reduce((sum, s) => sum + s.reps.length, 0);
  const totalVolume = session.completedSets.reduce(
    (sum, s) => sum + s.weight * s.reps.length,
    0
  );
  const avgVelocity =
    session.completedSets.length > 0
      ? session.completedSets.reduce(
          (sum, s) => sum + s.metrics.velocity.concentricBaseline,
          0
        ) / session.completedSets.length
      : 0;

  const termDisplay = getTerminationDisplay(terminationReason);

  return (
    <View style={style} className="flex-1">
      {/* Status banner */}
      <View
        className="rounded-3xl p-6 mb-4 items-center"
        style={{
          backgroundColor: termDisplay.color + '15',
          borderWidth: 1,
          borderColor: termDisplay.color + '30',
        }}
      >
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: termDisplay.color }}
        >
          <Ionicons name={termDisplay.icon} size={48} color="white" />
        </View>
        <Text className="font-bold text-2xl mb-2" style={{ color: termDisplay.color }}>
          {termDisplay.label}
        </Text>
        {terminationMessage && (
          <Text className="text-center text-content-muted">{terminationMessage}</Text>
        )}
      </View>

      {/* Summary stats */}
      <Card elevation={1} padding="lg">
        <Text className="text-content-muted font-medium text-sm mb-4">
          {session.exercise.name}
        </Text>

        <Surface elevation="inset" radius="lg" border={false}>
          <Stack direction="row" justify="space-between" style={{ padding: 16 }}>
            <View className="items-center flex-1">
              <Text className="text-content-muted text-sm">Sets</Text>
              <Text className="text-content-primary font-bold text-2xl mt-1">
                {session.completedSets.length}
              </Text>
              <Text className="text-content-muted text-xs">
                of {session.plan.sets.length}
              </Text>
            </View>
            <View className="w-px bg-surface-100" />
            <View className="items-center flex-1">
              <Text className="text-content-muted text-sm">Reps</Text>
              <Text className="text-content-primary font-bold text-2xl mt-1">
                {totalReps}
              </Text>
            </View>
            <View className="w-px bg-surface-100" />
            <View className="items-center flex-1">
              <Text className="text-content-muted text-sm">Volume</Text>
              <Text className="text-content-primary font-bold text-2xl mt-1">
                {(totalVolume / 1000).toFixed(1)}k
              </Text>
              <Text className="text-content-muted text-xs">lbs</Text>
            </View>
          </Stack>
        </Surface>
      </Card>

      {/* Set breakdown */}
      <Card elevation={1} padding="lg">
        <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
          Set Breakdown
        </Text>
        {session.completedSets.map((set, i) => {
          const planned = session.plan.sets[i];
          const repsDelta = planned ? set.reps.length - planned.targetReps : 0;

          return (
            <View
              key={i}
              className={`flex-row justify-between items-center py-3 ${
                i < session.completedSets.length - 1 ? 'border-b border-surface-100' : ''
              }`}
            >
              <View className="flex-row items-center">
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-secondary font-bold">{i + 1}</Text>
                </View>
                <View>
                  <Text className="text-content-primary font-medium">
                    {set.weight} lbs × {set.reps.length}
                    {planned && (
                      <Text
                        style={{
                          color: repsDelta >= 0 ? colors.success.DEFAULT : colors.danger.light,
                        }}
                      >
                        {' '}
                        ({repsDelta >= 0 ? '+' : ''}
                        {repsDelta})
                      </Text>
                    )}
                  </Text>
                  <Text className="text-content-muted text-xs">
                    {set.metrics.velocity.concentricBaseline.toFixed(2)} m/s • RPE{' '}
                    {set.metrics.effort.rpe}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Card>

      {/* Action buttons */}
      <Stack gap="sm" style={{ marginTop: 16, marginBottom: 32 }}>
        {onNewSession && (
          <TouchableOpacity
            className="rounded-2xl p-5 items-center"
            style={{ backgroundColor: colors.primary[600] }}
            onPress={onNewSession}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-lg">New Session</Text>
          </TouchableOpacity>
        )}

        {onDone && (
          <TouchableOpacity
            className="rounded-2xl p-5 items-center"
            style={{ backgroundColor: colors.surface.card }}
            onPress={onDone}
            activeOpacity={0.7}
          >
            <Text className="text-content-secondary font-bold">Done</Text>
          </TouchableOpacity>
        )}
      </Stack>
    </View>
  );
}
