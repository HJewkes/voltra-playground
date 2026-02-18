/**
 * DiscoveryProgress
 *
 * Progress indicator showing discovery status and completed sets.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Card, CardContent, Progress, getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface CompletedSet {
  weight: number;
  actualReps: number;
  meanVelocity: number;
}

export interface DiscoveryProgressProps {
  /** Number of sets completed */
  completedCount: number;
  /** Total sets expected (approximate) */
  totalSets?: number;
  /** Current device weight */
  deviceWeight: number;
  /** Target weight for current step */
  targetWeight: number | null;
  /** Completed sets data */
  completedSets: CompletedSet[];
  /** Any error message */
  error?: string | null;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * DiscoveryProgress component - shows discovery status.
 *
 * @example
 * ```tsx
 * <DiscoveryProgress
 *   completedCount={completedSets.length}
 *   deviceWeight={weight}
 *   targetWeight={currentStep?.weight}
 *   completedSets={completedSets}
 * />
 * ```
 */
export function DiscoveryProgress({
  completedCount,
  totalSets = 4,
  deviceWeight,
  targetWeight,
  completedSets,
  error,
  style,
}: DiscoveryProgressProps) {
  const progress = Math.min(100, (completedCount / totalSets) * 100);

  return (
    <View style={style}>
      {/* Progress indicator */}
      <Card elevation={1} className="mb-4">
        <CardContent>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-semibold text-text-secondary">Discovery Progress</Text>
            <Text className="font-bold" style={{ color: t['brand-primary'] }}>
              Set {completedCount + 1}
            </Text>
          </View>

          <Progress value={progress * 100} color="primary" size="lg" />

          <Text className="mt-2 text-xs text-text-disabled">
            Device: {deviceWeight} lbs | Target: {targetWeight ?? '-'} lbs
          </Text>

          {error && <Text className="mt-2 text-sm text-status-error-light">Error: {error}</Text>}
        </CardContent>
      </Card>

      {/* Completed sets */}
      {completedSets.length > 0 && (
        <Card elevation={1} className="mb-4">
          <CardContent>
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
              Completed
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {completedSets.map((set, i) => (
                <View
                  key={i}
                  className="rounded-xl px-4 py-2"
                  style={{ backgroundColor: t['background-subtle'] }}
                >
                  <Text className="text-sm font-medium text-text-secondary">
                    {set.weight}lbs × {set.actualReps} @ {set.meanVelocity.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
