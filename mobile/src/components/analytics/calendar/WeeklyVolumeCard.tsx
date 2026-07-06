/**
 * WeeklyVolumeCard
 *
 * Displays weekly volume per muscle group with MEV/MAV/MRV landmark bars.
 */

import React from 'react';
import { View, Text } from 'react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  getSemanticColors,
} from '@titan-design/react-ui';
import type { VolumeLandmarkComparison } from '@/domain/history';
import { type TrainingLevel, VOLUME_LANDMARKS } from '@/domain/planning/types';

const t = getSemanticColors('dark');

export interface WeeklyVolumeCardProps {
  comparisons: VolumeLandmarkComparison[];
  level: TrainingLevel;
  weekLabel: string;
}

const STATUS_COLORS: Record<VolumeLandmarkComparison['status'], string> = {
  below_mev: '#F59E0B',
  at_mev: '#3B82F6',
  optimal: '#10B981',
  at_mrv: '#F59E0B',
  over_mrv: '#EF4444',
};

const STATUS_LABELS: Record<VolumeLandmarkComparison['status'], string> = {
  below_mev: 'Below MEV',
  at_mev: 'At MEV',
  optimal: 'Optimal',
  at_mrv: 'At MRV',
  over_mrv: 'Over MRV',
};

/**
 * Format muscle group name for display.
 */
function formatMuscleGroup(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * WeeklyVolumeCard - volume per muscle group with landmark comparison.
 */
export function WeeklyVolumeCard({ comparisons, level, weekLabel }: WeeklyVolumeCardProps) {
  const landmarks = VOLUME_LANDMARKS[level];

  if (comparisons.length === 0) {
    return (
      <Card elevation={1} className="mb-4">
        <CardHeader>
          <CardTitle>Weekly Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-text-disabled">No volume data for {weekLabel}</Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={1} className="mb-4">
      <CardHeader>
        <CardTitle>Weekly Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <Text className="mb-3 text-xs text-text-disabled">{weekLabel}</Text>

        {comparisons.map((comparison) => (
          <View key={comparison.muscleGroup} className="mb-3">
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-primary">
                {formatMuscleGroup(comparison.muscleGroup)}
              </Text>
              <View className="flex-row items-center">
                <Text className="mr-2 text-sm font-bold text-text-primary">
                  {comparison.sets} sets
                </Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: STATUS_COLORS[comparison.status] }}
                >
                  {STATUS_LABELS[comparison.status]}
                </Text>
              </View>
            </View>

            {/* Volume bar */}
            <VolumeBar
              sets={comparison.sets}
              mev={landmarks.mev}
              mav={landmarks.mav}
              mrv={landmarks.mrv}
              status={comparison.status}
            />
          </View>
        ))}

        {/* Legend */}
        <View className="border-surface-100 mt-2 flex-row justify-between border-t pt-2">
          <LegendItem label="MEV" value={landmarks.mev} />
          <LegendItem label="MAV" value={landmarks.mav} />
          <LegendItem label="MRV" value={landmarks.mrv} />
        </View>
      </CardContent>
    </Card>
  );
}

/**
 * Visual bar showing volume relative to landmarks.
 */
function VolumeBar({
  sets,
  mrv,
  status,
}: {
  sets: number;
  mev: number;
  mav: number;
  mrv: number;
  status: VolumeLandmarkComparison['status'];
}) {
  const maxDisplay = mrv + 4;
  const fillPercent = Math.min((sets / maxDisplay) * 100, 100);

  return (
    <View
      className="h-2 overflow-hidden rounded-full"
      style={{ backgroundColor: t['surface-elevated'] }}
    >
      <View
        className="h-full rounded-full"
        style={{
          width: `${fillPercent}%`,
          backgroundColor: STATUS_COLORS[status],
        }}
      />
    </View>
  );
}

/**
 * Legend item for volume landmarks.
 */
function LegendItem({ label, value }: { label: string; value: number }) {
  return (
    <Text className="text-xs text-text-disabled">
      {label}: {value} sets/wk
    </Text>
  );
}
