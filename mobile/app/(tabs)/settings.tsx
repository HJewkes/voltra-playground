import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores';
import { colors } from '@/theme';
import { useBLEEnvironment } from '@/hooks';
import { 
  RELAY_HTTP_URL, 
  RELAY_CHECK_TIMEOUT, 
  RELAY_CHECK_INTERVAL,
  SCAN_DURATION,
  SCAN_INTERVAL,
} from '@/config';
import type { Device } from '@/ble/types';

type RelayStatus = 'checking' | 'connected' | 'disconnected' | 'error';

export default function Settings() {
  const { 
    primaryDeviceId,
    devices,
    discoveredDevices,
    isScanning,
    isRestoring,
    scan,
    connectDevice,
    disconnectDevice,
  } = useSessionStore();
  
  // Check BLE environment
  const { environment, bleSupported, warningMessage } = useBLEEnvironment();
  
  // Only need relay on web - native devices use native BLE
  const isWeb = Platform.OS === 'web';
  
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Native starts as 'connected' (no relay needed), web starts as 'checking'
  const [relayStatus, setRelayStatus] = useState<RelayStatus>(isWeb ? 'checking' : 'connected');
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const connectedDevice = primaryDeviceId ? devices.get(primaryDeviceId) : null;
  const isConnected = !!connectedDevice;
  const connectedDeviceName = connectedDevice?.getState().deviceName;
  const connectionState = connectedDevice?.getState().connectionState ?? 'disconnected';
  
  // Check relay status (web only)
  const checkRelayStatus = useCallback(async () => {
    if (!isWeb) {
      setRelayStatus('connected'); // Native doesn't need relay
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RELAY_CHECK_TIMEOUT);
      const response = await fetch(`${RELAY_HTTP_URL}/`, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        setRelayStatus('connected');
      } else {
        setRelayStatus('error');
      }
    } catch {
      setRelayStatus('disconnected');
    }
  }, []);
  
  // Perform a scan
  const doScan = useCallback(async () => {
    if (isScanning || isConnected) return;
    if (isWeb && relayStatus !== 'connected') return;
    if (!bleSupported) return;
    
    console.log('[Settings] Starting scan...');
    try {
      await scan(SCAN_DURATION);
      setLastScanTime(Date.now());
      setError(null);
      console.log('[Settings] Scan complete');
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      console.error('[Settings] Scan error:', errorMsg);
      if (errorMsg.includes('WebSocket') || errorMsg.includes('Failed to connect')) {
        setRelayStatus('disconnected');
      } else if (errorMsg.includes('permission') || errorMsg.includes('Unauthorized')) {
        setError('Bluetooth permission required. Please enable in Settings.');
      } else if (errorMsg.includes('Timeout') || errorMsg.includes('PoweredOff')) {
        setError('Please enable Bluetooth on your device.');
      } else {
        setError(`Scan failed: ${errorMsg}`);
      }
    }
  }, [isScanning, isConnected, relayStatus, scan, bleSupported]);
  
  // Check relay on mount
  useEffect(() => {
    checkRelayStatus();
    const interval = setInterval(checkRelayStatus, RELAY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkRelayStatus]);
  
  // Auto-scan on mount and periodically when not connected
  useEffect(() => {
    // Initial scan after relay check
    const initialScan = setTimeout(() => {
      if (relayStatus === 'connected' || !isWeb) {
        doScan();
      }
    }, 500);
    
    return () => clearTimeout(initialScan);
  }, [relayStatus]);
  
  // Periodic auto-scan when not connected
  useEffect(() => {
    if (isConnected) {
      // Clear interval when connected
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }
    
    // Set up periodic scanning
    scanIntervalRef.current = setInterval(() => {
      if (!isScanning && !isConnected) {
        doScan();
      }
    }, SCAN_INTERVAL);
    
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isConnected, isScanning, doScan]);
  
  const handleConnect = async (device: Device) => {
    setConnectingDeviceId(device.id);
    setError(null);
    try {
      await connectDevice(device);
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      if (errorMsg.includes('WebSocket') || errorMsg.includes('relay')) {
        setError('Cannot connect to BLE relay. Run "make relay" in terminal.');
      } else if (errorMsg.includes('timeout')) {
        setError('Connection timed out. Ensure Voltra is powered on.');
      } else {
        setError(`Connection failed: ${errorMsg}`);
      }
    } finally {
      setConnectingDeviceId(null);
    }
  };
  
  const handleDisconnect = async () => {
    setError(null);
    if (primaryDeviceId) {
      try {
        await disconnectDevice(primaryDeviceId);
      } catch (e: any) {
        setError(`Disconnect failed: ${e?.message || e}`);
      }
    }
  };
  
  const handleManualScan = () => {
    setError(null);
    if (isWeb && relayStatus !== 'connected') {
      setError('BLE relay not running. Start with "make relay".');
      return;
    }
    doScan();
  };
  
  // Relay not ready in dev mode
  const relayNotReady = isWeb && relayStatus !== 'connected';
  
  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        
        {/* Connected Device Card */}
        {isConnected && (
          <View 
            className="rounded-3xl p-5 mb-4 border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            <View className="flex-row items-center">
              <View 
                className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                style={{ backgroundColor: colors.success + '20' }}
              >
                <Ionicons name="bluetooth" size={28} color={colors.success} />
              </View>
              <View className="flex-1">
                <Text className="text-xs uppercase tracking-wider text-content-tertiary mb-1">
                  Connected
                </Text>
                <Text className="font-bold text-content-primary text-lg">
                  {connectedDeviceName || 'Voltra'}
                </Text>
              </View>
              <View 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.success }}
              />
            </View>
            <TouchableOpacity
              onPress={handleDisconnect}
              className="mt-4 py-3 rounded-xl"
              style={{ backgroundColor: colors.surface.dark }}
              activeOpacity={0.7}
            >
              <Text className="text-center text-content-secondary font-semibold">
                Disconnect
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Voltras Section */}
        {!isConnected && (
          <View 
            className="rounded-3xl p-5 mb-4 border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            {/* Header with scan indicator */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-content-primary">
                Voltras
              </Text>
              {bleSupported && (
                <TouchableOpacity
                  onPress={handleManualScan}
                  disabled={isScanning || relayNotReady || !bleSupported}
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
                      <Ionicons 
                        name="refresh" 
                        size={16} 
                        color={relayNotReady ? colors.text.muted : colors.text.secondary} 
                      />
                      <Text 
                        className="text-sm font-medium ml-2"
                        style={{ color: relayNotReady ? colors.text.muted : colors.text.secondary }}
                      >
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
            
            {/* Restoring state */}
            {isRestoring && (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text className="text-content-secondary mt-3">Restoring connection...</Text>
              </View>
            )}
            
            {/* Device List */}
            {!isRestoring && discoveredDevices.length > 0 && (
              <View>
                {discoveredDevices.map((device) => {
                  const isThisConnecting = connectingDeviceId === device.id;
                  return (
                    <TouchableOpacity
                      key={device.id}
                      onPress={() => handleConnect(device)}
                      disabled={connectingDeviceId !== null}
                      className="p-4 rounded-2xl mb-3 flex-row items-center"
                      style={[
                        { 
                          backgroundColor: colors.surface.dark,
                          opacity: connectingDeviceId !== null && !isThisConnecting ? 0.5 : 1,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View 
                        className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.surface.card }}
                      >
                        <Ionicons name="hardware-chip-outline" size={24} color={colors.primary[500]} />
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
            
            {/* Empty state */}
            {!isRestoring && discoveredDevices.length === 0 && !isScanning && (
              <View className="py-8 items-center">
                <Ionicons name="bluetooth-outline" size={40} color={colors.text.muted} />
                <Text className="text-content-muted text-sm mt-3 text-center">
                  {relayNotReady 
                    ? 'Waiting for BLE relay...'
                    : 'No Voltras found'
                  }
                </Text>
                {!relayNotReady && lastScanTime > 0 && (
                  <Text className="text-content-muted text-xs mt-1">
                    Will scan again automatically
                  </Text>
                )}
              </View>
            )}
            
            {/* Scanning empty state */}
            {!isRestoring && discoveredDevices.length === 0 && isScanning && (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text className="text-content-secondary mt-3">Looking for Voltras...</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Error Display */}
        {error && (
          <View 
            className="rounded-2xl p-4 mb-4 flex-row items-start"
            style={{ backgroundColor: colors.danger + '15' }}
          >
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text className="flex-1 ml-3 text-sm" style={{ color: colors.dangerLight }}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* BLE Relay Status (Dev Mode) */}
        {isWeb && (
          <View 
            className="rounded-2xl p-4 mb-4 flex-row items-center"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <View 
              className="w-2 h-2 rounded-full mr-3"
              style={{ 
                backgroundColor: relayStatus === 'connected' 
                  ? colors.success 
                  : relayStatus === 'checking' 
                    ? colors.warning 
                    : colors.danger 
              }}
            />
            <Text className="flex-1 text-content-tertiary text-sm">
              BLE Relay: {relayStatus === 'connected' ? 'Running' : relayStatus === 'checking' ? 'Checking...' : 'Not running'}
            </Text>
            {relayStatus === 'disconnected' && (
              <Text className="text-xs font-mono" style={{ color: colors.text.muted }}>
                make relay
              </Text>
            )}
          </View>
        )}
        
        {/* App Info */}
        <View 
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: colors.surface.dark }}
        >
          <View className="flex-row justify-between items-center">
            <Text className="text-content-tertiary text-sm">Version</Text>
            <Text className="text-content-secondary text-sm font-medium">0.2.0</Text>
          </View>
          <View className="h-px bg-surface-100 my-3" />
          <View className="flex-row justify-between items-center">
            <Text className="text-content-tertiary text-sm">BLE Mode</Text>
            <Text className="text-content-secondary text-sm font-medium">
              {isWeb ? 'Proxy (Web)' : 'Native'}
            </Text>
          </View>
        </View>
        
        {/* Disclaimer */}
        <Text className="text-content-muted text-xs text-center px-4 mb-6">
          Unofficial Voltra SDK. Not affiliated with Beyond Power.
        </Text>
      </View>
    </ScrollView>
  );
}
