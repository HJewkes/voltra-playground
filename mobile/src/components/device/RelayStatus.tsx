/**
 * RelayStatus
 *
 * Shows BLE relay status (web only).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Surface, StatusIndicator } from '@/components/ui';
import { colors } from '@/theme';
import type { RelayStatus as RelayStatusType } from '@/stores';

export interface RelayStatusProps {
  /** Current relay status */
  status: RelayStatusType;
}

const statusMap: Record<RelayStatusType, { type: 'success' | 'warning' | 'error'; label: string }> =
  {
    connected: { type: 'success', label: 'Running' },
    checking: { type: 'warning', label: 'Checking...' },
    disconnected: { type: 'error', label: 'Not running' },
    error: { type: 'error', label: 'Error' },
  };

/**
 * RelayStatus - displays relay connection status.
 */
export function RelayStatus({ status }: RelayStatusProps) {
  const { type, label } = statusMap[status];

  return (
    <Surface elevation="inset" radius="lg" border={false} style={{ marginBottom: 16 }}>
      <View className="flex-row items-center p-4">
        <StatusIndicator status={type} size="sm" />
        <Text className="ml-3 flex-1 text-sm text-content-tertiary">BLE Relay: {label}</Text>
        {status === 'disconnected' && (
          <Text className="font-mono text-xs" style={{ color: colors.text.muted }}>
            make relay
          </Text>
        )}
      </View>
    </Surface>
  );
}
