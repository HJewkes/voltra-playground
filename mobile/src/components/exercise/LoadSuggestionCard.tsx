/**
 * LoadSuggestionCard
 *
 * Displays recommended weight adjustment between sets.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { LoadSuggestion } from '@/domain/planning/auto-regulation';

const t = getSemanticColors('dark');

export interface LoadSuggestionCardProps {
  suggestion: LoadSuggestion;
  style?: StyleProp<ViewStyle>;
}

export function LoadSuggestionCard({ suggestion, style }: LoadSuggestionCardProps) {
  const { currentWeight, suggestedWeight, direction, reason, confidence } = suggestion;

  const iconName =
    direction === 'increase'
      ? 'arrow-up-circle'
      : direction === 'decrease'
        ? 'arrow-down-circle'
        : 'checkmark-circle';

  const iconColor =
    direction === 'increase'
      ? t['status-success']
      : direction === 'decrease'
        ? t['status-warning']
        : t['brand-primary'];

  const bgColor =
    direction === 'increase'
      ? alpha(t['status-success'], 0.08)
      : direction === 'decrease'
        ? alpha(t['status-warning'], 0.08)
        : alpha(t['brand-primary'], 0.08);

  const delta = suggestedWeight - currentWeight;
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <Card elevation={1} style={[{ backgroundColor: bgColor }, style]}>
      <CardContent>
        <HStack align="center" gap={12}>
          <Ionicons name={iconName} size={28} color={iconColor} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-primary">
              {direction === 'maintain'
                ? `Keep ${currentWeight} lbs`
                : `${direction === 'increase' ? 'Increase' : 'Decrease'} to ${suggestedWeight} lbs`}
            </Text>
            {direction !== 'maintain' && (
              <Text className="mt-1 text-sm" style={{ color: iconColor }}>
                {deltaText} lbs
              </Text>
            )}
            <Text className="mt-1 text-xs text-text-disabled">{reason}</Text>
          </View>
          {confidence !== 'low' && (
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: alpha(iconColor, 0.12) }}
            >
              <Text className="text-xs font-medium" style={{ color: iconColor }}>
                {confidence}
              </Text>
            </View>
          )}
        </HStack>
      </CardContent>
    </Card>
  );
}
