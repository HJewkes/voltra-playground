/**
 * Stack
 * 
 * Flex container with consistent spacing.
 * Simplifies common flexbox patterns with gap support.
 */

import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle, FlexAlignType } from 'react-native';
import { spacing } from '@/theme';

export interface StackProps {
  /** Flex direction */
  direction?: 'row' | 'column';
  /** Gap between children */
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  /** Align items (cross-axis) */
  align?: FlexAlignType;
  /** Justify content (main-axis) */
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  /** Whether children should flex equally */
  flex?: boolean;
  /** Children to render */
  children: ReactNode;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Additional Tailwind classes */
  className?: string;
}

const gapMap = {
  xs: spacing.xs,   // 4
  sm: spacing.sm,   // 8
  md: spacing.md,   // 16
  lg: spacing.lg,   // 24
} as const;

/**
 * Stack component - flexbox container with consistent spacing.
 * 
 * @example
 * ```tsx
 * <Stack direction="row" gap="md">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </Stack>
 * 
 * <Stack gap="sm" align="center">
 *   <Text>Vertically stacked</Text>
 *   <Text>with small gap</Text>
 * </Stack>
 * ```
 */
export function Stack({
  direction = 'column',
  gap = 'md',
  align,
  justify,
  flex,
  children,
  style,
  className,
}: StackProps) {
  const stackStyle: ViewStyle = {
    flexDirection: direction,
    gap: gapMap[gap],
    ...(align && { alignItems: align }),
    ...(justify && { justifyContent: justify }),
    ...(flex && { flex: 1 }),
  };
  
  return (
    <View style={[stackStyle, style]} className={className}>
      {children}
    </View>
  );
}

/**
 * Horizontal Stack - convenience wrapper for Stack with direction="row"
 */
export function HStack(props: Omit<StackProps, 'direction'>) {
  return <Stack {...props} direction="row" />;
}

/**
 * Vertical Stack - convenience wrapper for Stack with direction="column"
 */
export function VStack(props: Omit<StackProps, 'direction'>) {
  return <Stack {...props} direction="column" />;
}
