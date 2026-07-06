/**
 * StreakCard
 *
 * Displays training streak and consistency score:
 * - Current streak (consecutive training days, 1 rest-day gap allowed)
 * - Longest streak ever recorded
 * - Weekly consistency as a percentage of the 4-session default target
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computeStreak } from '@/domain/history/services/streak-service';

const t = getSemanticColors('dark');

const WEEKLY_TARGET = 4;

export interface StreakCardProps {
  sessions: StoredExerciseSession[];
}

/**
 * StreakCard - streak and consistency overview.
 */
export function StreakCard({ sessions }: StreakCardProps) {
  const streak = useMemo(() => computeStreak(sessions, WEEKLY_TARGET), [sessions]);
  const hasData = sessions.some((s) => s.status === 'completed');

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <Text className="mb-3 font-bold text-text-secondary">Training Streak</Text>

        {!hasData ? (
          <Text className="py-4 text-center text-sm text-text-disabled">
            Complete a session to start your streak
          </Text>
        ) : (
          <View className="flex-row justify-between">
            <StatBlock value={streak.currentStreak} label="Current" unit="days" highlighted />
            <Divider />
            <StatBlock value={streak.longestStreak} label="Longest" unit="days" />
            <Divider />
            <StatBlock value={streak.weeklyConsistency} label="This Week" unit="%" />
          </View>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface StatBlockProps {
  value: number;
  label: string;
  unit: string;
  highlighted?: boolean;
}

function StatBlock({ value, label, unit, highlighted = false }: StatBlockProps) {
  return (
    <View
      className="flex-1 items-center rounded-xl py-3"
      style={highlighted ? { backgroundColor: alpha(t['brand-primary-dark'], 0.12) } : undefined}
    >
      <View className="flex-row items-end">
        <Text
          className="text-2xl font-bold"
          style={{ color: highlighted ? t['brand-primary'] : t['text-primary'] }}
        >
          {value}
        </Text>
        <Text
          className="mb-0.5 ml-0.5 text-xs"
          style={{ color: highlighted ? t['brand-primary'] : t['text-disabled'] }}
        >
          {unit}
        </Text>
      </View>
      <Text className="mt-0.5 text-xs text-text-disabled">{label}</Text>
    </View>
  );
}

function Divider() {
  return (
    <View className="mx-1 self-stretch" style={{ width: 1, backgroundColor: t['border-subtle'] }} />
  );
}
