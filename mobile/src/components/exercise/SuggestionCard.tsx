/**
 * SuggestionCard
 *
 * Displays the top workout suggestion from WorkoutSuggestionService.
 * Shown on the exercise screen when no workout is active (above ConfigSection).
 * Includes a "Start" button that calls onStart with the suggested exercise ID.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { ExerciseSuggestion } from '@/domain/history/services/workout-suggestion-service';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface SuggestionCardProps {
  suggestion: ExerciseSuggestion;
  onStart: (exerciseId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * SuggestionCard — compact card showing the top suggested exercise with a
 * one-tap Start button.
 */
export function SuggestionCard({ suggestion, onStart }: SuggestionCardProps) {
  return (
    <Card
      elevation={1}
      style={{ backgroundColor: alpha(t['brand-primary'], 0.07) }}
      className="mb-3"
    >
      <CardContent className="px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <View className="mb-1 flex-row items-center gap-2">
              <Ionicons name="sparkles-outline" size={14} color={t['brand-primary']} />
              <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: t['brand-primary'] }}>
                Suggested
              </Text>
            </View>
            <Text className="text-base font-bold text-text-primary">
              {suggestion.exerciseName}
            </Text>
            <Text className="mt-0.5 text-xs text-text-disabled">{suggestion.reason}</Text>
          </View>

          <Pressable
            onPress={() => onStart(suggestion.exerciseId)}
            accessibilityRole="button"
            accessibilityLabel={`Start ${suggestion.exerciseName}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View
              className="flex-row items-center gap-1 rounded-full px-4 py-2"
              style={{ backgroundColor: t['brand-primary'] }}
            >
              <Text className="text-sm font-bold text-white">Start</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </Pressable>
        </View>
      </CardContent>
    </Card>
  );
}
