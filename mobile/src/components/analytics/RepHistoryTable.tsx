/**
 * RepHistoryTable
 *
 * A table showing rep-by-rep breakdown with tempo, velocity, and force.
 * Uses library functions for per-rep analytics.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import type { Rep } from '@voltras/workout-analytics';
import {
  getRepPeakVelocity,
  getRepPeakForce,
  getRepTempo,
  getPhaseMovementDuration,
  getPhaseHoldDuration,
} from '@voltras/workout-analytics';

const t = getSemanticColors('dark');

export interface RepHistoryTableProps {
  /** Array of reps from library Set */
  reps: readonly Rep[];
}

/**
 * RepHistoryTable component - rep-by-rep breakdown.
 */
export function RepHistoryTable({ reps }: RepHistoryTableProps) {
  if (reps.length === 0) return null;

  return (
    <View>
      {/* Header */}
      <View className="mb-2 flex-row border-b border-surface-100 pb-3">
        <Text className="w-10 text-xs font-medium text-text-disabled">#</Text>
        <Text className="flex-1 text-xs font-medium text-text-disabled">Tempo</Text>
        <Text className="w-16 text-right text-xs font-medium text-text-disabled">Vel</Text>
        <Text className="w-16 text-right text-xs font-medium text-text-disabled">Force</Text>
      </View>

      {/* Rep rows */}
      {reps.map((rep, index) => {
        const isLatest = index === reps.length - 1;
        const eccDuration = getPhaseMovementDuration(rep.eccentric);
        const conDuration = getPhaseMovementDuration(rep.concentric);
        const topPause = getPhaseHoldDuration(rep.concentric);
        const bottomPause = getPhaseHoldDuration(rep.eccentric);
        const tempo = `${eccDuration.toFixed(1)}-${topPause.toFixed(1)}-${conDuration.toFixed(1)}-${bottomPause.toFixed(1)}`;

        return (
          <View
            key={rep.repNumber}
            className={`flex-row items-center py-3 ${
              index < reps.length - 1 ? 'border-b border-surface-100/50' : ''
            }`}
            style={
              isLatest
                ? {
                    backgroundColor: alpha(t['brand-primary-dark'], 0.08),
                    marginHorizontal: -12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                  }
                : undefined
            }
          >
            <Text
              className="w-10 font-bold"
              style={{ color: isLatest ? t['brand-primary'] : t['text-secondary'] }}
            >
              {rep.repNumber}
            </Text>
            <View className="flex-1">
              <Text className="font-mono text-sm text-text-primary">{tempo}</Text>
              <View className="mt-1 flex-row gap-2">
                <Text className="text-xs" style={{ color: t['status-info'] }}>
                  E:{eccDuration.toFixed(1)}
                </Text>
                {topPause > 0.1 && (
                  <Text className="text-xs" style={{ color: t['status-warning'] }}>
                    P:{topPause.toFixed(1)}
                  </Text>
                )}
                <Text className="text-xs" style={{ color: t['status-success'] }}>
                  C:{conDuration.toFixed(1)}
                </Text>
              </View>
            </View>
            <Text
              className="w-16 text-right font-bold"
              style={{ color: isLatest ? t['brand-primary'] : t['text-primary'] }}
            >
              {getRepPeakVelocity(rep).toFixed(2)}
            </Text>
            <Text className="w-16 text-right text-text-secondary">
              {getRepPeakForce(rep).toFixed(0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
