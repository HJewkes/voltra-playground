/**
 * ProgressBar
 * 
 * A styled progress/effort bar with customizable color.
 * Used for RPE visualization, loading states, etc.
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  progress: number;
  /** Bar color (default: primary) */
  color?: string;
  /** Bar height (default: 16) */
  height?: number;
  /** Background color (default: surface.card) */
  backgroundColor?: string;
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
}

/**
 * ProgressBar component - visualizes progress/effort.
 * 
 * @example
 * ```tsx
 * <ProgressBar progress={75} color={colors.success.DEFAULT} />
 * <ProgressBar progress={rpe * 10} color={getRPEColor(rpe)} />
 * ```
 */
export function ProgressBar({
  progress,
  color = colors.primary[500],
  height = 16,
  backgroundColor = colors.surface.card,
  style,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <View 
      className="rounded-full overflow-hidden"
      style={[{ height, backgroundColor }, style]}
    >
      <View
        className="h-full rounded-full"
        style={{
          width: `${clampedProgress}%`,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
