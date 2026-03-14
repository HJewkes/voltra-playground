/**
 * DeviceConnection
 *
 * Unified device connection component with three variants:
 * - inline: Compact row for dashboard embedding
 * - card: Full card with scan, BLE warning, device list
 * - guard: Full-screen gate that wraps children when connected
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useConnectionStore, selectIsConnected, selectBleEnvironment } from '@/stores';
import { SCAN_DURATION, SCAN_INTERVAL } from '@/config';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { InlineVariant } from './DeviceConnectionInline';
import { ConnectionCard } from './DeviceConnectionCard';
import type { DiscoveredDevice } from '@/domain/device';

const t = getSemanticColors('dark');

export interface DeviceConnectionProps {
  variant: 'inline' | 'card' | 'guard';
  children?: React.ReactNode;
  subtitle?: string;
  autoScan?: boolean;
}

export function DeviceConnection({
  variant,
  children,
  subtitle = 'Connect to your Voltra to continue',
  autoScan = true,
}: DeviceConnectionProps) {
  const {
    discoveredDevices,
    isScanning,
    isRestoring,
    scan,
    connectDevice,
    disconnectAll,
    devices: connectedDevicesMap,
    primaryDeviceId,
  } = useConnectionStore();

  const isConnected = useConnectionStore(selectIsConnected);
  const bleEnvironment = selectBleEnvironment();
  const { bleSupported, warningMessage, environment, requiresUserGesture } = bleEnvironment;

  const connectedDevices = Array.from(connectedDevicesMap.entries()).map(([id, store]) => ({
    id,
    name: store.getState().deviceName ?? 'Voltra',
  }));

  const canAutoScan = autoScan && !requiresUserGesture;

  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleConnect = useCallback(
    async (device: DiscoveredDevice) => {
      setConnectingDeviceId(device.id);
      setError(null);
      try {
        await connectDevice(device);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Connection failed: ${msg}`);
      } finally {
        setConnectingDeviceId(null);
      }
    },
    [connectDevice],
  );

  const doScan = useCallback(async () => {
    if (isScanning || connectingDeviceId) return;

    try {
      setHasScanned(true);
      setError(null);
      await scan(SCAN_DURATION);

      if (requiresUserGesture) {
        const devices = useConnectionStore.getState().discoveredDevices;
        if (devices.length > 0) {
          const device = devices[devices.length - 1];
          setConnectingDeviceId(device.id);
          try {
            await connectDevice(device);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Connection failed: ${msg}`);
          } finally {
            setConnectingDeviceId(null);
          }
        }
      }
    } catch {
      // Silent fail for auto-scans
    }
  }, [isScanning, connectingDeviceId, scan, requiresUserGesture, connectDevice]);

  const handleDisconnect = useCallback(() => {
    if (primaryDeviceId) disconnectAll();
  }, [primaryDeviceId, disconnectAll]);

  // Auto-scan on mount
  useEffect(() => {
    if (canAutoScan && !isRestoring && bleSupported && discoveredDevices.length === 0) {
      const timeout = setTimeout(doScan, 300);
      return () => clearTimeout(timeout);
    }
  }, [canAutoScan, isRestoring, bleSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic auto-scan
  useEffect(() => {
    if (!canAutoScan || !bleSupported || discoveredDevices.length > 0) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    scanIntervalRef.current = setInterval(() => {
      const state = useConnectionStore.getState();
      if (!state.isScanning && state.discoveredDevices.length === 0) {
        scan(SCAN_DURATION).catch(() => {});
      }
    }, SCAN_INTERVAL);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [canAutoScan, bleSupported, discoveredDevices.length, scan]);

  // Guard variant: render children when connected
  if (variant === 'guard' && isConnected) {
    return <>{children}</>;
  }

  // Restoring state (card + guard show full-screen, inline shows compact)
  if (isRestoring) {
    if (variant === 'inline') {
      return (
        <View className="flex-row items-center rounded-2xl p-4" style={{ backgroundColor: alpha(t['brand-primary'], 0.08) }}>
          <ActivityIndicator size="small" color={t['brand-primary']} />
          <Text className="ml-3 text-sm text-text-secondary">Restoring connection...</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center bg-background-base p-6">
        <ActivityIndicator size="large" color={t['brand-primary']} />
        <Text className="mt-4 text-text-secondary">Restoring connection...</Text>
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <InlineVariant
        isConnected={isConnected}
        connectedDevices={connectedDevices}
        isScanning={isScanning}
        connectingDeviceId={connectingDeviceId}
        bleSupported={bleSupported}
        doScan={doScan}
        handleDisconnect={handleDisconnect}
        error={error}
        setError={setError}
      />
    );
  }

  // Card and guard share the same connection UI, just wrapped differently
  const connectionUI = (
    <ConnectionCard
      isConnected={isConnected}
      connectedDevices={connectedDevices}
      discoveredDevices={discoveredDevices}
      isScanning={isScanning}
      connectingDeviceId={connectingDeviceId}
      bleSupported={bleSupported}
      warningMessage={warningMessage}
      environment={environment}
      requiresUserGesture={requiresUserGesture}
      hasScanned={hasScanned}
      subtitle={subtitle}
      error={error}
      onScan={doScan}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onDismissError={() => setError(null)}
    />
  );

  if (variant === 'guard') {
    return (
      <View className="flex-1 items-center justify-center bg-background-base p-6">
        {connectionUI}
      </View>
    );
  }

  return connectionUI;
}
