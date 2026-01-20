/**
 * Section
 * 
 * Groups content with an optional title and divider.
 * Useful for organizing settings, forms, and list groups.
 */

import React, { ReactNode } from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';
import { Divider } from './Divider';

export interface SectionProps {
  /** Section title */
  title?: string;
  /** Section subtitle/description */
  subtitle?: string;
  /** Whether to show a divider before the section */
  divider?: boolean;
  /** Spacing variant */
  spacing?: 'sm' | 'md' | 'lg';
  /** Children content */
  children: ReactNode;
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
}

const SPACING_MAP = {
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
} as const;

/**
 * Section component - groups content with title and optional divider.
 * 
 * @example
 * ```tsx
 * <Section title="Account" subtitle="Manage your account settings">
 *   <InfoRow label="Email" value="user@example.com" />
 *   <InfoRow label="Name" value="John Doe" />
 * </Section>
 * 
 * <Section title="Danger Zone" divider>
 *   <ActionButton variant="danger" title="Delete Account" />
 * </Section>
 * ```
 */
export function Section({
  title,
  subtitle,
  divider = false,
  spacing: spacingProp = 'md',
  children,
  style,
}: SectionProps) {
  const space = SPACING_MAP[spacingProp];
  
  return (
    <View style={[{ marginBottom: space }, style]}>
      {divider && <Divider spacing="md" variant="subtle" />}
      
      {(title || subtitle) && (
        <View style={{ marginBottom: space }}>
          {title && (
            <Text
              style={{
                color: colors.text.primary,
                fontSize: 18,
                fontWeight: '700',
              }}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={{
                color: colors.text.tertiary,
                fontSize: 14,
                marginTop: 4,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      )}
      
      {children}
    </View>
  );
}
