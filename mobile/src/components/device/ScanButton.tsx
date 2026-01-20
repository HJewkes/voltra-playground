/**
 * ScanButton
 * 
 * Button for triggering BLE device scanning.
 * Shows scanning state with activity indicator.
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface ScanButtonProps {
  /** Whether currently scanning */
  isScanning: boolean;
  /** Whether the button is disabled */
  disabled: boolean;
  /** Called when button is pressed */
  onPress: () => void;
}

/**
 * ScanButton component - trigger BLE scanning.
 * 
 * @example
 * ```tsx
 * <ScanButton
 *   isScanning={isScanning}
 *   disabled={!bleSupported}
 *   onPress={scan}
 * />
 * ```
 */
export function ScanButton({ 
  isScanning, 
  disabled,
  onPress,
}: ScanButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center px-3 py-2 rounded-xl"
      style={{ 
        backgroundColor: isScanning ? colors.primary[500] + '20' : colors.surface.dark,
      }}
      activeOpacity={0.7}
    >
      {isScanning ? (
        <>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text className="text-primary-500 text-sm font-medium ml-2">
            Scanning
          </Text>
        </>
      ) : (
        <>
          <Ionicons 
            name="refresh" 
            size={16} 
            color={disabled ? colors.text.muted : colors.text.secondary} 
          />
          <Text 
            className="text-sm font-medium ml-2"
            style={{ color: disabled ? colors.text.muted : colors.text.secondary }}
          >
            Scan
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
