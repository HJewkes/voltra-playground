/**
 * ExerciseSessionProgress
 *
 * Progress indicator showing session status and completed sets.
 * Adapted from DiscoveryProgress to work with PlannedSet and Set.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';
import { Card, ProgressBar } from '@/components/ui';
import type { PlannedSet , Set } from '@/domain/workout';

export interface ExerciseSessionProgressProps {
  /** Planned sets */
  plannedSets: PlannedSet[];
  /** Completed sets */
  completedSets: Set[];
  /** Current set index (0-based) */
  currentSetIndex: number;
  /** Whether this is a discovery session */
  isDiscovery?: boolean;
  /** Any error message */
  error?: string | null;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * ExerciseSessionProgress - shows session progress.
 */
export function ExerciseSessionProgress({
  plannedSets,
  completedSets,
  currentSetIndex,
  isDiscovery = false,
  error,
  style,
}: ExerciseSessionProgressProps) {
  const totalSets = plannedSets.length;
  const completedCount = completedSets.length;
  const progress = totalSets > 0 ? Math.min(100, (completedCount / totalSets) * 100) : 0;

  return (
    <View style={style}>
      {/* Progress indicator */}
      <Card elevation={1} padding="md" radius="lg">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-semibold text-content-secondary">
            {isDiscovery ? 'Discovery' : 'Session'} Progress
          </Text>
          <Text className="font-bold" style={{ color: colors.primary[500] }}>
            Set {currentSetIndex + 1} of {totalSets}
          </Text>
        </View>

        <ProgressBar progress={progress} color={colors.primary[500]} height={8} />

        {error && <Text className="mt-2 text-sm text-danger-light">Error: {error}</Text>}
      </Card>

      {/* Completed sets */}
      {completedSets.length > 0 && (
        <Card elevation={1} padding="md" radius="lg">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
            Completed
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {completedSets.map((set, i) => {
              const planned = plannedSets[i];
              const repsDelta = set.reps.length - (planned?.targetReps ?? 0);
              const deltaColor = repsDelta >= 0 ? colors.success.DEFAULT : colors.danger.light;

              return (
                <View
                  key={i}
                  className="rounded-xl px-4 py-2"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-sm font-medium text-content-secondary">
                    {set.weight}lbs × {set.reps.length}
                    {planned && (
                      <Text style={{ color: deltaColor }}>
                        {' '}
                        ({repsDelta >= 0 ? '+' : ''}
                        {repsDelta})
                      </Text>
                    )}
                  </Text>
                  <Text className="text-xs text-content-muted">
                    {set.metrics.velocity.concentricBaseline.toFixed(2)} m/s
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </View>
  );
}
