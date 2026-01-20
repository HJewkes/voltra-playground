/**
 * Surface
 * 
 * The foundational primitive for elevation-aware containers.
 * Applies background color, shadow, border radius, and optional border
 * based on the elevation level.
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { getElevationStyles, type Elevation } from '@/theme';
import { colors, borderRadius } from '@/theme';

export interface SurfaceProps {
  /** Elevation level determines background and shadow */
  elevation?: Elevation;
  /** Border radius size */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  /** Whether to show border (default: true) */
  border?: boolean;
  /** Children to render */
  children: ReactNode;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Additional Tailwind classes */
  className?: string;
}

/**
 * Surface component - the base building block for elevated containers.
 * 
 * @example
 * ```tsx
 * <Surface elevation={1}>
 *   <Text>Card content</Text>
 * </Surface>
 * 
 * <Surface elevation="inset" radius="md">
 *   <Text>Recessed content</Text>
 * </Surface>
 * ```
 */
export function Surface({
  elevation = 1,
  radius = 'xl',
  border = true,
  children,
  style,
  className,
}: SurfaceProps) {
  const elevationStyles = getElevationStyles(elevation);
  const radiusValue = borderRadius[radius];
  
  const combinedStyle: ViewStyle = {
    ...elevationStyles,
    borderRadius: radiusValue,
    ...(border && {
      borderWidth: 1,
      borderColor: colors.surface.light,
    }),
  };
  
  return (
    <View 
      style={[combinedStyle, style]} 
      className={className}
    >
      {children}
    </View>
  );
}
