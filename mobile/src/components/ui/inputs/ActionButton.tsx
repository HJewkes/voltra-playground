/**
 * ActionButton
 *
 * A primary action button with optional icon.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export type ActionButtonVariant = 'primary' | 'danger' | 'secondary' | 'success';

export interface ActionButtonProps {
  /** Button label */
  label: string;
  /** Called when pressed */
  onPress: () => void;
  /** Button variant */
  variant?: ActionButtonVariant;
  /** Optional Ionicon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether button is loading */
  loading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<ActionButtonVariant, string> = {
  primary: colors.primary[600],
  danger: colors.danger.DEFAULT,
  secondary: colors.surface.card,
  success: colors.success.DEFAULT,
};

const sizeStyles = {
  sm: { paddingVertical: 12, fontSize: 14, iconSize: 18 },
  md: { paddingVertical: 16, fontSize: 16, iconSize: 20 },
  lg: { paddingVertical: 20, fontSize: 18, iconSize: 24 },
};

/**
 * ActionButton component - primary/danger action button.
 *
 * @example
 * ```tsx
 * <ActionButton
 *   label="Start Workout"
 *   icon="play"
 *   variant="primary"
 *   onPress={handleStart}
 * />
 * ```
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  size = 'md',
  style,
}: ActionButtonProps) {
  const bgColor = variantColors[variant];
  const textColor = variant === 'secondary' ? colors.text.secondary : 'white';
  const { paddingVertical, fontSize, iconSize } = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className="rounded-2xl"
      style={[
        {
          backgroundColor: bgColor,
          paddingVertical,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center justify-center">
        {loading ? (
          <ActivityIndicator size="small" color={textColor} style={{ marginRight: 8 }} />
        ) : icon ? (
          <Ionicons name={icon} size={iconSize} color={textColor} style={{ marginRight: 8 }} />
        ) : null}
        <Text className="text-center font-bold" style={{ color: textColor, fontSize }}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
