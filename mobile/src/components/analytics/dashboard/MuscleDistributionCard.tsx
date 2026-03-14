/**
 * MuscleDistributionCard
 *
 * Shows muscle group training distribution as horizontal bars.
 */

import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { Card, CardContent } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computeMuscleGroupDistribution } from '@/domain/history/services/cross-session-analytics';
import { HorizontalBarChart } from '../charts/HorizontalBarChart';

export interface MuscleDistributionCardProps {
  sessions: StoredExerciseSession[];
}

/**
 * MuscleDistributionCard - muscle group distribution chart.
 */
export function MuscleDistributionCard({ sessions }: MuscleDistributionCardProps) {
  const distribution = useMemo(
    () => computeMuscleGroupDistribution(sessions),
    [sessions]
  );

  const data = useMemo(
    () =>
      distribution.map((d) => ({
        label: d.muscleGroup,
        value: d.sets,
        percentage: d.percentage,
      })),
    [distribution]
  );

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <Text className="mb-3 font-bold text-text-secondary">Muscle Groups</Text>

        {data.length === 0 ? (
          <Text className="py-4 text-center text-sm text-text-disabled">
            No muscle group data yet
          </Text>
        ) : (
          <HorizontalBarChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
