/**
 * DeviceListItem
 *
 * Single device row in the device list.
 * Shows device name, ID, and connection state.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListItem, ListItemContent, ListItemTrailing, Surface, getSemanticColors } from '@titan-design/react-ui';
import type { DiscoveredDevice } from '@/domain/device';

const t = getSemanticColors('dark');

export interface DeviceListItemProps {
  /** The device to display */
  device: DiscoveredDevice;
  /** Whether this device is currently being connected to */
  isConnecting: boolean;
  /** Whether another device is being connected to */
  isOtherConnecting: boolean;
  /** Called when the device is selected */
  onSelect: () => void;
}

/**
 * DeviceListItem component - single device in the list.
 *
 * @example
 * ```tsx
 * <DeviceListItem
 *   device={device}
 *   isConnecting={connectingDeviceId === device.id}
 *   isOtherConnecting={connectingDeviceId !== null && connectingDeviceId !== device.id}
 *   onSelect={() => connect(device)}
 * />
 * ```
 */
export function DeviceListItem({
  device,
  isConnecting,
  isOtherConnecting,
  onSelect,
}: DeviceListItemProps) {
  return (
    <Surface
      elevation={0}
      className="rounded-xl bg-surface-input"
      style={{ opacity: isOtherConnecting ? 0.5 : 1 }}
    >
      <ListItem onPress={onSelect} disabled={isOtherConnecting}>
        <View
          className="mr-3 items-center justify-center rounded-xl"
          style={{ width: 48, height: 48, backgroundColor: t['surface-elevated'] }}
        >
          <Ionicons name="hardware-chip-outline" size={24} color={t['brand-primary']} />
        </View>
        <ListItemContent title={device.name || 'Voltra'} subtitle={device.id} />
        <ListItemTrailing>
          {isConnecting ? (
            <ActivityIndicator size="small" color={t['brand-primary']} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={t['text-tertiary']} />
          )}
        </ListItemTrailing>
      </ListItem>
    </Surface>
  );
}
