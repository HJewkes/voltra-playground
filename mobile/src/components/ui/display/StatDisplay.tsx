/**
 * StatDisplay
 * 
 * Displays a value with a label underneath.
 * Used throughout the app for metrics, stats, and counters.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface StatDisplayProps {
  /** The main value to display */
  value: string | number;
  /** Label describing the value */
  label: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional color for the value */
  color?: string;
  /** Optional unit to display after value */
  unit?: string;
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
  /** Additional Tailwind classes */
  className?: string;
}

const sizeStyles = {
  sm: {
    valueClass: 'text-2xl font-bold',
    labelClass: 'text-xs text-content-tertiary mt-0.5',
  },
  md: {
    valueClass: 'text-4xl font-bold',
    labelClass: 'text-sm text-content-tertiary mt-1',
  },
  lg: {
    valueClass: 'text-5xl font-bold',
    labelClass: 'text-base text-content-tertiary mt-1',
  },
} as const;

/**
 * StatDisplay component - value + label pattern.
 * 
 * @example
 * ```tsx
 * <StatDisplay 
 *   value={42} 
 *   label="Workouts" 
 *   color={colors.primary[500]} 
 * />
 * 
 * <StatDisplay 
 *   value="8.5" 
 *   label="RPE" 
 *   size="lg"
 *   color={colors.warning.DEFAULT}
 * />
 * ```
 */
export function StatDisplay({
  value,
  label,
  size = 'md',
  color,
  unit,
  style,
  className,
}: StatDisplayProps) {
  const styles = sizeStyles[size];
  
  return (
    <View style={style} className={`items-center ${className ?? ''}`}>
      <Text 
        className={styles.valueClass}
        style={color ? { color } : { color: colors.text.primary }}
      >
        {value}{unit && <Text className="text-content-tertiary">{unit}</Text>}
      </Text>
      <Text className={styles.labelClass}>
        {label}
      </Text>
    </View>
  );
}
