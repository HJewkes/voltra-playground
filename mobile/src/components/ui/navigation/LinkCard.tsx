/**
 * LinkCard
 *
 * Pressable card that navigates to a route.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Link, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@titan-design/react-ui';
import { colors } from '@/theme';

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
      <TouchableOpacity style={fullWidth ? undefined : { flex: 1 }}>
        <Card elevation={1}>
          <CardContent className="p-4">
            <View
              className="mb-4 items-center justify-center rounded-xl"
              style={{ width: 56, height: 56, backgroundColor: iconBgColor }}
            >
              <Ionicons name={icon} size={28} color={iconColor} />
            </View>
            <Text className="text-base font-semibold text-content-primary">{title}</Text>
            {subtitle && (
              <Text className="mt-1 text-sm text-content-tertiary">{subtitle}</Text>
            )}
          </CardContent>
        </Card>
      </TouchableOpacity>
    </Link>
  );
}
