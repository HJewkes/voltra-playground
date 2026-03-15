/**
 * FatigueGauge
 *
 * Colored progress bar showing session-level fatigue from velocity trend.
 * Green → yellow → orange → red as fatigue accumulates.
 *
 * Visible on the exercise screen after the first set at a given weight
 * is completed and a second comparable set exists.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { HStack, getSemanticColors } from '@titan-design/react-ui';
import type { SessionFatigueResult, FatigueTrend } from '@/domain/workout/session/session-fatigue';

const t = getSemanticColors('dark');

const TREND_LABEL: Record<FatigueTrend, string> = {
  fresh: 'Fresh',
  moderate: 'Moderate',
  fatigued: 'Fatigued',
  exhausted: 'Exhausted',
};

/** Colors map to the green→yellow→orange→red spectrum. */
const TREND_COLOR: Record<FatigueTrend, string> = {
  fresh: t['status-success'],
  moderate: '#A8C230',
  fatigued: t['status-warning'],
  exhausted: t['status-error'],
};

export interface FatigueGaugeProps {
  fatigue: SessionFatigueResult;
  style?: StyleProp<ViewStyle>;
}

export function FatigueGauge({ fatigue, style }: FatigueGaugeProps) {
  const { fatigueScore, trend, velocityDecline } = fatigue;
  const color = TREND_COLOR[trend];
  const label = TREND_LABEL[trend];
  const fillPct = Math.min(100, Math.max(0, fatigueScore));

  return (
    <View style={style}>
      <HStack align="center" justify="between" gap={8}>
        <Text className="text-xs font-medium text-text-secondary">Session Fatigue</Text>
        <HStack align="center" gap={6}>
          <Text className="text-xs font-semibold" style={{ color }}>
            {label}
          </Text>
          <Text className="text-xs text-text-disabled">
            {velocityDecline > 0
              ? `-${velocityDecline.toFixed(2)} m/s`
              : `+${Math.abs(velocityDecline).toFixed(2)} m/s`}
          </Text>
        </HStack>
      </HStack>

      {/* Track */}
      <View
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: t['surface-raised'] }}
      >
        {/* Fill */}
        <View
          className="h-full rounded-full"
          style={{ width: `${fillPct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}
