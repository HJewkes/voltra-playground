/**
 * TrainingLoadGauge
 *
 * Displays Acute:Chronic Workload Ratio as a colored indicator.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { getSemanticColors } from '@titan-design/react-ui';
import type { TrainingLoad } from '@/domain/history/services/cross-session-analytics';

const t = getSemanticColors('dark');

export interface TrainingLoadGaugeProps {
  load: TrainingLoad;
  width: number;
}

const STATUS_CONFIG: Record<TrainingLoad['status'], { color: string; label: string }> = {
  undertraining: { color: '#3B82F6', label: 'Undertraining' },
  optimal: { color: '#10B981', label: 'Optimal' },
  caution: { color: '#F59E0B', label: 'Caution' },
  danger: { color: '#EF4444', label: 'Overreaching' },
};

/**
 * TrainingLoadGauge - ACWR visual indicator.
 */
export function TrainingLoadGauge({ load, width }: TrainingLoadGaugeProps) {
  const config = STATUS_CONFIG[load.status];
  const barHeight = 12;
  const padding = 4;
  const barWidth = width - padding * 2;

  // Map ACWR 0-2 to bar position
  const clampedRatio = Math.min(Math.max(load.acwr, 0), 2);
  const markerX = padding + (clampedRatio / 2) * barWidth;

  return (
    <View>
      {/* ACWR value */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-text-primary">ACWR: {load.acwr.toFixed(2)}</Text>
        <Text className="text-xs font-semibold" style={{ color: config.color }}>
          {config.label}
        </Text>
      </View>

      {/* Gauge bar */}
      <Svg width={width} height={barHeight + 8}>
        {/* Background zones */}
        <Rect
          x={padding}
          y={4}
          width={barWidth * 0.4}
          height={barHeight}
          rx={2}
          fill="#3B82F6"
          opacity={0.3}
        />
        <Rect
          x={padding + barWidth * 0.4}
          y={4}
          width={barWidth * 0.25}
          height={barHeight}
          fill="#10B981"
          opacity={0.3}
        />
        <Rect
          x={padding + barWidth * 0.65}
          y={4}
          width={barWidth * 0.1}
          height={barHeight}
          fill="#F59E0B"
          opacity={0.3}
        />
        <Rect
          x={padding + barWidth * 0.75}
          y={4}
          width={barWidth * 0.25}
          height={barHeight}
          rx={2}
          fill="#EF4444"
          opacity={0.3}
        />

        {/* Marker */}
        <Rect x={markerX - 3} y={2} width={6} height={barHeight + 4} rx={3} fill={config.color} />
      </Svg>

      {/* Zone labels */}
      <View className="mt-1 flex-row justify-between">
        <Text style={{ fontSize: 9, color: t['text-disabled'] }}>0.0</Text>
        <Text style={{ fontSize: 9, color: t['text-disabled'] }}>0.8</Text>
        <Text style={{ fontSize: 9, color: t['text-disabled'] }}>1.3</Text>
        <Text style={{ fontSize: 9, color: t['text-disabled'] }}>2.0</Text>
      </View>

      {/* Load values */}
      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs text-text-disabled">
          Acute: {formatCompact(load.acuteLoad)} lbs
        </Text>
        <Text className="text-xs text-text-disabled">
          Chronic: {formatCompact(load.chronicLoad)} lbs/wk
        </Text>
      </View>
    </View>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(Math.round(num));
}
