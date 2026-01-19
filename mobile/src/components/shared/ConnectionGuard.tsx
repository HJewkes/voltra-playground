/**
 * ConnectionGuard
 * 
 * Wrapper component that shows a connection prompt when not connected.
 * Use this to wrap screens that require an active Voltra connection.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores';

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
  } = useSessionStore();
  
  const isConnected = primaryDeviceId && devices.has(primaryDeviceId);
  
  // Show loading while restoring connection
  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900 p-6">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-zinc-400 mt-4">Restoring connection...</Text>
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
      <Text className="text-xl font-semibold text-white mt-4 text-center">
        {message}
      </Text>
      
      {showScanButton && (
        <>
          <TouchableOpacity
            className={`mt-6 px-8 py-3 rounded-xl ${
              isScanning ? 'bg-zinc-700' : 'bg-blue-600'
            }`}
            onPress={() => scan()}
            disabled={isScanning}
          >
            {isScanning ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white font-semibold ml-2">Scanning...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">Scan for Devices</Text>
            )}
          </TouchableOpacity>
          
          {/* Show discovered devices */}
          {discoveredDevices.length > 0 && (
            <View className="mt-6 w-full">
              <Text className="text-zinc-400 text-sm mb-2">Found devices:</Text>
              {discoveredDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  className="bg-zinc-800 p-4 rounded-lg mb-2 flex-row items-center justify-between"
                  onPress={() => connectDevice(device)}
                >
                  <View>
                    <Text className="text-white font-medium">
                      {device.name ?? 'Unknown Device'}
                    </Text>
                    <Text className="text-zinc-500 text-xs">{device.id}</Text>
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
