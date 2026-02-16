/**
 * ConnectPrompt
 *
 * Portable connection component that can be embedded in any screen.
 * Auto-scans for devices and allows connecting without navigating away.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectionStore, selectIsConnected, selectBleEnvironment } from '@/stores';
import { colors } from '@/theme';
import { SCAN_DURATION, SCAN_INTERVAL } from '@/config';
import { Card, CardContent, VStack, Surface, ListItem, ListItemContent, ListItemTrailing } from '@titan-design/react-ui';
import type { DiscoveredDevice } from '@/domain/device';

export interface ConnectPromptProps {
  /** Optional subtitle/message */
  subtitle?: string;
  /** Whether to auto-scan on mount (default: true) */
  autoScan?: boolean;
}

export function ConnectPrompt({
  subtitle = 'Connect to your Voltra to continue',
  autoScan = true,
}: ConnectPromptProps) {
  const {
    discoveredDevices,
    isScanning,
    isRestoring,
    scan,
    connectDevice,
    devices: connectedDevicesMap,
  } = useConnectionStore();

  const isConnected = useConnectionStore(selectIsConnected);

  // BLE environment - detected fresh each render to avoid SSR/caching issues
  const bleEnvironment = selectBleEnvironment();
  const { bleSupported, warningMessage, requiresUserGesture } = bleEnvironment;

  // Get list of connected devices for display
  const connectedDevices = Array.from(connectedDevicesMap.entries()).map(([id, store]) => ({
    id,
    name: store.getState().deviceName ?? 'Voltra',
  }));

  // Disable auto-scan if user gesture is required (Web Bluetooth)
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
    [connectDevice]
  );

  // Perform a scan (and auto-connect on web)
  const doScan = useCallback(async () => {
    if (isScanning || connectingDeviceId) return;

    try {
      setHasScanned(true);
      setError(null);
      await scan(SCAN_DURATION);

      // On web, auto-connect to the device that was just selected from browser picker
      // We need to get the latest devices from the store after scan completes
      if (requiresUserGesture) {
        const devices = useConnectionStore.getState().discoveredDevices;
        if (devices.length > 0) {
          // Connect to the most recently selected device (last in list)
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

  // Auto-scan on mount (only if BLE is supported and doesn't require user gesture)
  useEffect(() => {
    if (canAutoScan && !isRestoring && bleSupported && discoveredDevices.length === 0) {
      const timeout = setTimeout(doScan, 300);
      return () => clearTimeout(timeout);
    }
  }, [canAutoScan, isRestoring, bleSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic auto-scan (only if no devices found yet)
  useEffect(() => {
    // Stop auto-scanning once we have devices to show
    if (!canAutoScan || !bleSupported || discoveredDevices.length > 0) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    scanIntervalRef.current = setInterval(() => {
      const state = useConnectionStore.getState();
      // Only scan if not already scanning and still no devices
      if (!state.isScanning && state.discoveredDevices.length === 0) {
        scan(SCAN_DURATION);
      }
    }, SCAN_INTERVAL);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [canAutoScan, bleSupported, discoveredDevices.length, scan]);

  // Restoring state
  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-400 p-6">
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text className="mt-4 text-content-secondary">Restoring connection...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface-400 p-6">
      <Card
        elevation={1}
        style={{ maxWidth: 400, width: '100%' }}
      >
        <CardContent className="p-6">
        {/* Header with scan/connect button */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="bluetooth-outline" size={24} color={colors.text.muted} />
            <Text className="ml-3 text-lg font-bold text-content-primary">Voltras</Text>
          </View>
          {bleSupported && (
            <TouchableOpacity
              onPress={doScan}
              disabled={isScanning || connectingDeviceId !== null}
              className="flex-row items-center rounded-xl px-3 py-2"
              style={{
                backgroundColor:
                  isScanning || connectingDeviceId
                    ? colors.primary[500] + '20'
                    : colors.surface.dark,
              }}
              activeOpacity={0.7}
            >
              {isScanning || connectingDeviceId ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                  <Text className="ml-2 text-sm font-medium text-primary-500">
                    {connectingDeviceId ? 'Connecting' : 'Scanning'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name={requiresUserGesture ? 'add' : 'refresh'}
                    size={16}
                    color={colors.text.secondary}
                  />
                  <Text className="ml-2 text-sm font-medium text-content-secondary">
                    {requiresUserGesture
                      ? connectedDevices.length > 0
                        ? 'Add Another'
                        : 'Connect'
                      : 'Scan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* BLE Environment Warning */}
        {warningMessage && (
          <View
            className="mb-4 flex-row items-start rounded-xl p-4"
            style={{ backgroundColor: colors.warning.DEFAULT + '15' }}
          >
            <Ionicons
              name="warning"
              size={20}
              color={colors.warning.DEFAULT}
              style={{ marginTop: 2 }}
            />
            <View className="ml-3 flex-1">
              <Text className="mb-1 font-semibold" style={{ color: colors.warning.DEFAULT }}>
                BLE Warning
              </Text>
              <Text className="text-xs leading-5" style={{ color: colors.text.secondary }}>
                {warningMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Subtitle - only show if BLE is supported and not connected */}
        {bleSupported && !isConnected && (
          <Text className="mb-4 text-sm text-content-tertiary">{subtitle}</Text>
        )}

        {/* Connected Devices */}
        {connectedDevices.length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
              Connected
            </Text>
            <VStack gap={1}>
              {connectedDevices.map((device) => (
                <Surface key={device.id} elevation={0} className="rounded-xl bg-surface-input">
                  <ListItem>
                    <View
                      className="mr-3 items-center justify-center rounded-xl"
                      style={{ width: 48, height: 48, backgroundColor: colors.success.DEFAULT + '20' }}
                    >
                      <Ionicons name="checkmark-circle" size={24} color={colors.success.DEFAULT} />
                    </View>
                    <ListItemContent title={device.name} subtitle="Connected" />
                    <ListItemTrailing>
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colors.success.DEFAULT }}
                      />
                    </ListItemTrailing>
                  </ListItem>
                </Surface>
              ))}
            </VStack>
          </View>
        )}

        {/* Discovered (not yet connected) Device List - only for native, web auto-connects */}
        {!requiresUserGesture && discoveredDevices.length > 0 && (
          <View>
            {connectedDevices.length > 0 && (
              <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Available
              </Text>
            )}
            <VStack gap={1}>
              {discoveredDevices.map((device) => {
                const isThisConnecting = connectingDeviceId === device.id;
                const isAlreadyConnected = connectedDevices.some((d) => d.id === device.id);
                if (isAlreadyConnected) return null;
                return (
                  <Surface
                    key={device.id}
                    elevation={0}
                    className="rounded-xl bg-surface-input"
                    style={{ opacity: connectingDeviceId !== null && !isThisConnecting ? 0.5 : 1 }}
                  >
                    <ListItem onPress={() => handleConnect(device)} disabled={connectingDeviceId !== null}>
                      <View
                        className="mr-3 items-center justify-center rounded-xl"
                        style={{ width: 48, height: 48, backgroundColor: colors.surface.card }}
                      >
                        <Ionicons name="hardware-chip-outline" size={24} color={colors.primary[500]} />
                      </View>
                      <ListItemContent title={device.name || 'Voltra'} subtitle={device.id} />
                      <ListItemTrailing>
                        {isThisConnecting ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                        )}
                      </ListItemTrailing>
                    </ListItem>
                  </Surface>
                );
              })}
            </VStack>
          </View>
        )}

        {/* Empty state - scanning (native only, web shows connecting state in button) */}
        {!requiresUserGesture && discoveredDevices.length === 0 && isScanning && (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text className="mt-3 text-content-secondary">Looking for Voltras...</Text>
          </View>
        )}

        {/* Empty state - no devices (native) */}
        {!requiresUserGesture &&
          connectedDevices.length === 0 &&
          discoveredDevices.length === 0 &&
          !isScanning &&
          hasScanned && (
            <View className="items-center py-6">
              <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
              <Text className="mt-3 text-center text-sm text-content-muted">No Voltras found</Text>
              <Text className="mt-1 text-xs text-content-muted">Will scan again automatically</Text>
            </View>
          )}

        {/* Initial state - no devices connected yet */}
        {connectedDevices.length === 0 && !isScanning && !connectingDeviceId && !hasScanned && (
          <View className="items-center py-6">
            <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
            <Text className="mt-3 text-sm text-content-muted">
              {requiresUserGesture
                ? 'Click Connect to pair your Voltra'
                : 'Waiting to scan...'}
            </Text>
          </View>
        )}

        {/* Web: Prompt to add more devices after first connection */}
        {requiresUserGesture && connectedDevices.length > 0 && !connectingDeviceId && (
          <View className="items-center py-4">
            <Text className="text-xs text-content-muted">
              Click "Add Another" to connect additional devices
            </Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View
            className="mt-2 flex-row items-center rounded-xl p-3"
            style={{ backgroundColor: colors.danger.DEFAULT + '15' }}
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger.DEFAULT} />
            <Text className="ml-2 flex-1 text-xs" style={{ color: colors.danger.light }}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        )}
        </CardContent>
      </Card>
    </View>
  );
}
