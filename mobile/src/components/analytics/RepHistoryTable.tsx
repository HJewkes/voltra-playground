/**
 * RepHistoryTable
 *
 * A table showing rep-by-rep breakdown with tempo, velocity, and force.
 * Uses phase-specific velocities from the Rep model.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '@/theme';
import type { Rep } from '@/domain/workout';

export interface RepHistoryTableProps {
  /** Array of reps with phase-specific metrics */
  reps: Rep[];
}

/**
 * RepHistoryTable component - rep-by-rep breakdown.
 * 
 * @example
 * ```tsx
 * <RepHistoryTable reps={workoutReps} />
 * ```
 */
export function RepHistoryTable({ reps }: RepHistoryTableProps) {
  if (reps.length === 0) return null;
  
  return (
    <View>
      {/* Header */}
      <View className="flex-row pb-3 border-b border-surface-100 mb-2">
        <Text className="text-content-muted text-xs font-medium w-10">#</Text>
        <Text className="text-content-muted text-xs font-medium flex-1">Tempo</Text>
        <Text className="text-content-muted text-xs font-medium w-16 text-right">Vel</Text>
        <Text className="text-content-muted text-xs font-medium w-16 text-right">Force</Text>
      </View>
      
      {/* Rep rows */}
      {reps.map((rep, index) => {
        const isLatest = index === reps.length - 1;
        const { metrics } = rep;
        const tempo = `${metrics.eccentricDuration.toFixed(1)}-${metrics.topPauseTime.toFixed(1)}-${metrics.concentricDuration.toFixed(1)}-${metrics.bottomPauseTime.toFixed(1)}`;
        
        return (
          <View 
            key={rep.repNumber}
            className={`flex-row items-center py-3 ${
              index < reps.length - 1 ? 'border-b border-surface-100/50' : ''
            }`}
            style={isLatest ? { 
              backgroundColor: colors.primary[600] + '15', 
              marginHorizontal: -12, 
              paddingHorizontal: 12,
              borderRadius: 12,
            } : undefined}
          >
            <Text 
              className="w-10 font-bold"
              style={{ color: isLatest ? colors.primary[500] : colors.text.secondary }}
            >
              {rep.repNumber}
            </Text>
            <View className="flex-1">
              <Text className="text-content-primary text-sm font-mono">
                {tempo}
              </Text>
              <View className="flex-row gap-2 mt-1">
                <Text className="text-xs" style={{ color: colors.info.DEFAULT }}>
                  E:{metrics.eccentricDuration.toFixed(1)}
                </Text>
                {metrics.topPauseTime > 0.1 && (
                  <Text className="text-xs" style={{ color: colors.warning.DEFAULT }}>
                    P:{metrics.topPauseTime.toFixed(1)}
                  </Text>
                )}
                <Text className="text-xs" style={{ color: colors.success.DEFAULT }}>
                  C:{metrics.concentricDuration.toFixed(1)}
                </Text>
              </View>
            </View>
            <Text 
              className="w-16 text-right font-bold"
              style={{ color: isLatest ? colors.primary[500] : colors.text.primary }}
            >
              {metrics.concentricPeakVelocity.toFixed(2)}
            </Text>
            <Text className="w-16 text-right text-content-secondary">
              {metrics.peakForce.toFixed(0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
