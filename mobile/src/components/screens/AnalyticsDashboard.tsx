/**
 * AnalyticsDashboard
 *
 * Cross-session analytics dashboard showing volume trends, PRs,
 * muscle group distribution, training load, and exercise frequency.
 */

import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { getSemanticColors } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { VolumeTrendCard } from '@/components/analytics/dashboard/VolumeTrendCard';
import { PRTimelineCard } from '@/components/analytics/dashboard/PRTimelineCard';
import { MuscleDistributionCard } from '@/components/analytics/dashboard/MuscleDistributionCard';
import { TrainingLoadCard } from '@/components/analytics/dashboard/TrainingLoadCard';
import { ExerciseFrequencyCard } from '@/components/analytics/dashboard/ExerciseFrequencyCard';
import { StreakCard } from '@/components/analytics/dashboard/StreakCard';
import { DeloadBanner } from '@/components/analytics/dashboard/DeloadBanner';

const t = getSemanticColors('dark');

export interface AnalyticsDashboardProps {
  sessions: StoredExerciseSession[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * AnalyticsDashboard - scrollable analytics view.
 */
export function AnalyticsDashboard({ sessions, isLoading, onRefresh }: AnalyticsDashboardProps) {
  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={t['brand-primary']}
        />
      }
    >
      <View className="p-4">
        <DeloadBanner sessions={sessions} />
        <StreakCard sessions={sessions} />
        <VolumeTrendCard sessions={sessions} />
        <PRTimelineCard sessions={sessions} />
        <MuscleDistributionCard sessions={sessions} />
        <TrainingLoadCard sessions={sessions} />
        <ExerciseFrequencyCard sessions={sessions} />
      </View>
    </ScrollView>
  );
}
