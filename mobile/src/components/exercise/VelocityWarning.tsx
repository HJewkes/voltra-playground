/**
 * VelocityWarning
 *
 * Alert banner when velocity drops beyond target loss thresholds.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { VelocityWarning as VelocityWarningType } from '@/domain/planning/auto-regulation';

const t = getSemanticColors('dark');

export interface VelocityWarningProps {
  warning: VelocityWarningType;
  style?: StyleProp<ViewStyle>;
}

const SEVERITY_CONFIG = {
  info: { icon: 'information-circle' as const, colorKey: 'brand-primary' as const },
  warning: { icon: 'warning' as const, colorKey: 'status-warning' as const },
  critical: { icon: 'alert-circle' as const, colorKey: 'status-error' as const },
};

export function VelocityWarning({ warning, style }: VelocityWarningProps) {
  const config = SEVERITY_CONFIG[warning.severity];
  const color = t[config.colorKey];

  return (
    <View className="rounded-xl px-4 py-3" style={[{ backgroundColor: alpha(color, 0.08) }, style]}>
      <HStack align="center" gap={10}>
        <Ionicons name={config.icon} size={22} color={color} />
        <View className="flex-1">
          <Text className="text-sm font-medium" style={{ color }}>
            {warning.message}
          </Text>
          <Text className="mt-1 text-xs text-text-disabled">
            Velocity loss: {warning.velocityLossPercent}% (target max: {warning.threshold}%)
          </Text>
        </View>
      </HStack>
    </View>
  );
}
