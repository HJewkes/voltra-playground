/**
 * TrainingLoadCard
 *
 * Displays ACWR training load gauge.
 */

import React, { useMemo } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { Card, CardContent } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computeTrainingLoad } from '@/domain/history/services/cross-session-analytics';
import { TrainingLoadGauge } from '../charts/TrainingLoadGauge';

export interface TrainingLoadCardProps {
  sessions: StoredExerciseSession[];
}

/**
 * TrainingLoadCard - ACWR gauge card.
 */
export function TrainingLoadCard({ sessions }: TrainingLoadCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const gaugeWidth = screenWidth - 64;

  const load = useMemo(() => computeTrainingLoad(sessions), [sessions]);

  const hasData = load.acuteLoad > 0 || load.chronicLoad > 0;

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <Text className="mb-3 font-bold text-text-secondary">Training Load</Text>

        {!hasData ? (
          <Text className="py-4 text-center text-sm text-text-disabled">
            Need at least 2 weeks of data
          </Text>
        ) : (
          <TrainingLoadGauge load={load} width={gaugeWidth} />
        )}
      </CardContent>
    </Card>
  );
}
