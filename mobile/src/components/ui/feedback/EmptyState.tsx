/**
 * EmptyState
 *
 * A placeholder display for empty lists or states.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface EmptyStateProps {
  /** Ionicon name for the icon */
  icon: keyof typeof Ionicons.glyphMap;
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
export function EmptyState({ icon, title, subtitle, iconSize = 48, style }: EmptyStateProps) {
  return (
    <View className="items-center py-8" style={style}>
      <View
        className="mb-4 h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.surface.dark }}
      >
        <Ionicons name={icon} size={iconSize} color={colors.text.muted} />
      </View>
      <Text className="mb-2 text-center text-xl font-bold text-content-primary">{title}</Text>
      {subtitle && <Text className="px-4 text-center text-content-secondary">{subtitle}</Text>}
    </View>
  );
}
