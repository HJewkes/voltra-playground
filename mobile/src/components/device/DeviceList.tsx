/**
 * DeviceList
 *
 * Device list with scan button and various states (scanning, empty, devices).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, VStack, Spinner, getSemanticColors } from '@titan-design/react-ui';
import { BLEWarning } from './BLEWarning';
import { ScanButton } from './ScanButton';
import { DeviceListItem } from './DeviceListItem';
import type { DiscoveredDevice } from '@/domain/device';

const t = getSemanticColors('dark');

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
    <Card elevation={1} className="mb-4">
      <CardContent className="p-6">
        {/* Header with scan button */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-text-primary">Voltras</Text>
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
        {isRestoring && (
          <View className="items-center py-6">
            <Spinner size="lg" />
            <Text className="mt-3 text-text-secondary">Restoring connection...</Text>
          </View>
        )}

        {/* Device List */}
        {!isRestoring && devices.length > 0 && (
          <VStack gap={2}>
            {devices.map((device) => (
              <DeviceListItem
                key={device.id}
                device={device}
                isConnecting={connectingDeviceId === device.id}
                isOtherConnecting={connectingDeviceId !== null && connectingDeviceId !== device.id}
                onSelect={() => onDeviceSelect(device)}
              />
            ))}
          </VStack>
        )}

        {/* Empty state - no devices */}
        {!isRestoring && devices.length === 0 && !isScanning && (
          <View className="items-center py-8">
            <Ionicons name="bluetooth-outline" size={40} color={t['text-disabled']} />
            <Text className="mt-3 text-center text-sm text-text-disabled">
              {requiresUserGesture ? 'Click to connect a device' : 'No Voltras found'}
            </Text>
            <Text className="mt-1 text-xs text-text-disabled">
              {requiresUserGesture ? 'Use the Scan button above' : 'Will scan again automatically'}
            </Text>
          </View>
        )}

        {/* Scanning state */}
        {!isRestoring && devices.length === 0 && isScanning && (
          <View className="items-center py-6">
            <Spinner size="lg" />
            <Text className="mt-3 text-text-secondary">Looking for Voltras...</Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
