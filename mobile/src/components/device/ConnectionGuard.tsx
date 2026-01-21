/**
 * ConnectionGuard
 *
 * Wrapper component that shows a connection prompt when not connected.
 * Use this to wrap screens that require an active Voltra connection.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectionStore } from '@/stores';

interface ConnectionGuardProps {
  children: React.ReactNode;
  /** Custom message when not connected */
  message?: string;
  /** Whether to show scanning UI */
  showScanButton?: boolean;
}

export function ConnectionGuard({
  children,
  message = 'Connect to your Voltra to get started',
  showScanButton = true,
}: ConnectionGuardProps) {
  const {
    primaryDeviceId,
    devices,
    isScanning,
    isRestoring,
    discoveredDevices,
    scan,
    connectDevice,
  } = useConnectionStore();

  const isConnected = primaryDeviceId && devices.has(primaryDeviceId);

  // Show loading while restoring connection
  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900 p-6">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-zinc-400">Restoring connection...</Text>
      </View>
    );
  }

  // Connected - render children
  if (isConnected) {
    return <>{children}</>;
  }

  // Not connected - show connection UI
  return (
    <View className="flex-1 items-center justify-center bg-zinc-900 p-6">
      <Ionicons name="bluetooth-outline" size={64} color="#3b82f6" />
      <Text className="mt-4 text-center text-xl font-semibold text-white">{message}</Text>

      {showScanButton && (
        <>
          <TouchableOpacity
            className={`mt-6 rounded-xl px-8 py-3 ${isScanning ? 'bg-zinc-700' : 'bg-blue-600'}`}
            onPress={() => scan()}
            disabled={isScanning}
          >
            {isScanning ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-2 font-semibold text-white">Scanning...</Text>
              </View>
            ) : (
              <Text className="font-semibold text-white">Scan for Devices</Text>
            )}
          </TouchableOpacity>

          {/* Show discovered devices */}
          {discoveredDevices.length > 0 && (
            <View className="mt-6 w-full">
              <Text className="mb-2 text-sm text-zinc-400">Found devices:</Text>
              {discoveredDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  className="mb-2 flex-row items-center justify-between rounded-lg bg-zinc-800 p-4"
                  onPress={() => connectDevice(device)}
                >
                  <View>
                    <Text className="font-medium text-white">
                      {device.name ?? 'Unknown Device'}
                    </Text>
                    <Text className="text-xs text-zinc-500">{device.id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#71717a" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
