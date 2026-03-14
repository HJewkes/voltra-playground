/**
 * ReadinessIndicator
 *
 * Displays athlete readiness based on warmup velocity compared to baseline.
 * Shows a green/yellow/red zone indicator with explanation text and
 * an auto-suggested intensity adjustment.
 *
 * Shown after first set completion, before working sets begin.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors } from '@titan-design/react-ui';
import type { ReadinessAssessment } from '@/domain/workout';

const t = getSemanticColors('dark');

export interface ReadinessIndicatorProps {
  /** Readiness assessment result */
  assessment: ReadinessAssessment;
}

/**
 * Map readiness zone to a background color.
 */
export function getReadinessColor(zone: 'green' | 'yellow' | 'red'): string {
  switch (zone) {
    case 'green':
      return t['status-success'];
    case 'yellow':
      return t['status-warning'];
    case 'red':
      return t['status-error'];
  }
}

/**
 * Map readiness zone to a user-facing label.
 */
export function getReadinessLabel(zone: 'green' | 'yellow' | 'red'): string {
  switch (zone) {
    case 'green':
      return 'Ready';
    case 'yellow':
      return 'Moderate';
    case 'red':
      return 'Fatigued';
  }
}

/**
 * ReadinessIndicator - colored card with readiness zone, velocity ratio,
 * and intensity adjustment suggestion.
 *
 * @example
 * ```tsx
 * <ReadinessIndicator assessment={readinessResult} />
 * ```
 */
export function ReadinessIndicator({ assessment }: ReadinessIndicatorProps) {
  const { estimate, adjustment, hasBaseline } = assessment;
  const color = getReadinessColor(estimate.zone);
  const label = getReadinessLabel(estimate.zone);

  return (
    <View className="overflow-hidden rounded-2xl" style={{ backgroundColor: color }}>
      <View className="items-center px-6 py-5">
        <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-white/70">
          Readiness
        </Text>
        <Text className="text-3xl font-bold text-white">{label}</Text>
        {hasBaseline && estimate.velocityRatio > 0 && (
          <Text className="mt-1 text-base text-white/80">
            {Math.round(estimate.velocityRatio * 100)}% of baseline velocity
          </Text>
        )}
      </View>
      <View
        className="px-6 py-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
      >
        <Text className="text-center text-sm font-medium text-white">
          {adjustment.suggestion}
        </Text>
      </View>
    </View>
  );
}
