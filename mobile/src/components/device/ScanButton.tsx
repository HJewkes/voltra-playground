/**
 * ScanButton
 *
 * Button for triggering BLE device scanning.
 * Shows scanning state with activity indicator.
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface ScanButtonProps {
  /** Whether currently scanning */
  isScanning: boolean;
  /** Whether the button is disabled */
  disabled: boolean;
  /** Called when button is pressed */
  onPress: () => void;
  /** Custom label (defaults to "Scan") */
  label?: string;
  /** Custom scanning label (defaults to "Scanning") */
  scanningLabel?: string;
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
  label = 'Scan',
  scanningLabel = 'Scanning',
}: ScanButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center rounded-xl px-3 py-2"
      style={{
        backgroundColor: isScanning ? alpha(t['brand-primary'], 0.12) : t['background-subtle'],
      }}
      activeOpacity={0.7}
    >
      {isScanning ? (
        <>
          <ActivityIndicator size="small" color={t['brand-primary']} />
          <Text className="ml-2 text-sm font-medium text-primary-500">{scanningLabel}</Text>
        </>
      ) : (
        <>
          <Ionicons
            name={label === 'Connect' ? 'bluetooth' : 'refresh'}
            size={16}
            color={disabled ? t['text-disabled'] : t['text-secondary']}
          />
          <Text
            className="ml-2 text-sm font-medium"
            style={{ color: disabled ? t['text-disabled'] : t['text-secondary'] }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
