/**
 * ErrorBanner
 *
 * A dismissible error message banner.
 */

import React from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface ErrorBannerProps {
  /** Error message to display */
  message: string;
  /** Called when dismiss button is pressed */
  onDismiss?: () => void;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * ErrorBanner component - dismissible error display.
 *
 * @example
 * ```tsx
 * {error && (
 *   <ErrorBanner
 *     message={error}
 *     onDismiss={() => setError(null)}
 *   />
 * )}
 * ```
 */
export function ErrorBanner({ message, onDismiss, style }: ErrorBannerProps) {
  return (
    <View
      className="flex-row items-start rounded-2xl p-4"
      style={[{ backgroundColor: colors.danger.DEFAULT + '15' }, style]}
    >
      <Ionicons name="alert-circle" size={20} color={colors.danger.DEFAULT} />
      <Text className="ml-3 flex-1 text-sm" style={{ color: colors.danger.light }}>
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={colors.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
