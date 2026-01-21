/**
 * Banner
 *
 * Colored banner with icon for status messages, alerts, etc.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing } from '@/theme';

export type BannerVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface BannerProps {
  /** Color variant */
  variant: BannerVariant;
  /** Icon name (Ionicons) */
  icon: keyof typeof Ionicons.glyphMap;
  /** Main title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Additional children to render */
  children?: React.ReactNode;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<BannerVariant, string> = {
  primary: colors.primary[600],
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  danger: colors.error.DEFAULT,
  info: colors.primary[400],
};

/**
 * Banner - colored banner with icon for status display.
 *
 * @example
 * ```tsx
 * <Banner
 *   variant="success"
 *   icon="checkmark-circle"
 *   title="Connected"
 *   subtitle="Device ready"
 * />
 * ```
 */
export function Banner({ variant, icon, title, subtitle, children, style }: BannerProps) {
  const backgroundColor = variantColors[variant];

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={24} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
});
