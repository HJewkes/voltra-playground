/**
 * DeviceListItem
 * 
 * Single device row in the device list.
 * Shows device name, ID, and connection state.
 */

import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Surface, ListItem } from '@/components/ui';
import { colors } from '@/theme';
import type { Device } from '@/domain/bluetooth/adapters';

export interface DeviceListItemProps {
  /** The device to display */
  device: Device;
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
      elevation="inset"
      radius="lg"
      border={false}
      style={{ opacity: isOtherConnecting ? 0.5 : 1 }}
    >
      <ListItem
        icon="hardware-chip-outline"
        iconColor={colors.primary[500]}
        iconBgColor={colors.surface.card}
        title={device.name || 'Voltra'}
        subtitle={device.id}
        onPress={onSelect}
        disabled={isOtherConnecting}
        trailing={
          isConnecting ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          )
        }
      />
    </Surface>
  );
}
