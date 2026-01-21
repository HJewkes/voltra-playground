/**
 * WorkoutDetailModal
 *
 * Bottom sheet showing workout details with phase-specific metrics.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { getEffortLabel, getRPEColor, type Set } from '@/domain/workout';
import { BottomSheet, Stack, Surface, StatDisplay, ActionButton, InfoRow } from '@/components';
import { colors } from '@/theme';

export interface WorkoutDetailModalProps {
  workout: Set | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * WorkoutDetailModal - displays detailed set information.
 */
export function WorkoutDetailModal({ workout, visible, onClose }: WorkoutDetailModalProps) {
  const getSetRPE = (s: Set): number => {
    return Math.round(s.metrics?.effort.rpe ?? 0);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={workout?.exerciseName || 'Set Details'}>
      {workout && (
        <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
          <Text className="mb-4 text-center text-content-tertiary">
            {new Date(workout.timestamp.start).toLocaleDateString()}
          </Text>

          {/* Summary Stats */}
          <Surface elevation="inset" radius="lg" border={false} style={{ marginBottom: 20 }}>
            <Stack direction="row" justify="space-around" style={{ padding: 20 }}>
              <StatDisplay
                value={workout.reps?.length ?? 0}
                label="Reps"
                size="sm"
                color={colors.primary[500]}
              />
              <View className="w-px bg-surface-100" />
              <StatDisplay value={workout.weight} label="lbs" size="sm" />
              <View className="w-px bg-surface-100" />
              <StatDisplay
                value={getSetRPE(workout) || '—'}
                label="RPE"
                size="sm"
                color={getRPEColor(getSetRPE(workout) || 5)}
              />
            </Stack>
          </Surface>

          {/* Analytics */}
          {workout.metrics && (
            <View className="mb-5">
              <Text className="mb-3 font-bold text-content-secondary">Analytics</Text>
              <Surface elevation="inset" radius="lg" border={false}>
                <View className="p-5">
                  <InfoRow
                    label="Effort"
                    value={getEffortLabel(workout.metrics.effort.rpe)}
                    showBorder
                  />
                  <InfoRow
                    label="Velocity Loss"
                    value={`${Math.abs(workout.metrics.velocity.concentricDelta).toFixed(0)}%`}
                    showBorder
                  />
                  <InfoRow
                    label="Time Under Tension"
                    value={`${workout.metrics.timeUnderTension.toFixed(1)}s`}
                    showBorder
                  />
                  <InfoRow
                    label="Avg Velocity"
                    value={`${workout.metrics.velocity.concentricBaseline.toFixed(2)} m/s`}
                  />
                </View>
              </Surface>
            </View>
          )}

          {/* Per-Rep Data */}
          {workout.reps && workout.reps.length > 0 && (
            <View className="mb-5">
              <Text className="mb-3 font-bold text-content-secondary">Per-Rep Breakdown</Text>
              <Surface elevation="inset" radius="lg" border={false}>
                <View className="p-4">
                  {workout.reps.map((rep, index) => {
                    const { metrics } = rep;
                    const tempo = `${metrics.eccentricDuration.toFixed(1)}-${metrics.concentricDuration.toFixed(1)}s`;
                    const duration =
                      metrics.eccentricDuration +
                      metrics.concentricDuration +
                      metrics.topPauseTime +
                      metrics.bottomPauseTime;

                    return (
                      <View
                        key={index}
                        className={`py-3 ${index < workout.reps!.length - 1 ? 'border-b border-surface-100' : ''}`}
                      >
                        <View className="mb-1 flex-row justify-between">
                          <Text className="font-bold text-content-primary">
                            Rep {rep.repNumber}
                          </Text>
                          <Text className="text-sm text-content-tertiary">{tempo}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-content-muted">
                            Force: {Math.round(metrics.peakForce)}
                          </Text>
                          <Text className="text-xs text-content-muted">
                            Vel: {metrics.concentricPeakVelocity.toFixed(2)}
                          </Text>
                          <Text className="text-xs text-content-muted">
                            Dur: {duration.toFixed(1)}s
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Surface>
            </View>
          )}
        </ScrollView>
      )}

      <ActionButton label="Close" variant="secondary" onPress={onClose} style={{ marginTop: 16 }} />
    </BottomSheet>
  );
}
