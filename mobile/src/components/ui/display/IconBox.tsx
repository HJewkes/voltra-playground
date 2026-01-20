/**
 * IconBox
 * 
 * Icon displayed in a colored container.
 * Commonly used for list items, buttons, and feature cards.
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface IconBoxProps {
  /** Ionicons icon name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon color */
  iconColor?: string;
  /** Background color */
  bgColor?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: {
    container: 28,
    icon: 14,
    borderRadius: 6,
  },
  md: {
    container: 36,
    icon: 18,
    borderRadius: 8,
  },
  lg: {
    container: 44,
    icon: 22,
    borderRadius: 10,
  },
  xl: {
    container: 56,
    icon: 28,
    borderRadius: 14,
  },
} as const;

/**
 * IconBox component - icon in colored container.
 * 
 * @example
 * ```tsx
 * <IconBox icon="fitness" iconColor={colors.primary[500]} />
 * <IconBox 
 *   icon="checkmark" 
 *   iconColor={colors.success.DEFAULT} 
 *   bgColor={colors.success.DEFAULT + '20'}
 *   size="lg"
 * />
 * ```
 */
export function IconBox({
  icon,
  iconColor = colors.primary[500],
  bgColor = colors.surface.light,
  size = 'md',
  style,
}: IconBoxProps) {
  const sizeConfig = SIZES[size];
  
  return (
    <View
      style={[
        {
          width: sizeConfig.container,
          height: sizeConfig.container,
          borderRadius: sizeConfig.borderRadius,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={sizeConfig.icon} color={iconColor} />
    </View>
  );
}
