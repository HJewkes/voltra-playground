/**
 * PRTimelineCard
 *
 * Shows personal record progression timeline.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { computePRTimeline, type PRTimelineEntry } from '@/domain/history/services/cross-session-analytics';

const t = getSemanticColors('dark');

export interface PRTimelineCardProps {
  sessions: StoredExerciseSession[];
}

const PR_ICONS: Record<PRTimelineEntry['type'], keyof typeof Ionicons.glyphMap> = {
  max_weight: 'barbell',
  max_reps: 'repeat',
  max_velocity: 'flash',
  max_volume: 'trending-up',
};

const PR_LABELS: Record<PRTimelineEntry['type'], string> = {
  max_weight: 'Weight',
  max_reps: 'Reps',
  max_velocity: 'Velocity',
  max_volume: 'Volume',
};

/**
 * PRTimelineCard - shows chronological PR progression.
 */
export function PRTimelineCard({ sessions }: PRTimelineCardProps) {
  const timeline = useMemo(() => {
    const all = computePRTimeline(sessions);
    return all.slice(-12).reverse();
  }, [sessions]);

  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-4">
        <Text className="mb-3 font-bold text-text-secondary">PR Timeline</Text>

        {timeline.length === 0 ? (
          <Text className="py-4 text-center text-sm text-text-disabled">
            No personal records yet
          </Text>
        ) : (
          <View>
            {timeline.map((entry, i) => (
              <PRTimelineItem key={`${entry.type}-${entry.date}-${i}`} entry={entry} />
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function PRTimelineItem({ entry }: { entry: PRTimelineEntry }) {
  const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View className="mb-2 flex-row items-center">
      <View
        className="mr-3 h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: alpha(t['status-warning'], 0.12) }}
      >
        <Ionicons name={PR_ICONS[entry.type]} size={14} color={t['status-warning']} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">
          {formatPRValue(entry)}
        </Text>
        <Text className="text-xs text-text-disabled">
          {PR_LABELS[entry.type]} - {entry.exerciseName}
        </Text>
      </View>
      <Text className="text-xs text-text-disabled">{dateStr}</Text>
    </View>
  );
}

function formatPRValue(entry: PRTimelineEntry): string {
  switch (entry.type) {
    case 'max_weight':
      return `${entry.value} lbs`;
    case 'max_reps':
      return `${entry.value} reps`;
    case 'max_velocity':
      return `${entry.value.toFixed(2)} m/s`;
    case 'max_volume':
      return `${formatCompact(entry.value)} lbs`;
    default:
      return String(entry.value);
  }
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(Math.round(num));
}
