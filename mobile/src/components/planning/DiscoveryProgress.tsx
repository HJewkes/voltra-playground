/**
 * DiscoveryProgress
 * 
 * Progress indicator showing discovery status and completed sets.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors } from '@/theme';
import { Card, ProgressBar } from '../ui';

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
      <Card elevation={1} padding="md" radius="lg">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-content-secondary font-semibold">Discovery Progress</Text>
          <Text className="font-bold" style={{ color: colors.primary[500] }}>
            Set {completedCount + 1}
          </Text>
        </View>
        
        <ProgressBar 
          progress={progress} 
          color={colors.primary[500]}
          height={8}
        />
        
        <Text className="text-content-muted text-xs mt-2">
          Device: {deviceWeight} lbs | Target: {targetWeight ?? '-'} lbs
        </Text>
        
        {error && (
          <Text className="text-danger-light text-sm mt-2">Error: {error}</Text>
        )}
      </Card>
      
      {/* Completed sets */}
      {completedSets.length > 0 && (
        <Card elevation={1} padding="md" radius="lg">
          <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
            Completed
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {completedSets.map((set, i) => (
              <View 
                key={i} 
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: colors.surface.dark }}
              >
                <Text className="text-content-secondary text-sm font-medium">
                  {set.weight}lbs × {set.actualReps} @ {set.meanVelocity.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}
