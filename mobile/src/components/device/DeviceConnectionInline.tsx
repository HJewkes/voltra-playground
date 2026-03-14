/**
 * DeviceConnectionInline
 *
 * Compact inline variant for DeviceConnection.
 * Shows a single row with connection status, device name, and scan/disconnect action.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface InlineVariantProps {
  isConnected: boolean;
  connectedDevices: { id: string; name: string }[];
  isScanning: boolean;
  connectingDeviceId: string | null;
  bleSupported: boolean;
  doScan: () => void;
  handleDisconnect: () => void;
  error: string | null;
  setError: (e: string | null) => void;
}

export function InlineVariant({
  isConnected,
  connectedDevices,
  isScanning,
  connectingDeviceId,
  bleSupported,
  doScan,
  handleDisconnect,
  error,
  setError,
}: InlineVariantProps) {
  if (isConnected && connectedDevices.length > 0) {
    const device = connectedDevices[0];
    return (
      <View
        className="flex-row items-center rounded-2xl p-4"
        style={{
          backgroundColor: alpha(t['status-success'], 0.08),
          borderWidth: 1,
          borderColor: alpha(t['status-success'], 0.3),
        }}
      >
        <Ionicons name="bluetooth" size={20} color={t['status-success']} />
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-text-primary">{device.name}</Text>
          <Text className="text-xs" style={{ color: t['status-success'] }}>Connected</Text>
        </View>
        <TouchableOpacity
          onPress={handleDisconnect}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: t['background-subtle'] }}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-medium text-text-secondary">Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="rounded-2xl p-4" style={{ backgroundColor: alpha(t['brand-primary'], 0.08) }}>
      <View className="flex-row items-center">
        <Ionicons name="bluetooth-outline" size={20} color={t['text-tertiary']} />
        <Text className="ml-3 flex-1 text-sm text-text-secondary">No device connected</Text>
        {bleSupported && (
          <TouchableOpacity
            onPress={doScan}
            disabled={isScanning || connectingDeviceId !== null}
            className="flex-row items-center rounded-lg px-3 py-1.5"
            style={{ backgroundColor: t['background-subtle'] }}
            activeOpacity={0.7}
          >
            {isScanning || connectingDeviceId ? (
              <>
                <ActivityIndicator size="small" color={t['brand-primary']} />
                <Text className="ml-2 text-xs font-medium text-primary-500">
                  {connectingDeviceId ? 'Connecting' : 'Scanning'}
                </Text>
              </>
            ) : (
              <Text className="text-xs font-medium text-text-secondary">Scan</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View className="mt-2 flex-row items-center">
          <Text className="flex-1 text-xs" style={{ color: t['status-error'] }}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={14} color={t['text-disabled']} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
