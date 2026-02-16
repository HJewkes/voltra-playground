/**
 * ExerciseSessionSummaryCard
 *
 * Shows completed sets summary when a standard session finishes.
 * Displays planned vs actual comparison.
 */

import React from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Card, CardContent, HStack, VStack, Surface } from '@titan-design/react-ui';
import type { ExerciseSession, TerminationReason } from '@/domain/workout';
import { getSetMeanVelocity, estimateSetRIR } from '@voltras/workout-analytics';

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
  const totalReps = session.completedSets.reduce((sum, s) => sum + s.data.reps.length, 0);
  const totalVolume = session.completedSets.reduce(
    (sum, s) => sum + s.weight * s.data.reps.length,
    0
  );

  const termDisplay = getTerminationDisplay(terminationReason);

  return (
    <View style={style} className="flex-1">
      {/* Status banner */}
      <View
        className="mb-4 items-center rounded-3xl p-6"
        style={{
          backgroundColor: termDisplay.color + '15',
          borderWidth: 1,
          borderColor: termDisplay.color + '30',
        }}
      >
        <View
          className="mb-4 h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: termDisplay.color }}
        >
          <Ionicons name={termDisplay.icon} size={48} color="white" />
        </View>
        <Text className="mb-2 text-2xl font-bold" style={{ color: termDisplay.color }}>
          {termDisplay.label}
        </Text>
        {terminationMessage && (
          <Text className="text-center text-content-muted">{terminationMessage}</Text>
        )}
      </View>

      {/* Summary stats */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-4 text-sm font-medium text-content-muted">{session.exercise.name}</Text>

          <Surface elevation={0} className="rounded-xl bg-surface-input">
            <HStack justify="between" style={{ padding: 16 }}>
              <View className="flex-1 items-center">
                <Text className="text-sm text-content-muted">Sets</Text>
                <Text className="mt-1 text-2xl font-bold text-content-primary">
                  {session.completedSets.length}
                </Text>
                <Text className="text-xs text-content-muted">of {session.plan.sets.length}</Text>
              </View>
              <View className="w-px bg-surface-100" />
              <View className="flex-1 items-center">
                <Text className="text-sm text-content-muted">Reps</Text>
                <Text className="mt-1 text-2xl font-bold text-content-primary">{totalReps}</Text>
              </View>
              <View className="w-px bg-surface-100" />
              <View className="flex-1 items-center">
                <Text className="text-sm text-content-muted">Volume</Text>
                <Text className="mt-1 text-2xl font-bold text-content-primary">
                  {(totalVolume / 1000).toFixed(1)}k
                </Text>
                <Text className="text-xs text-content-muted">lbs</Text>
              </View>
            </HStack>
          </Surface>
        </CardContent>
      </Card>

      {/* Set breakdown */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
            Set Breakdown
          </Text>
          {session.completedSets.map((set, i) => {
            const planned = session.plan.sets[i];
            const repsDelta = planned ? set.data.reps.length - planned.targetReps : 0;
            const meanVel = getSetMeanVelocity(set.data);
            const rirEstimate = estimateSetRIR(set.data);

            return (
              <View
                key={i}
                className={`flex-row items-center justify-between py-3 ${
                  i < session.completedSets.length - 1 ? 'border-b border-surface-100' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className="mr-4 h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="font-bold text-content-secondary">{i + 1}</Text>
                  </View>
                  <View>
                    <Text className="font-medium text-content-primary">
                      {set.weight} lbs × {set.data.reps.length}
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
                    <Text className="text-xs text-content-muted">
                      {meanVel.toFixed(2)} m/s • RPE {rirEstimate.rpe.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <VStack gap={2} style={{ marginTop: 16, marginBottom: 32 }}>
        {onNewSession && (
          <TouchableOpacity
            className="items-center rounded-2xl p-5"
            style={{ backgroundColor: colors.primary[600] }}
            onPress={onNewSession}
            activeOpacity={0.8}
          >
            <Text className="text-lg font-bold text-white">New Session</Text>
          </TouchableOpacity>
        )}

        {onDone && (
          <TouchableOpacity
            className="items-center rounded-2xl p-5"
            style={{ backgroundColor: colors.surface.card }}
            onPress={onDone}
            activeOpacity={0.7}
          >
            <Text className="font-bold text-content-secondary">Done</Text>
          </TouchableOpacity>
        )}
      </VStack>
    </View>
  );
}
