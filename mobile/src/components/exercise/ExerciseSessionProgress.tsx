/**
 * ExerciseSessionProgress
 *
 * Progress indicator showing session status and completed sets.
 * Adapted from DiscoveryProgress to work with PlannedSet and Set.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';
import { ProgressBar } from '@/components/ui';
import { Card, CardContent } from '@titan-design/react-ui';
import type { PlannedSet, CompletedSet } from '@/domain/workout';
import { getSetMeanVelocity } from '@voltras/workout-analytics';

export interface ExerciseSessionProgressProps {
  /** Exercise name */
  exerciseName: string;
  /** Planned sets */
  plannedSets: PlannedSet[];
  /** Completed sets */
  completedSets: CompletedSet[];
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
  exerciseName,
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
    <Card elevation={1} className="mb-4" style={style}>
      <CardContent>
        {/* Header with exercise name */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-content-primary">{exerciseName}</Text>
          {isDiscovery && (
            <Text className="text-sm" style={{ color: colors.primary[500] }}>
              Discovery
            </Text>
          )}
        </View>

        {/* Progress bar */}
        <ProgressBar progress={progress} color={colors.primary[500]} height={6} />

        {error && <Text className="mt-2 text-sm text-danger-light">Error: {error}</Text>}

        {/* Session Plan */}
        <View className="mt-3">
          <View className="flex-row flex-wrap gap-2">
            {plannedSets.map((planned, i) => {
              const completed = completedSets[i];
              const isCurrent = i === currentSetIndex;
              const isCompleted = i < completedSets.length;

              // Determine background color
              let bgColor = colors.surface.dark;
              if (isCompleted) {
                bgColor = colors.success.DEFAULT + '20';
              } else if (isCurrent) {
                bgColor = colors.primary[500] + '20';
              }

              // Border for current set
              const borderStyle = isCurrent
                ? { borderWidth: 2, borderColor: colors.primary[500] }
                : {};

              return (
                <View
                  key={i}
                  className="rounded-xl px-3 py-2"
                  style={{ backgroundColor: bgColor, ...borderStyle }}
                >
                  {/* Set type indicator */}
                  <Text
                    className="mb-1 text-xs font-medium"
                    style={{
                      color: planned.isWarmup ? colors.warning.DEFAULT : colors.primary[500],
                    }}
                  >
                    {planned.isWarmup ? 'Warmup' : 'Working'}
                  </Text>

                  {/* Weight and reps */}
                  <Text className="text-sm font-medium text-content-secondary">
                    {planned.weight}lbs × {planned.targetReps}
                  </Text>

                  {/* Completed stats */}
                  {completed && (
                    <Text className="text-xs text-content-muted">
                      {getSetMeanVelocity(completed.data).toFixed(2)} m/s
                    </Text>
                  )}

                  {/* Current indicator */}
                  {isCurrent && !isCompleted && (
                    <Text className="mt-1 text-xs font-bold" style={{ color: colors.primary[500] }}>
                      Current
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
