/**
 * EmptyState
 * 
 * A placeholder display for empty lists or states.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface EmptyStateProps {
  /** Ionicon name for the icon */
  icon: string;
  /** Main title text */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon size */
  iconSize?: number;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState component - placeholder for empty content.
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon="bluetooth-outline"
 *   title="No Devices Found"
 *   subtitle="Make sure your Voltra is powered on"
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  iconSize = 48,
  style,
}: EmptyStateProps) {
  return (
    <View className="py-8 items-center" style={style}>
      <View 
        className="w-24 h-24 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: colors.surface.dark }}
      >
        <Ionicons name={icon as any} size={iconSize} color={colors.text.muted} />
      </View>
      <Text className="text-xl font-bold text-content-primary mb-2 text-center">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-content-secondary text-center px-4">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
