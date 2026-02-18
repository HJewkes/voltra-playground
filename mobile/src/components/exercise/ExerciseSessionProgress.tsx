/**
 * ExerciseSessionProgress
 *
 * Progress indicator showing session status and completed sets.
 * Adapted from DiscoveryProgress to work with PlannedSet and Set.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Card, CardContent, Progress, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { PlannedSet, CompletedSet } from '@/domain/workout';
import { getSetMeanVelocity } from '@voltras/workout-analytics';

const t = getSemanticColors('dark');

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
          <Text className="text-lg font-bold text-text-primary">{exerciseName}</Text>
          {isDiscovery && (
            <Text className="text-sm" style={{ color: t['brand-primary'] }}>
              Discovery
            </Text>
          )}
        </View>

        {/* Progress bar */}
        <Progress value={progress * 100} color="primary" size="md" />

        {error && <Text className="mt-2 text-sm text-status-error-light">Error: {error}</Text>}

        {/* Session Plan */}
        <View className="mt-3">
          <View className="flex-row flex-wrap gap-2">
            {plannedSets.map((planned, i) => {
              const completed = completedSets[i];
              const isCurrent = i === currentSetIndex;
              const isCompleted = i < completedSets.length;

              // Determine background color
              let bgColor: string = t['background-subtle'];
              if (isCompleted) {
                bgColor = alpha(t['status-success'], 0.12);
              } else if (isCurrent) {
                bgColor = alpha(t['brand-primary'], 0.12);
              }

              // Border for current set
              const borderStyle = isCurrent
                ? { borderWidth: 2, borderColor: t['brand-primary'] }
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
                      color: planned.isWarmup ? t['status-warning'] : t['brand-primary'],
                    }}
                  >
                    {planned.isWarmup ? 'Warmup' : 'Working'}
                  </Text>

                  {/* Weight and reps */}
                  <Text className="text-sm font-medium text-text-secondary">
                    {planned.weight}lbs × {planned.targetReps}
                  </Text>

                  {/* Completed stats */}
                  {completed && (
                    <Text className="text-xs text-text-disabled">
                      {getSetMeanVelocity(completed.data).toFixed(2)} m/s
                    </Text>
                  )}

                  {/* Current indicator */}
                  {isCurrent && !isCompleted && (
                    <Text className="mt-1 text-xs font-bold" style={{ color: t['brand-primary'] }}>
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
