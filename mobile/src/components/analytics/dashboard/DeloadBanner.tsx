/**
 * DeloadBanner
 *
 * Displays a deload recommendation when the athlete's training load
 * warrants a recovery week. Shown on the analytics dashboard.
 */

import React, { useMemo } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { generateDeloadPlan } from '@/domain/planning/deload-service';

const t = getSemanticColors('dark');

const ACCENT = t['status-warning'];

export interface DeloadBannerProps {
  sessions: StoredExerciseSession[];
  style?: StyleProp<ViewStyle>;
}

/**
 * DeloadBanner — renders only when a deload is recommended.
 */
export function DeloadBanner({ sessions, style }: DeloadBannerProps) {
  const recommendation = useMemo(() => generateDeloadPlan(sessions), [sessions]);

  if (!recommendation.shouldDeload) return null;

  return (
    <Card elevation={1} style={[{ marginBottom: 16 }, style]}>
      <CardContent className="p-0">
        <View
          className="rounded-xl p-4"
          style={{ backgroundColor: alpha(ACCENT, 0.06) }}
        >
          <HStack align="center" gap={10}>
            <Ionicons name="bed-outline" size={24} color={ACCENT} />
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: ACCENT }}>
                Deload Week Recommended
              </Text>
              <Text className="mt-1 text-xs text-text-secondary">
                {recommendation.message}
              </Text>
              <HStack gap={12} style={{ marginTop: 8 }}>
                <StatPill
                  label="Volume"
                  value={`${Math.round((recommendation.volumeReduction ?? 0.65) * 100)}%`}
                />
                <StatPill
                  label="Duration"
                  value={`${recommendation.durationDays ?? 7}d`}
                />
              </HStack>
            </View>
          </HStack>
        </View>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface StatPillProps {
  label: string;
  value: string;
}

function StatPill({ label, value }: StatPillProps) {
  return (
    <View
      className="items-center rounded-lg px-3 py-1"
      style={{ backgroundColor: alpha(ACCENT, 0.12) }}
    >
      <Text className="text-xs font-bold" style={{ color: ACCENT }}>
        {value}
      </Text>
      <Text className="text-xs text-text-disabled">{label}</Text>
    </View>
  );
}
