/**
 * SettingsScreen
 * 
 * Device connection and app settings.
 * Pure orchestration - composes device/ components and UI primitives.
 */

import React, { useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { 
  Surface,
  InfoRow,
  ErrorBanner,
} from '@/components/ui';
import { 
  ConnectionBanner,
  DeviceList,
  RelayStatus,
} from '@/components/device';
import { useConnectionStore } from '@/stores';
import type { Device } from '@/domain/bluetooth/adapters';

/**
 * SettingsScreen - connection and app settings.
 */
export function SettingsScreen() {
  const {
    // State
    discoveredDevices,
    isScanning,
    isRestoring,
    relayStatus,
    error,
    connectingDeviceId,
    bleEnvironment,
    primaryDeviceId,
    devices,
    // Actions
    scan,
    connectDevice,
    disconnectAll,
    clearError,
    getPrimaryDevice,
  } = useConnectionStore();
  
  // Compute derived state locally (Zustand getters don't trigger re-renders reliably)
  const isWeb = bleEnvironment.isWeb;
  const isConnected = !!(primaryDeviceId && devices.has(primaryDeviceId));
  const connectedDeviceName = getPrimaryDevice()?.getState().deviceName ?? null;
  const relayNotReady = isWeb && relayStatus !== 'connected';
  
  // Environment
  const { bleSupported, warningMessage, environment } = bleEnvironment;
  
  // Wrap actions for the DeviceList component
  const handleScan = useCallback(() => scan(), [scan]);
  const handleConnect = useCallback((device: Device) => connectDevice(device), [connectDevice]);
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
            relayNotReady={relayNotReady}
            environment={environment}
            warningMessage={warningMessage}
            onScan={handleScan}
            onDeviceSelect={handleConnect}
          />
        )}
        
        {/* Error Banner */}
        {error && (
          <ErrorBanner 
            message={error} 
            onDismiss={clearError}
            style={{ marginVertical: 16 }}
          />
        )}
        
        {/* Relay Status (Web only) */}
        {isWeb && <RelayStatus status={relayStatus} />}
        
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
      <Surface elevation="inset" radius="lg" border={false} style={{ marginBottom: 16 }}>
        <View className="p-4">
          <InfoRow label="Version" value="0.2.0" showBorder />
          <InfoRow label="BLE Mode" value={isWeb ? 'Proxy (Web)' : 'Native'} />
        </View>
      </Surface>
      
      <Text className="text-content-muted text-xs text-center px-4 mb-6">
        Unofficial Voltra SDK. Not affiliated with Beyond Power.
      </Text>
    </>
  );
}
