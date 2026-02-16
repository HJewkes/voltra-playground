/**
 * WorkoutDetailModal
 *
 * Bottom sheet showing workout details with phase-specific metrics.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { getEffortLabel, getRPEColor, type CompletedSet } from '@/domain/workout';
import {
  getSetMeanVelocity,
  getSetVelocityLossPct,
  estimateSetRIR,
  getRepPeakForce,
  getRepPeakVelocity,
  getPhaseMovementDuration,
  getPhaseHoldDuration,
} from '@voltras/workout-analytics';
import { BottomSheet, Stack, Surface, StatDisplay, ActionButton, InfoRow } from '@/components';
import { colors } from '@/theme';

export interface WorkoutDetailModalProps {
  workout: CompletedSet | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * WorkoutDetailModal - displays detailed set information.
 */
export function WorkoutDetailModal({ workout, visible, onClose }: WorkoutDetailModalProps) {
  const rirEstimate = workout ? estimateSetRIR(workout.data) : null;
  const rpe = rirEstimate ? Math.round(rirEstimate.rpe) : 0;

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
                value={workout.data.reps.length}
                label="Reps"
                size="sm"
                color={colors.primary[500]}
              />
              <View className="w-px bg-surface-100" />
              <StatDisplay value={workout.weight} label="lbs" size="sm" />
              <View className="w-px bg-surface-100" />
              <StatDisplay
                value={rpe || '—'}
                label="RPE"
                size="sm"
                color={getRPEColor(rpe || 5)}
              />
            </Stack>
          </Surface>

          {/* Analytics */}
          {workout.data.reps.length > 0 && (
            <View className="mb-5">
              <Text className="mb-3 font-bold text-content-secondary">Analytics</Text>
              <Surface elevation="inset" radius="lg" border={false}>
                <View className="p-5">
                  <InfoRow
                    label="Effort"
                    value={getEffortLabel(rirEstimate?.rpe ?? 5)}
                    showBorder
                  />
                  <InfoRow
                    label="Velocity Loss"
                    value={`${Math.abs(getSetVelocityLossPct(workout.data)).toFixed(0)}%`}
                    showBorder
                  />
                  <InfoRow
                    label="Avg Velocity"
                    value={`${getSetMeanVelocity(workout.data).toFixed(2)} m/s`}
                  />
                </View>
              </Surface>
            </View>
          )}

          {/* Per-Rep Data */}
          {workout.data.reps.length > 0 && (
            <View className="mb-5">
              <Text className="mb-3 font-bold text-content-secondary">Per-Rep Breakdown</Text>
              <Surface elevation="inset" radius="lg" border={false}>
                <View className="p-4">
                  {workout.data.reps.map((rep, index) => {
                    const eccDuration = getPhaseMovementDuration(rep.eccentric);
                    const conDuration = getPhaseMovementDuration(rep.concentric);
                    const topPause = getPhaseHoldDuration(rep.concentric);
                    const bottomPause = getPhaseHoldDuration(rep.eccentric);
                    const tempo = `${eccDuration.toFixed(1)}-${conDuration.toFixed(1)}s`;
                    const duration = eccDuration + conDuration + topPause + bottomPause;

                    return (
                      <View
                        key={index}
                        className={`py-3 ${index < workout.data.reps.length - 1 ? 'border-b border-surface-100' : ''}`}
                      >
                        <View className="mb-1 flex-row justify-between">
                          <Text className="font-bold text-content-primary">
                            Rep {rep.repNumber}
                          </Text>
                          <Text className="text-sm text-content-tertiary">{tempo}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-content-muted">
                            Force: {Math.round(getRepPeakForce(rep))}
                          </Text>
                          <Text className="text-xs text-content-muted">
                            Vel: {getRepPeakVelocity(rep).toFixed(2)}
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
