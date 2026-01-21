/**
 * ConnectPrompt
 *
 * Portable connection component that can be embedded in any screen.
 * Auto-scans for devices and allows connecting without navigating away.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectionStore } from '@/stores';
import { colors } from '@/theme';
import { SCAN_DURATION, SCAN_INTERVAL } from '@/config';
import { Card, Stack, Surface, ListItem } from '@/components/ui';
import type { Device } from '@/domain/bluetooth/adapters';

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
  const { discoveredDevices, isScanning, isRestoring, scan, connectDevice, bleEnvironment } =
    useConnectionStore();

  // BLE environment info from store
  const { environment, bleSupported, warningMessage } = bleEnvironment;

  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Perform a scan
  const doScan = useCallback(async () => {
    if (isScanning) return;

    try {
      setHasScanned(true);
      await scan(SCAN_DURATION);
      setError(null);
    } catch {
      // Silent fail for auto-scans
    }
  }, [isScanning, scan]);

  // Auto-scan on mount (only if BLE is supported)
  useEffect(() => {
    if (autoScan && !isRestoring && bleSupported) {
      const timeout = setTimeout(doScan, 300);
      return () => clearTimeout(timeout);
    }
  }, [autoScan, isRestoring, bleSupported, doScan]);

  // Periodic auto-scan (only if BLE is supported)
  useEffect(() => {
    if (!autoScan || !bleSupported) return;

    scanIntervalRef.current = setInterval(() => {
      if (!isScanning) {
        doScan();
      }
    }, SCAN_INTERVAL);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [autoScan, isScanning, doScan, bleSupported]);

  const handleConnect = async (device: Device) => {
    setConnectingDeviceId(device.id);
    setError(null);
    try {
      await connectDevice(device);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('WebSocket') || msg.includes('relay')) {
        setError('BLE relay not running. Run "make relay".');
      } else {
        setError(`Connection failed: ${msg}`);
      }
    } finally {
      setConnectingDeviceId(null);
    }
  };

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
        padding="lg"
        marginBottom={false}
        style={{ maxWidth: 400, width: '100%' }}
      >
        {/* Header with scan indicator */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="bluetooth-outline" size={24} color={colors.text.muted} />
            <Text className="ml-3 text-lg font-bold text-content-primary">Voltras</Text>
          </View>
          {bleSupported && (
            <TouchableOpacity
              onPress={doScan}
              disabled={isScanning || !bleSupported}
              className="flex-row items-center rounded-xl px-3 py-2"
              style={{
                backgroundColor: isScanning ? colors.primary[500] + '20' : colors.surface.dark,
              }}
              activeOpacity={0.7}
            >
              {isScanning ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                  <Text className="ml-2 text-sm font-medium text-primary-500">Scanning</Text>
                </>
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.text.secondary} />
                  <Text className="ml-2 text-sm font-medium text-content-secondary">Scan</Text>
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
                {environment === 'simulator' ? 'Simulator Detected' : 'Expo Go Detected'}
              </Text>
              <Text className="text-xs leading-5" style={{ color: colors.text.secondary }}>
                {warningMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Subtitle - only show if BLE is supported */}
        {bleSupported && <Text className="mb-4 text-sm text-content-tertiary">{subtitle}</Text>}

        {/* Device List */}
        {discoveredDevices.length > 0 && (
          <Stack gap="xs">
            {discoveredDevices.map((device) => {
              const isThisConnecting = connectingDeviceId === device.id;
              return (
                <Surface
                  key={device.id}
                  elevation="inset"
                  radius="lg"
                  border={false}
                  style={{ opacity: connectingDeviceId !== null && !isThisConnecting ? 0.5 : 1 }}
                >
                  <ListItem
                    icon="hardware-chip-outline"
                    iconColor={colors.primary[500]}
                    iconBgColor={colors.surface.card}
                    title={device.name || 'Voltra'}
                    subtitle={device.id}
                    onPress={() => handleConnect(device)}
                    disabled={connectingDeviceId !== null}
                    trailing={
                      isThisConnecting ? (
                        <ActivityIndicator size="small" color={colors.primary[500]} />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                      )
                    }
                  />
                </Surface>
              );
            })}
          </Stack>
        )}

        {/* Empty state - scanning */}
        {discoveredDevices.length === 0 && isScanning && (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text className="mt-3 text-content-secondary">Looking for Voltras...</Text>
          </View>
        )}

        {/* Empty state - no devices */}
        {discoveredDevices.length === 0 && !isScanning && hasScanned && (
          <View className="items-center py-6">
            <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
            <Text className="mt-3 text-center text-sm text-content-muted">No Voltras found</Text>
            <Text className="mt-1 text-xs text-content-muted">Will scan again automatically</Text>
          </View>
        )}

        {/* Initial state */}
        {discoveredDevices.length === 0 && !isScanning && !hasScanned && (
          <View className="items-center py-6">
            <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
            <Text className="mt-3 text-sm text-content-muted">Waiting to scan...</Text>
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
      </Card>
    </View>
  );
}
