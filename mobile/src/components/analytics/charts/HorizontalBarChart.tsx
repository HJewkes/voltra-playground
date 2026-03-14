/**
 * HorizontalBarChart
 *
 * Horizontal bar chart for muscle group distribution.
 * Shows label, bar, and percentage.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface HorizontalBarItem {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface HorizontalBarChartProps {
  data: HorizontalBarItem[];
}

const MUSCLE_COLORS: Record<string, string> = {
  quads: '#3B82F6',
  hamstrings: '#8B5CF6',
  glutes: '#EC4899',
  back: '#10B981',
  chest: '#F59E0B',
  shoulders: '#EF4444',
  biceps: '#06B6D4',
  triceps: '#F97316',
  core: '#84CC16',
  calves: '#A78BFA',
};

/**
 * HorizontalBarChart - labeled horizontal bars with percentage.
 */
export function HorizontalBarChart({ data }: HorizontalBarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      {data.map((item) => {
        const fillPercent = (item.value / maxValue) * 100;
        const color = item.color ?? MUSCLE_COLORS[item.label.toLowerCase()] ?? t['brand-primary'];

        return (
          <View key={item.label} className="mb-3">
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-xs font-medium text-text-primary">
                {formatMuscleGroup(item.label)}
              </Text>
              <Text className="text-xs text-text-disabled">
                {item.value} sets ({item.percentage}%)
              </Text>
            </View>
            <View
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: t['surface-elevated'] }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${fillPercent}%`,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatMuscleGroup(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
