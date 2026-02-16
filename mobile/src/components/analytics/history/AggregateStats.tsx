/**
 * AggregateStats
 *
 * All-time workout statistics display.
 */

import React from 'react';
import { View } from 'react-native';
import { Stack, StatDisplay } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@titan-design/react-ui';
import { colors } from '@/theme';

export interface AggregateStatsProps {
  totalWorkouts: number;
  totalReps: number;
  totalVolume: number;
}

/**
 * AggregateStats - displays all-time workout stats.
 */
export function AggregateStats({ totalWorkouts, totalReps, totalVolume }: AggregateStatsProps) {
  return (
    <Card elevation={1} className="mb-4">
      <CardHeader>
        <CardTitle>All Time Stats</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Stack direction="row" justify="space-between">
          <StatDisplay value={totalWorkouts} label="Workouts" color={colors.primary[500]} />
          <View className="mx-2 w-px bg-surface-100" />
          <StatDisplay value={totalReps} label="Total Reps" color={colors.primary[500]} />
          <View className="mx-2 w-px bg-surface-100" />
          <StatDisplay
            value={totalVolume.toLocaleString()}
            label="lbs Lifted"
            color={colors.primary[500]}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
