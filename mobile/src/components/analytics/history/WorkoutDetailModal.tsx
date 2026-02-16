/**
 * WorkoutDetailModal
 *
 * Bottom sheet showing workout details with phase-specific metrics.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { getEffortLabel, type CompletedSet } from '@/domain/workout';
import {
  getSetMeanVelocity,
  getSetVelocityLossPct,
  estimateSetRIR,
  getRepPeakForce,
  getRepPeakVelocity,
  getPhaseMovementDuration,
  getPhaseHoldDuration,
} from '@voltras/workout-analytics';
import { Drawer, DrawerBody, DrawerFooter, Button, ButtonText, DataRow, Metric, Surface, HStack } from '@titan-design/react-ui';

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
    <Drawer
      isOpen={visible}
      onClose={onClose}
      title={workout?.exerciseName || 'Set Details'}
      placement="bottom"
    >
      <DrawerBody>
        {workout && (
          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            <Text className="mb-4 text-center text-text-tertiary">
              {new Date(workout.timestamp.start).toLocaleDateString()}
            </Text>

            {/* Summary Stats */}
            <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 20 }}>
              <HStack justify="around" style={{ padding: 20 }}>
                <Metric
                  value={String(workout.data.reps.length)}
                  label="Reps"
                  size="sm"
                />
                <View className="w-px bg-surface-100" />
                <Metric value={String(workout.weight)} label="lbs" size="sm" />
                <View className="w-px bg-surface-100" />
                <Metric
                  value={String(rpe || '\u2014')}
                  label="RPE"
                  size="sm"
                />
              </HStack>
            </Surface>

            {/* Analytics */}
            {workout.data.reps.length > 0 && (
              <View className="mb-5">
                <Text className="mb-3 font-bold text-text-secondary">Analytics</Text>
                <Surface elevation={0} className="rounded-xl bg-surface-input">
                  <View className="p-5">
                    <DataRow
                      label="Effort"
                      value={getEffortLabel(rirEstimate?.rpe ?? 5)}
                      className="border-b border-surface-200 pb-3 mb-3"
                    />
                    <DataRow
                      label="Velocity Loss"
                      value={`${Math.abs(getSetVelocityLossPct(workout.data)).toFixed(0)}%`}
                      className="border-b border-surface-200 pb-3 mb-3"
                    />
                    <DataRow
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
                <Text className="mb-3 font-bold text-text-secondary">Per-Rep Breakdown</Text>
                <Surface elevation={0} className="rounded-xl bg-surface-input">
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
                            <Text className="font-bold text-text-primary">
                              Rep {rep.repNumber}
                            </Text>
                            <Text className="text-sm text-text-tertiary">{tempo}</Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-xs text-text-disabled">
                              Force: {Math.round(getRepPeakForce(rep))}
                            </Text>
                            <Text className="text-xs text-text-disabled">
                              Vel: {getRepPeakVelocity(rep).toFixed(2)}
                            </Text>
                            <Text className="text-xs text-text-disabled">
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
      </DrawerBody>

      <DrawerFooter>
        <Button variant="outline" color="primary" fullWidth onPress={onClose}>
          <ButtonText>Close</ButtonText>
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
