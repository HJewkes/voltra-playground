/**
 * SettingsScreen
 *
 * Device connection and app settings.
 * Pure orchestration - composes device/ components and UI primitives.
 */

import React, { useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Alert, AlertDescription, DataRow, Surface } from '@titan-design/react-ui';
import { ConnectionBanner, DeviceList } from '@/components/device';
import { DevToolsSection } from '@/components/settings';
import { useConnectionStore, selectBleEnvironment } from '@/stores';
import type { DiscoveredDevice } from '@/domain/device';

/**
 * SettingsScreen - connection and app settings.
 */
export function SettingsScreen() {
  const {
    // State
    discoveredDevices,
    isScanning,
    isRestoring,
    error,
    connectingDeviceId,
    primaryDeviceId,
    devices,
    // Actions
    scan,
    connectDevice,
    disconnectAll,
    clearError,
    getPrimaryDevice,
  } = useConnectionStore();

  // BLE environment - detected fresh to avoid SSR/caching issues
  const bleEnvironment = selectBleEnvironment();
  const { bleSupported, warningMessage, environment, isWeb, requiresUserGesture } = bleEnvironment;

  // Compute derived state locally (Zustand getters don't trigger re-renders reliably)
  const isConnected = !!(primaryDeviceId && devices.has(primaryDeviceId));
  const connectedDeviceName = getPrimaryDevice()?.getState().deviceName ?? null;

  // Wrap actions for the DeviceList component
  // On web, auto-connect after device is selected from browser picker
  const handleScan = useCallback(async () => {
    await scan();
    if (requiresUserGesture) {
      const devices = useConnectionStore.getState().discoveredDevices;
      if (devices.length > 0) {
        const device = devices[devices.length - 1]; // Most recently selected
        await connectDevice(device);
      }
    }
  }, [scan, requiresUserGesture, connectDevice]);
  const handleConnect = useCallback(
    (device: DiscoveredDevice) => connectDevice(device),
    [connectDevice]
  );
  const handleDisconnect = useCallback(() => {
    if (primaryDeviceId) {
      disconnectAll();
    }
  }, [primaryDeviceId, disconnectAll]);

  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        {/* Connected Device */}
        {isConnected && (
          <ConnectionBanner
            deviceName={connectedDeviceName || 'Voltra'}
            onDisconnect={handleDisconnect}
          />
        )}

        {/* Device Scanner */}
        {!isConnected && (
          <DeviceList
            devices={discoveredDevices}
            isScanning={isScanning}
            isRestoring={isRestoring}
            connectingDeviceId={connectingDeviceId}
            bleSupported={bleSupported}
            environment={environment}
            warningMessage={warningMessage}
            requiresUserGesture={requiresUserGesture}
            onScan={handleScan}
            onDeviceSelect={handleConnect}
          />
        )}

        {/* Error Banner */}
        {error && (
          <Alert status="error" variant="subtle" onClose={clearError} className="my-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Dev Tools (DEV only) */}
        {__DEV__ && <DevToolsSection />}

        {/* App Info - inlined using primitives */}
        <AppInfoSection isWeb={isWeb} />
      </View>
    </ScrollView>
  );
}

/**
 * AppInfoSection - displays app version and settings.
 * Inline helper component (presentational only).
 */
function AppInfoSection({ isWeb }: { isWeb: boolean }) {
  return (
    <>
      <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
        <View className="p-4">
          <DataRow label="Version" value="0.2.0" className="border-b border-surface-200 pb-3 mb-3" />
          <DataRow label="BLE Mode" value={isWeb ? 'Web Bluetooth' : 'Native'} />
        </View>
      </Surface>

      <Text className="mb-6 px-4 text-center text-xs text-text-disabled">
        Unofficial Voltra SDK. Not affiliated with Beyond Power.
      </Text>
    </>
  );
}
