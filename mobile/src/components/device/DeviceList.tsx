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
import type { DiscoveredDevice } from '@/domain/device';

export interface DeviceListProps {
  /** List of discovered devices */
  devices: DiscoveredDevice[];
  /** Whether currently scanning */
  isScanning: boolean;
  /** Whether restoring a previous connection */
  isRestoring: boolean;
  /** ID of device currently being connected to */
  connectingDeviceId: string | null;
  /** Whether BLE is supported */
  bleSupported: boolean;
  /** Environment type for warning */
  environment: string;
  /** Warning message about BLE environment */
  warningMessage: string | null;
  /** Whether user gesture is required (web) */
  requiresUserGesture?: boolean;
  /** Called when scan button is pressed */
  onScan: () => void;
  /** Called when a device is selected */
  onDeviceSelect: (device: DiscoveredDevice) => void;
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
  environment,
  warningMessage,
  requiresUserGesture = false,
  onScan,
  onDeviceSelect,
}: DeviceListProps) {
  const scanDisabled = isScanning || !bleSupported;

  return (
    <Card elevation={1} padding="lg">
      {/* Header with scan button */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-content-primary">Voltras</Text>
        {bleSupported && (
          <ScanButton
            isScanning={isScanning}
            disabled={scanDisabled}
            onPress={onScan}
            label={requiresUserGesture ? 'Connect' : 'Scan'}
            scanningLabel={requiresUserGesture ? 'Connecting' : 'Scanning'}
          />
        )}
      </View>

      {/* BLE Environment Warning */}
      {warningMessage && <BLEWarning environment={environment} message={warningMessage} />}

      {/* Restoring state */}
      {isRestoring && <LoadingState message="Restoring connection..." />}

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
        <View className="items-center py-8">
          <Ionicons name="bluetooth-outline" size={40} color={colors.text.muted} />
          <Text className="mt-3 text-center text-sm text-content-muted">
            {requiresUserGesture ? 'Click to connect a device' : 'No Voltras found'}
          </Text>
          <Text className="mt-1 text-xs text-content-muted">
            {requiresUserGesture ? 'Use the Scan button above' : 'Will scan again automatically'}
          </Text>
        </View>
      )}

      {/* Scanning state */}
      {!isRestoring && devices.length === 0 && isScanning && (
        <LoadingState size="large" message="Looking for Voltras..." />
      )}
    </Card>
  );
}
