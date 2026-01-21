/**
 * StatusIndicator
 *
 * A colored status dot with optional label.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusIndicatorProps {
  /** Status type determines color */
  status: StatusType;
  /** Optional label text */
  label?: string;
  /** Size of the dot */
  size?: 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const statusColors: Record<StatusType, string> = {
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  error: colors.danger.DEFAULT,
  info: colors.info.DEFAULT,
  neutral: colors.surface.light,
};

const sizeMap = {
  sm: 6,
  md: 8,
  lg: 12,
};

/**
 * StatusIndicator component - colored dot with label.
 *
 * @example
 * ```tsx
 * <StatusIndicator status="success" label="Connected" />
 * <StatusIndicator status="error" size="lg" />
 * ```
 */
export function StatusIndicator({ status, label, size = 'md', style }: StatusIndicatorProps) {
  const dotSize = sizeMap[size];
  const color = statusColors[status];

  return (
    <View className="flex-row items-center" style={style}>
      <View
        className="rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color,
        }}
      />
      {label && (
        <Text className="ml-2 text-sm" style={{ color: colors.text.secondary }}>
          {label}
        </Text>
      )}
    </View>
  );
}
