/**
 * StatsRow
 * 
 * Row of stats with automatic dividers between them.
 * Perfect for displaying multiple metrics in a horizontal layout.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface StatItem {
  /** The stat value (number or formatted string) */
  value: string | number;
  /** Label for the stat */
  label: string;
  /** Optional color for the value */
  valueColor?: string;
}

export interface StatsRowProps {
  /** Array of stat items to display */
  stats: StatItem[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show dividers between stats */
  dividers?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: {
    valueSize: 20,
    labelSize: 11,
    dividerHeight: 24,
  },
  md: {
    valueSize: 28,
    labelSize: 12,
    dividerHeight: 32,
  },
  lg: {
    valueSize: 36,
    labelSize: 14,
    dividerHeight: 40,
  },
} as const;

/**
 * StatsRow component - horizontal row of stats with dividers.
 * 
 * @example
 * ```tsx
 * <StatsRow
 *   stats={[
 *     { value: 12, label: 'Workouts' },
 *     { value: '2,450', label: 'Total Reps' },
 *     { value: '125k', label: 'Volume (lbs)' },
 *   ]}
 * />
 * 
 * <StatsRow
 *   stats={[
 *     { value: 7.5, label: 'RPE', valueColor: colors.warning.DEFAULT },
 *     { value: 3, label: 'RIR', valueColor: colors.success.DEFAULT },
 *   ]}
 *   size="lg"
 * />
 * ```
 */
export function StatsRow({
  stats,
  size = 'md',
  dividers = true,
  style,
}: StatsRowProps) {
  const sizeConfig = SIZES[size];
  
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
        },
        style,
      ]}
    >
      {stats.map((stat, index) => (
        <React.Fragment key={index}>
          {/* Divider */}
          {dividers && index > 0 && (
            <View
              style={{
                width: 1,
                height: sizeConfig.dividerHeight,
                backgroundColor: colors.surface.light,
              }}
            />
          )}
          
          {/* Stat */}
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text
              style={{
                fontSize: sizeConfig.valueSize,
                fontWeight: '700',
                color: stat.valueColor ?? colors.text.primary,
              }}
            >
              {stat.value}
            </Text>
            <Text
              style={{
                fontSize: sizeConfig.labelSize,
                color: colors.text.tertiary,
                marginTop: 2,
              }}
            >
              {stat.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
