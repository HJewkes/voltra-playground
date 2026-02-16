/**
 * AggregateStats
 *
 * All-time workout statistics display.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Metric, MetricGroup } from '@titan-design/react-ui';

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
        <MetricGroup>
          <Metric value={String(totalWorkouts)} label="Workouts" />
          <Metric value={String(totalReps)} label="Total Reps" />
          <Metric value={totalVolume.toLocaleString()} label="lbs Lifted" />
        </MetricGroup>
      </CardContent>
    </Card>
  );
}
