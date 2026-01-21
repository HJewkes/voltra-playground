/**
 * Divider
 *
 * Visual separator for content sections.
 * Supports horizontal (default) and vertical orientations.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

export interface DividerProps {
  /** Orientation of the divider */
  direction?: 'horizontal' | 'vertical';
  /** Color variant */
  variant?: 'default' | 'subtle' | 'strong';
  /** Size (thickness) */
  size?: 'sm' | 'md' | 'lg';
  /** Spacing around the divider */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const COLORS = {
  default: colors.surface.light,
  subtle: colors.surface.dark,
  strong: colors.surface.lightest,
} as const;

const SIZES = {
  sm: 1,
  md: 2,
  lg: 4,
} as const;

const SPACING_MAP = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
} as const;

/**
 * Divider component - visual separator between content.
 *
 * @example
 * ```tsx
 * // Horizontal divider with margin
 * <Divider spacing="md" />
 *
 * // Vertical divider between items
 * <View style={{ flexDirection: 'row' }}>
 *   <Text>Left</Text>
 *   <Divider direction="vertical" spacing="sm" />
 *   <Text>Right</Text>
 * </View>
 * ```
 */
export function Divider({
  direction = 'horizontal',
  variant = 'default',
  size = 'sm',
  spacing: spacingProp = 'none',
  style,
}: DividerProps) {
  const color = COLORS[variant];
  const thickness = SIZES[size];
  const space = SPACING_MAP[spacingProp];

  const isHorizontal = direction === 'horizontal';

  const dividerStyle: ViewStyle = isHorizontal
    ? {
        height: thickness,
        width: '100%',
        backgroundColor: color,
        marginVertical: space,
      }
    : {
        width: thickness,
        height: '100%',
        backgroundColor: color,
        marginHorizontal: space,
      };

  return <View style={[dividerStyle, style]} />;
}
