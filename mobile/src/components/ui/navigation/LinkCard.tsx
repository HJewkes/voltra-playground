/**
 * LinkCard
 *
 * Pressable card that navigates to a route.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../layout/Card';
import { colors, spacing, borderRadius } from '@/theme';

export interface LinkCardProps {
  /** Navigation target (expo-router href) */
  href: Href;
  /** Icon name (Ionicons) */
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon color */
  iconColor: string;
  /** Icon background color */
  iconBgColor: string;
  /** Card title */
  title: string;
  /** Card subtitle/description */
  subtitle?: string;
  /** Whether to use full width (default) or flex */
  fullWidth?: boolean;
}

/**
 * LinkCard - navigable action card with icon.
 *
 * @example
 * ```tsx
 * <LinkCard
 *   href="/workout"
 *   icon="barbell"
 *   iconColor={colors.primary[500]}
 *   iconBgColor={colors.primary[100]}
 *   title="Workout"
 *   subtitle="Start training"
 * />
 * ```
 */
export function LinkCard({
  href,
  icon,
  iconColor,
  iconBgColor,
  title,
  subtitle,
  fullWidth = false,
}: LinkCardProps) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={fullWidth ? undefined : styles.flex}>
        <Card elevation={1} padding="lg" marginBottom={false}>
          <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon} size={28} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </Card>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.content.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  subtitle: {
    color: colors.content.tertiary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
