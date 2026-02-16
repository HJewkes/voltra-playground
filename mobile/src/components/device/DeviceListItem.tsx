/**
 * DeviceListItem
 *
 * Single device row in the device list.
 * Shows device name, ID, and connection state.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListItem, ListItemContent, ListItemTrailing, Surface } from '@titan-design/react-ui';
import { colors } from '@/theme';
import type { DiscoveredDevice } from '@/domain/device';

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
          style={{ width: 48, height: 48, backgroundColor: colors.surface.card }}
        >
          <Ionicons name="hardware-chip-outline" size={24} color={colors.primary[500]} />
        </View>
        <ListItemContent title={device.name || 'Voltra'} subtitle={device.id} />
        <ListItemTrailing>
          {isConnecting ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          )}
        </ListItemTrailing>
      </ListItem>
    </Surface>
  );
}
