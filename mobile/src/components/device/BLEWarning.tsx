/**
 * BLEWarning
 * 
 * Warning banner for BLE environment issues (simulator, Expo Go).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface BLEWarningProps {
  /** Environment type */
  environment: string;
  /** Warning message */
  message: string;
}

/**
 * BLEWarning - displays BLE environment warnings.
 */
export function BLEWarning({ 
  environment, 
  message,
}: BLEWarningProps) {
  const title = environment === 'simulator' 
    ? 'Simulator Detected' 
    : 'Expo Go Detected';
  
  return (
    <View 
      className="p-4 rounded-xl mb-4 flex-row items-start"
      style={{ backgroundColor: colors.warning.DEFAULT + '15' }}
    >
      <Ionicons 
        name="warning" 
        size={20} 
        color={colors.warning.DEFAULT} 
        style={{ marginTop: 2 }} 
      />
      <View className="ml-3 flex-1">
        <Text 
          className="font-semibold mb-1" 
          style={{ color: colors.warning.DEFAULT }}
        >
          {title}
        </Text>
        <Text 
          className="text-xs leading-5" 
          style={{ color: colors.text.secondary }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}
