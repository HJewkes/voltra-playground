/**
 * ProgressionCard
 *
 * Shows velocity/e1RM/volume comparison against the previous session.
 * Displayed during rest or pre-set phases in the exercise screen.
 */

import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type {
  ExerciseProgression,
  MetricComparison,
  TrendDirection,
} from '@/domain/history/services/progression-service';
import { formatTimeAgo } from '@/domain/history/services/exercise-picker-history';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface ProgressionCardProps {
  progression: ExerciseProgression;
}

export interface LastSessionBannerProps {
  exerciseName: string;
  date: number;
  weight: number;
  velocity: number;
  sets: number;
  reps: number;
  onRepeat?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function getTrendIcon(direction: TrendDirection): keyof typeof Ionicons.glyphMap {
  switch (direction) {
    case 'up':
      return 'trending-up';
    case 'down':
      return 'trending-down';
    case 'flat':
      return 'remove-outline';
  }
}

function getTrendColor(direction: TrendDirection, isVelocity: boolean): string {
  if (direction === 'flat') return t['text-disabled'];
  if (isVelocity) {
    return direction === 'down' ? t['status-warning'] : t['status-success'];
  }
  return direction === 'up' ? t['status-success'] : t['status-warning'];
}

// =============================================================================
// MetricRow
// =============================================================================

function MetricRow({
  metric,
  isVelocity = false,
}: {
  metric: MetricComparison;
  isVelocity?: boolean;
}) {
  const color = getTrendColor(metric.direction, isVelocity);
  const icon = getTrendIcon(metric.direction);
  const sign = metric.delta > 0 ? '+' : '';

  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-1">
        <Text className="text-sm text-text-disabled">{metric.label}</Text>
        <Text className="text-lg font-bold text-text-primary">
          {metric.current} {metric.unit}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Ionicons name={icon} size={18} color={color} />
        <Text className="ml-1 font-semibold" style={{ color }}>
          {sign}{metric.delta} ({sign}{metric.deltaPercent}%)
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// ProgressionCard
// =============================================================================

/**
 * ProgressionCard - shows velocity/e1RM/volume trends vs last session.
 */
export function ProgressionCard({ progression }: ProgressionCardProps) {
  return (
    <Card elevation={1} className="mb-3">
      <CardContent className="p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-bold text-text-secondary">
            vs Last Session
          </Text>
          <Text className="text-xs text-text-disabled">
            {formatTimeAgo(progression.previousSessionDate)}
          </Text>
        </View>

        {progression.weight > 0 && (
          <Text className="mb-2 text-xs text-text-disabled">
            @ {progression.weight} lbs
          </Text>
        )}

        <MetricRow metric={progression.velocity} isVelocity />
        <View className="my-1 h-px" style={{ backgroundColor: alpha(t['border-default'], 0.3) }} />
        <MetricRow metric={progression.e1RM} />
        <View className="my-1 h-px" style={{ backgroundColor: alpha(t['border-default'], 0.3) }} />
        <MetricRow metric={progression.volume} />
      </CardContent>
    </Card>
  );
}

// =============================================================================
// LastSessionBanner
// =============================================================================

/**
 * LastSessionBanner - compact banner shown at session start.
 */
export function LastSessionBanner({
  exerciseName,
  date,
  weight,
  velocity,
  sets,
  reps,
  onRepeat,
}: LastSessionBannerProps) {
  return (
    <View
      className="mb-3 rounded-lg px-3 py-2"
      style={{ backgroundColor: alpha(t['brand-primary'], 0.08) }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color={t['text-disabled']} />
          <Text className="ml-1 text-xs text-text-disabled">
            Last {exerciseName}: {formatTimeAgo(date)}
          </Text>
        </View>
        {onRepeat && (
          <Pressable
            onPress={onRepeat}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Repeat last session"
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="refresh-outline" size={14} color={t['brand-primary']} />
              <Text className="text-xs font-semibold" style={{ color: t['brand-primary'] }}>
                Repeat
              </Text>
            </View>
          </Pressable>
        )}
      </View>
      <Text className="mt-1 text-sm text-text-secondary">
        {weight} lbs @ {velocity} m/s &middot; {sets}x{reps} reps
      </Text>
    </View>
  );
}
