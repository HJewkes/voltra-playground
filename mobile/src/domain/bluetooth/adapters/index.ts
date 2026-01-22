/**
 * BLE Abstraction Layer
 *
 * Provides a unified interface for BLE communication across platforms:
 * - Native (iOS/Android): react-native-ble-plx
 * - Browser: Web Bluetooth API
 * - Node.js: webbluetooth npm package
 */

import { Platform } from 'react-native';
import type { BLEAdapter } from './types';
import { NativeBLEAdapter, type BLEServiceConfig } from './native';
import { WebBLEAdapter } from './web';
import { NodeBLEAdapter } from './node';

export * from './types';
export { BaseBLEAdapter } from './base';
export { WebBluetoothBase, type WebBluetoothConfig } from './web-bluetooth-base';
export { WebBLEAdapter } from './web';
export { NodeBLEAdapter, type NodeBLEConfig, type DeviceChooser } from './node';
export { NativeBLEAdapter, type NativeAdapterConfig } from './native';
export { ReplayBLEAdapter } from './replay';

/**
 * Full configuration for creating a BLE adapter.
 */
export interface CreateBLEAdapterConfig {
  /** BLE service configuration (UUIDs, device name prefix) */
  ble: BLEServiceConfig;
}

/**
 * Detect if running in Node.js environment.
 */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Create a BLE adapter based on the current environment.
 *
 * Environment detection:
 * - Web browser: WebBLEAdapter (Web Bluetooth API)
 * - Node.js: NodeBLEAdapter (webbluetooth package)
 * - Native (iOS/Android): NativeBLEAdapter (react-native-ble-plx)
 *
 * @param config Adapter configuration including BLE service UUIDs
 * @returns BLEAdapter instance appropriate for the current environment
 */
export function createBLEAdapter(config: CreateBLEAdapterConfig): BLEAdapter {
  // Environment detection
  if (Platform.OS === 'web') {
    // Check if Node.js or browser
    if (isNodeEnvironment()) {
      return new NodeBLEAdapter({ ble: config.ble });
    }
    return new WebBLEAdapter({ ble: config.ble });
  }

  // Native (iOS/Android)
  return new NativeBLEAdapter({ ble: config.ble });
}
