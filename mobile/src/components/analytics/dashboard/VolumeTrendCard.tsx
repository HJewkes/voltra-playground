/**
 * VolumeTrendCard
 *
 * Shows volume trends over time with weekly/monthly toggle.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Card, CardContent, getSemanticColors } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  computeVolumeBuckets,
  type TimeRange,
} from '@/domain/history/services/cross-session-analytics';
import { BarChart } from '../charts/BarChart';

const t = getSemanticColors('dark');

export interface VolumeTrendCardProps {
  sessions: StoredExerciseSession[];
}

/**
 * VolumeTrendCard - volume trend bar chart with time range toggle.
 */
export function VolumeTrendCard({ sessions }: VolumeTrendCardProps) {
  const [range, setRange] = useState<TimeRange>('weekly');
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64;

  const buckets = useMemo(
    () => computeVolumeBuckets(sessions, range, range === 'weekly' ? 8 : 6),
    [sessions, range]
  );

  const data = useMemo(
    () => buckets.map((b) => ({ label: b.label, value: b.totalVolume })),
    [buckets]
  );

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-bold text-text-secondary">Volume Trend</Text>
          <RangeToggle value={range} onChange={setRange} />
        </View>

        {data.length === 0 ? (
          <Text className="py-4 text-center text-sm text-text-disabled">No volume data yet</Text>
        ) : (
          <BarChart
            data={data}
            width={chartWidth}
            height={160}
            barColor={t['brand-primary']}
            showValues
          />
        )}
      </CardContent>
    </Card>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <View className="flex-row rounded-md p-0.5" style={{ backgroundColor: t['surface-elevated'] }}>
      <ToggleButton label="Week" active={value === 'weekly'} onPress={() => onChange('weekly')} />
      <ToggleButton
        label="Month"
        active={value === 'monthly'}
        onPress={() => onChange('monthly')}
      />
    </View>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-md px-3 py-1"
      style={active ? { backgroundColor: t['brand-primary'] } : undefined}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : t['text-disabled'],
          fontSize: 11,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
