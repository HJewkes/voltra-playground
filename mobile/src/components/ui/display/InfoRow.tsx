/**
 * InfoRow
 *
 * A simple label + value row for displaying information.
 */

import React, { type ReactNode } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface InfoRowProps {
  /** Label text */
  label: string;
  /** Value to display (string or ReactNode) */
  value: string | ReactNode;
  /** Show bottom border */
  showBorder?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * InfoRow component - label + value display row.
 *
 * @example
 * ```tsx
 * <InfoRow label="Version" value="1.0.0" />
 * <InfoRow label="Status" value={<StatusIndicator status="success" />} />
 * ```
 */
export function InfoRow({ label, value, showBorder = false, style }: InfoRowProps) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={[
        showBorder && {
          borderBottomWidth: 1,
          borderBottomColor: colors.surface.light,
          paddingBottom: 12,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <Text className="text-sm text-content-tertiary">{label}</Text>
      {typeof value === 'string' ? (
        <Text className="text-sm font-medium text-content-secondary">{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}
