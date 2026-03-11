/**
 * DeviceConnectionCard
 *
 * Full card variant for DeviceConnection.
 * Shows scan button, BLE warning, device list, connected state, and errors.
 * Shared by both card and guard variants.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  CardContent,
  VStack,
  Surface,
  ListItem,
  ListItemContent,
  ListItemTrailing,
  getSemanticColors,
  alpha,
} from '@titan-design/react-ui';
import { ScanButton } from './ScanButton';
import { BLEWarning } from './BLEWarning';
import { DeviceListItem } from './DeviceListItem';
import type { DiscoveredDevice } from '@/domain/device';

const t = getSemanticColors('dark');

export interface ConnectionCardProps {
  isConnected: boolean;
  connectedDevices: { id: string; name: string }[];
  discoveredDevices: DiscoveredDevice[];
  isScanning: boolean;
  connectingDeviceId: string | null;
  bleSupported: boolean;
  warningMessage: string | null;
  environment: string;
  requiresUserGesture: boolean;
  hasScanned: boolean;
  subtitle: string;
  error: string | null;
  onScan: () => void;
  onConnect: (device: DiscoveredDevice) => void;
  onDisconnect: () => void;
  onDismissError: () => void;
}

export function ConnectionCard({
  isConnected,
  connectedDevices,
  discoveredDevices,
  isScanning,
  connectingDeviceId,
  bleSupported,
  warningMessage,
  environment,
  requiresUserGesture,
  hasScanned,
  subtitle,
  error,
  onScan,
  onConnect,
  onDisconnect,
  onDismissError,
}: ConnectionCardProps) {
  const scanDisabled = isScanning || !bleSupported || connectingDeviceId !== null;

  return (
    <Card elevation={1} style={{ maxWidth: 400, width: '100%' }}>
      <CardContent className="p-6">
        {/* Header with scan button */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="bluetooth-outline" size={24} color={t['text-disabled']} />
            <Text accessibilityRole="header" className="ml-3 text-lg font-bold text-text-primary">Voltras</Text>
          </View>
          {bleSupported && (
            <ScanButton
              isScanning={isScanning || connectingDeviceId !== null}
              disabled={scanDisabled}
              onPress={onScan}
              label={requiresUserGesture
                ? connectedDevices.length > 0 ? 'Add Another' : 'Connect'
                : 'Scan'}
              scanningLabel={connectingDeviceId ? 'Connecting' : 'Scanning'}
            />
          )}
        </View>

        {/* BLE Warning */}
        {warningMessage && <BLEWarning environment={environment} message={warningMessage} />}

        {/* Subtitle when disconnected */}
        {bleSupported && !isConnected && (
          <Text className="mb-4 text-sm text-text-tertiary">{subtitle}</Text>
        )}

        {/* Connected devices */}
        {connectedDevices.length > 0 && (
          <ConnectedSection devices={connectedDevices} onDisconnect={onDisconnect} />
        )}

        {/* Discovered devices (native only, web auto-connects) */}
        {!requiresUserGesture && discoveredDevices.length > 0 && (
          <DiscoveredSection
            connectedDevices={connectedDevices}
            discoveredDevices={discoveredDevices}
            connectingDeviceId={connectingDeviceId}
            onConnect={onConnect}
          />
        )}

        {/* Scanning state (native) */}
        {!requiresUserGesture && discoveredDevices.length === 0 && isScanning && (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color={t['brand-primary']} />
            <Text className="mt-3 text-text-secondary">Looking for Voltras...</Text>
          </View>
        )}

        <EmptyStates
          connectedDevices={connectedDevices}
          discoveredDevices={discoveredDevices}
          isScanning={isScanning}
          connectingDeviceId={connectingDeviceId}
          requiresUserGesture={requiresUserGesture}
          hasScanned={hasScanned}
        />

        {/* Error */}
        {error && (
          <View
            className="mt-2 flex-row items-center rounded-xl p-3"
            style={{ backgroundColor: alpha(t['status-error'], 0.08) }}
          >
            <Ionicons name="alert-circle" size={18} color={t['status-error']} />
            <Text className="ml-2 flex-1 text-xs" style={{ color: t['status-error'] }}>{error}</Text>
            <TouchableOpacity onPress={onDismissError} accessibilityRole="button" accessibilityLabel="Dismiss error">
              <Ionicons name="close" size={16} color={t['text-disabled']} />
            </TouchableOpacity>
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectedSection({ devices, onDisconnect }: { devices: { id: string; name: string }[]; onDisconnect: () => void }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-text-disabled">Connected</Text>
      <VStack gap={1}>
        {devices.map((device) => (
          <Surface key={device.id} elevation={0} className="rounded-xl bg-surface-input">
            <ListItem>
              <View
                className="mr-3 items-center justify-center rounded-xl"
                style={{ width: 48, height: 48, backgroundColor: alpha(t['status-success'], 0.12) }}
              >
                <Ionicons name="checkmark-circle" size={24} color={t['status-success']} />
              </View>
              <ListItemContent title={device.name} subtitle="Connected" />
              <ListItemTrailing>
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: t['status-success'] }} />
              </ListItemTrailing>
            </ListItem>
          </Surface>
        ))}
      </VStack>
      <TouchableOpacity
        onPress={onDisconnect}
        className="mt-3 rounded-xl py-3"
        style={{ backgroundColor: t['background-subtle'] }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Disconnect all devices"
      >
        <Text className="text-center font-semibold text-text-secondary">Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

function DiscoveredSection({ connectedDevices, discoveredDevices, connectingDeviceId, onConnect }: {
  connectedDevices: { id: string; name: string }[];
  discoveredDevices: DiscoveredDevice[];
  connectingDeviceId: string | null;
  onConnect: (device: DiscoveredDevice) => void;
}) {
  return (
    <View>
      {connectedDevices.length > 0 && (
        <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-text-disabled">Available</Text>
      )}
      <VStack gap={1}>
        {discoveredDevices.map((device) => {
          if (connectedDevices.some((d) => d.id === device.id)) return null;
          return (
            <DeviceListItem
              key={device.id}
              device={device}
              isConnecting={connectingDeviceId === device.id}
              isOtherConnecting={connectingDeviceId !== null && connectingDeviceId !== device.id}
              onSelect={() => onConnect(device)}
            />
          );
        })}
      </VStack>
    </View>
  );
}

function EmptyStates({ connectedDevices, discoveredDevices, isScanning, connectingDeviceId, requiresUserGesture, hasScanned }: {
  connectedDevices: { id: string; name: string }[];
  discoveredDevices: DiscoveredDevice[];
  isScanning: boolean;
  connectingDeviceId: string | null;
  requiresUserGesture: boolean;
  hasScanned: boolean;
}) {
  // No devices found (native)
  if (!requiresUserGesture && connectedDevices.length === 0 && discoveredDevices.length === 0 && !isScanning && hasScanned) {
    return (
      <View className="items-center py-6">
        <Ionicons name="bluetooth-outline" size={36} color={t['text-disabled']} />
        <Text className="mt-3 text-center text-sm text-text-disabled">No Voltras found</Text>
        <Text className="mt-1 text-xs text-text-disabled">Will scan again automatically</Text>
      </View>
    );
  }

  // Initial state — waiting
  if (connectedDevices.length === 0 && !isScanning && !connectingDeviceId && !hasScanned) {
    return (
      <View className="items-center py-6">
        <Ionicons name="bluetooth-outline" size={36} color={t['text-disabled']} />
        <Text className="mt-3 text-sm text-text-disabled">
          {requiresUserGesture ? 'Click Connect to pair your Voltra' : 'Waiting to scan...'}
        </Text>
      </View>
    );
  }

  // Web: hint to add more
  if (requiresUserGesture && connectedDevices.length > 0 && !connectingDeviceId) {
    return (
      <View className="items-center py-4">
        <Text className="text-xs text-text-disabled">Click "Add Another" to connect additional devices</Text>
      </View>
    );
  }

  return null;
}
