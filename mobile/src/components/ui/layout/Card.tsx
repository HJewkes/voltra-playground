/**
 * Card
 *
 * Surface with padding and optional header.
 * The most commonly used container component.
 */

import React from 'react';
import { Text, type ViewStyle } from 'react-native';
import { Surface, type SurfaceProps } from './Surface';
import { spacing } from '@/theme';

export interface CardProps extends SurfaceProps {
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Optional section header text */
  header?: string;
  /** Bottom margin (default: true for mb-4 equivalent) */
  marginBottom?: boolean;
}

const paddingMap = {
  none: 0,
  sm: spacing.sm, // 8
  md: spacing.md, // 16
  lg: spacing.lg, // 24
} as const;

/**
 * Card component - Surface with padding and optional header.
 *
 * @example
 * ```tsx
 * <Card header="Weekly Stats">
 *   <StatDisplay value={5} label="Workouts" />
 * </Card>
 *
 * <Card elevation="inset" padding="lg">
 *   <Text>Nested content</Text>
 * </Card>
 * ```
 */
export function Card({
  padding = 'md',
  header,
  marginBottom = true,
  children,
  style,
  ...surfaceProps
}: CardProps) {
  const paddingValue = paddingMap[padding];

  const cardStyle: ViewStyle = {
    padding: paddingValue,
    ...(marginBottom && { marginBottom: spacing.md }),
  };

  return (
    <Surface style={[cardStyle, style]} {...surfaceProps}>
      {header && (
        <Text
          className="text-lg font-bold text-content-primary"
          style={{ marginBottom: spacing.md }}
        >
          {header}
        </Text>
      )}
      {children}
    </Surface>
  );
}
