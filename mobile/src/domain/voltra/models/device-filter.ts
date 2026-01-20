/**
 * Voltra Device Filter
 * 
 * Utilities for identifying and filtering Voltra devices from BLE scan results.
 */

import type { DiscoveredDevice } from '@/domain/bluetooth/models/device';

/**
 * Device name prefix for Voltra devices.
 */
export const VOLTRA_DEVICE_PREFIX = 'VTR-';

/**
 * Check if a device is a Voltra device based on name.
 */
export function isVoltraDevice(device: DiscoveredDevice): boolean {
  return device.name?.startsWith(VOLTRA_DEVICE_PREFIX) ?? false;
}

/**
 * Filter to only Voltra devices.
 */
export function filterVoltraDevices(devices: DiscoveredDevice[]): DiscoveredDevice[] {
  return devices.filter(isVoltraDevice);
}
