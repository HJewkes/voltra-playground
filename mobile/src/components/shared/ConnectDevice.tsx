/**
 * ConnectDevice
 * 
 * Portable connection component that can be embedded in any screen.
 * Auto-scans for devices and allows connecting without navigating away.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores';
import { colors } from '@/theme';
import { useBLEEnvironment } from '@/hooks';
import { SCAN_DURATION, SCAN_INTERVAL } from '@/config';
import type { Device } from '@/ble/types';

interface ConnectDeviceProps {
  /** Optional subtitle/message */
  subtitle?: string;
  /** Whether to auto-scan on mount (default: true) */
  autoScan?: boolean;
}

export function ConnectDevice({
  subtitle = 'Connect to your Voltra to continue',
  autoScan = true,
}: ConnectDeviceProps) {
  const { 
    discoveredDevices,
    isScanning,
    isRestoring,
    scan,
    connectDevice,
  } = useSessionStore();
  
  // Check BLE environment
  const { environment, bleSupported, warningMessage } = useBLEEnvironment();
  
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
    } catch (e) {
      // Silent fail for auto-scans
    }
  }, [isScanning, scan]);
  
  // Auto-scan on mount (only if BLE is supported)
  useEffect(() => {
    if (autoScan && !isRestoring && bleSupported) {
      const timeout = setTimeout(doScan, 300);
      return () => clearTimeout(timeout);
    }
  }, [autoScan, isRestoring, bleSupported]);
  
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
    } catch (e: any) {
      const msg = e?.message || String(e);
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
      <View className="flex-1 bg-surface-400 items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text className="text-content-secondary mt-4">Restoring connection...</Text>
      </View>
    );
  }
  
  return (
    <View className="flex-1 bg-surface-400 items-center justify-center p-6">
      <View 
        className="rounded-3xl p-6 w-full border border-surface-100"
        style={[{ backgroundColor: colors.surface.card, maxWidth: 400 }]}
      >
        {/* Header with scan indicator */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Ionicons name="bluetooth-outline" size={24} color={colors.text.muted} />
            <Text className="font-bold text-content-primary text-lg ml-3">
              Voltras
            </Text>
          </View>
          {bleSupported && (
            <TouchableOpacity
              onPress={doScan}
              disabled={isScanning || !bleSupported}
              className="flex-row items-center px-3 py-2 rounded-xl"
              style={{ 
                backgroundColor: isScanning ? colors.primary[500] + '20' : colors.surface.dark,
              }}
              activeOpacity={0.7}
            >
              {isScanning ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                  <Text className="text-primary-500 text-sm font-medium ml-2">
                    Scanning
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.text.secondary} />
                  <Text className="text-content-secondary text-sm font-medium ml-2">
                    Scan
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {/* BLE Environment Warning */}
        {warningMessage && (
          <View 
            className="p-4 rounded-xl mb-4 flex-row items-start"
            style={{ backgroundColor: colors.warning + '15' }}
          >
            <Ionicons name="warning" size={20} color={colors.warning} style={{ marginTop: 2 }} />
            <View className="ml-3 flex-1">
              <Text className="font-semibold mb-1" style={{ color: colors.warning }}>
                {environment === 'simulator' ? 'Simulator Detected' : 'Expo Go Detected'}
              </Text>
              <Text className="text-xs leading-5" style={{ color: colors.text.secondary }}>
                {warningMessage}
              </Text>
            </View>
          </View>
        )}
        
        {/* Subtitle - only show if BLE is supported */}
        {bleSupported && (
          <Text className="text-content-tertiary text-sm mb-4">
            {subtitle}
          </Text>
        )}
        
        {/* Device List */}
        {discoveredDevices.length > 0 && (
          <View>
            {discoveredDevices.map((device) => {
              const isThisConnecting = connectingDeviceId === device.id;
              return (
                <TouchableOpacity
                  key={device.id}
                  onPress={() => handleConnect(device)}
                  disabled={connectingDeviceId !== null}
                  className="rounded-2xl p-4 mb-2 flex-row items-center"
                  style={[
                    { 
                      backgroundColor: colors.surface.dark,
                      opacity: connectingDeviceId !== null && !isThisConnecting ? 0.5 : 1,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.surface.card }}
                  >
                    <Ionicons name="hardware-chip-outline" size={20} color={colors.primary[500]} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-content-primary">
                      {device.name || 'Voltra'}
                    </Text>
                    <Text className="text-content-muted text-xs mt-0.5" numberOfLines={1}>
                      {device.id}
                    </Text>
                  </View>
                  {isThisConnecting ? (
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {/* Empty state - scanning */}
        {discoveredDevices.length === 0 && isScanning && (
          <View className="py-6 items-center">
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text className="text-content-secondary mt-3">Looking for Voltras...</Text>
          </View>
        )}
        
        {/* Empty state - no devices */}
        {discoveredDevices.length === 0 && !isScanning && hasScanned && (
          <View className="py-6 items-center">
            <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
            <Text className="text-content-muted text-sm mt-3 text-center">
              No Voltras found
            </Text>
            <Text className="text-content-muted text-xs mt-1">
              Will scan again automatically
            </Text>
          </View>
        )}
        
        {/* Initial state */}
        {discoveredDevices.length === 0 && !isScanning && !hasScanned && (
          <View className="py-6 items-center">
            <Ionicons name="bluetooth-outline" size={36} color={colors.text.muted} />
            <Text className="text-content-muted text-sm mt-3">
              Waiting to scan...
            </Text>
          </View>
        )}
        
        {/* Error Display */}
        {error && (
          <View 
            className="p-3 rounded-xl mt-2 flex-row items-center"
            style={{ backgroundColor: colors.danger + '15' }}
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text className="ml-2 flex-1 text-xs" style={{ color: colors.dangerLight }}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
