/**
 * JunkVolumeAlert
 *
 * Alert when set quality has degraded beyond productive threshold.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { JunkVolumeAlert as JunkVolumeAlertType } from '@/domain/planning/auto-regulation';

const t = getSemanticColors('dark');

export interface JunkVolumeAlertProps {
  alert: JunkVolumeAlertType;
  style?: StyleProp<ViewStyle>;
}

export function JunkVolumeAlert({ alert, style }: JunkVolumeAlertProps) {
  const color = alert.isJunkVolume ? t['status-error'] : t['status-warning'];
  const icon = alert.isJunkVolume ? 'stop-circle' : 'trending-down';

  return (
    <View className="rounded-xl px-4 py-3" style={[{ backgroundColor: alpha(color, 0.08) }, style]}>
      <HStack align="center" gap={10}>
        <Ionicons name={icon} size={22} color={color} />
        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color }}>
            {alert.isJunkVolume ? 'Junk Volume Detected' : 'Performance Declining'}
          </Text>
          <Text className="mt-1 text-xs text-text-disabled">{alert.message}</Text>
          <Text className="mt-1 text-xs text-text-disabled">
            Rep drop: {alert.repDropPercent.toFixed(0)}% | Velocity recovery:{' '}
            {alert.velocityRecoveryPercent.toFixed(0)}%
          </Text>
        </View>
      </HStack>
    </View>
  );
}
