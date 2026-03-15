/**
 * AutoPlanCard
 *
 * One-tap "Start Workout" card shown when the exercise screen is idle with
 * no active session. Displays the auto-planned exercise, weight, and
 * sets x reps summary. Includes a "Start" button and a "Change" link to
 * open the exercise picker.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { AutoPlan } from '@/domain/planning/auto-plan-service';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface AutoPlanCardProps {
  autoPlan: AutoPlan;
  onStart: () => void;
  onChange: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function AutoPlanCard({ autoPlan, onStart, onChange }: AutoPlanCardProps) {
  return (
    <Card
      elevation={1}
      style={{ backgroundColor: alpha(t['brand-primary'], 0.07) }}
      className="mb-3"
    >
      <CardContent className="px-4 py-3">
        <View className="mb-2 flex-row items-center gap-2">
          <Ionicons name="flash-outline" size={14} color={t['brand-primary']} />
          <Text
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: t['brand-primary'] }}
          >
            Start Workout
          </Text>
        </View>

        <Text className="text-base font-bold text-text-primary">
          {autoPlan.exercise.name}
        </Text>
        <Text className="mt-0.5 text-sm text-text-secondary">
          {autoPlan.summary}
        </Text>

        <View className="mt-3 flex-row items-center justify-between">
          <Pressable
            onPress={onChange}
            accessibilityRole="button"
            accessibilityLabel="Change exercise"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: t['brand-primary'] }}
            >
              Change
            </Text>
          </Pressable>

          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel={`Start ${autoPlan.exercise.name}`}
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
