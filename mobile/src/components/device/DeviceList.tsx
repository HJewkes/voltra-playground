/**
 * DeviceList
 * 
 * Device list with scan button and various states (scanning, empty, devices).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Stack, LoadingState } from '@/components/ui';
import { colors } from '@/theme';
import { BLEWarning } from './BLEWarning';
import { ScanButton } from './ScanButton';
import { DeviceListItem } from './DeviceListItem';
import type { Device } from '@/domain/bluetooth/adapters';

export interface DeviceListProps {
  /** List of discovered devices */
  devices: Device[];
  /** Whether currently scanning */
  isScanning: boolean;
  /** Whether restoring a previous connection */
  isRestoring: boolean;
  /** ID of device currently being connected to */
  connectingDeviceId: string | null;
  /** Whether BLE is supported */
  bleSupported: boolean;
  /** Whether relay is not ready (web only) */
  relayNotReady: boolean;
  /** Environment type for warning */
  environment: string;
  /** Warning message about BLE environment */
  warningMessage: string | null;
  /** Called when scan button is pressed */
  onScan: () => void;
  /** Called when a device is selected */
  onDeviceSelect: (device: Device) => void;
}

/**
 * DeviceList - complete device scanning UI.
 */
export function DeviceList({
  devices,
  isScanning,
  isRestoring,
  connectingDeviceId,
  bleSupported,
  relayNotReady,
  environment,
  warningMessage,
  onScan,
  onDeviceSelect,
}: DeviceListProps) {
  const scanDisabled = isScanning || relayNotReady || !bleSupported;
  
  return (
    <Card elevation={1} padding="lg">
      {/* Header with scan button */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-content-primary">
          Voltras
        </Text>
        {bleSupported && (
          <ScanButton 
            isScanning={isScanning}
            disabled={scanDisabled}
            onPress={onScan}
          />
        )}
      </View>
      
      {/* BLE Environment Warning */}
      {warningMessage && (
        <BLEWarning 
          environment={environment} 
          message={warningMessage} 
        />
      )}
      
      {/* Restoring state */}
      {isRestoring && (
        <LoadingState message="Restoring connection..." />
      )}
      
      {/* Device List */}
      {!isRestoring && devices.length > 0 && (
        <Stack gap="sm">
          {devices.map((device) => (
            <DeviceListItem
              key={device.id}
              device={device}
              isConnecting={connectingDeviceId === device.id}
              isOtherConnecting={connectingDeviceId !== null && connectingDeviceId !== device.id}
              onSelect={() => onDeviceSelect(device)}
            />
          ))}
        </Stack>
      )}
      
      {/* Empty state - no devices */}
      {!isRestoring && devices.length === 0 && !isScanning && (
        <View className="py-8 items-center">
          <Ionicons name="bluetooth-outline" size={40} color={colors.text.muted} />
          <Text className="text-content-muted text-sm mt-3 text-center">
            {relayNotReady 
              ? 'Waiting for BLE relay...'
              : 'No Voltras found'
            }
          </Text>
          {!relayNotReady && (
            <Text className="text-content-muted text-xs mt-1">
              Will scan again automatically
            </Text>
          )}
        </View>
      )}
      
      {/* Scanning state */}
      {!isRestoring && devices.length === 0 && isScanning && (
        <LoadingState size="large" message="Looking for Voltras..." />
      )}
    </Card>
  );
}
