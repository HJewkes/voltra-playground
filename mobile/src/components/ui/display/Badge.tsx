/**
 * Badge
 *
 * Colored pill label for status, tags, or counts.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface BadgeProps {
  /** Badge text content */
  label: string;
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS = {
  default: {
    bg: colors.surface.light,
    text: colors.text.secondary,
  },
  primary: {
    bg: colors.primary[500] + '20',
    text: colors.primary[500],
  },
  success: {
    bg: colors.success.DEFAULT + '20',
    text: colors.success.DEFAULT,
  },
  warning: {
    bg: colors.warning.DEFAULT + '20',
    text: colors.warning.DEFAULT,
  },
  danger: {
    bg: colors.danger.DEFAULT + '20',
    text: colors.danger.DEFAULT,
  },
  info: {
    bg: colors.info.DEFAULT + '20',
    text: colors.info.DEFAULT,
  },
} as const;

const SIZES = {
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    borderRadius: 4,
  },
  md: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    borderRadius: 6,
  },
  lg: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    borderRadius: 8,
  },
} as const;

/**
 * Badge component - colored pill label.
 *
 * @example
 * ```tsx
 * <Badge label="New" variant="primary" />
 * <Badge label="3 RIR" variant="success" size="sm" />
 * <Badge label="Failed" variant="danger" />
 * ```
 */
export function Badge({ label, variant = 'default', size = 'md', style }: BadgeProps) {
  const variantStyle = VARIANT_COLORS[variant];
  const sizeStyle = SIZES[size];

  return (
    <View
      style={[
        {
          backgroundColor: variantStyle.bg,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          borderRadius: sizeStyle.borderRadius,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: variantStyle.text,
          fontSize: sizeStyle.fontSize,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
