/**
 * LoadingState
 *
 * A loading indicator with optional message.
 */

import React from 'react';
import { View, Text, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

export interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Spinner size */
  size?: 'small' | 'large';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * LoadingState component - spinner with message.
 *
 * @example
 * ```tsx
 * <LoadingState message="Scanning for devices..." />
 * <LoadingState size="large" />
 * ```
 */
export function LoadingState({ message, size = 'small', style }: LoadingStateProps) {
  return (
    <View className="items-center py-8" style={style}>
      <ActivityIndicator size={size} color={colors.primary[500]} />
      {message && <Text className="mt-3 text-center text-content-secondary">{message}</Text>}
    </View>
  );
}
