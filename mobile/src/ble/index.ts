/**
 * BLE Abstraction Layer
 * 
 * Provides a unified interface for BLE communication that can be
 * implemented by either native BLE or a WebSocket proxy.
 */

export * from './types';
export { ProxyBLEAdapter } from './proxy';
export { NativeBLEAdapter } from './native';

import { Platform } from 'react-native';
import { BLEAdapter, BLEConfig } from './types';
import { ProxyBLEAdapter } from './proxy';
import { NativeBLEAdapter } from './native';
import { RELAY_WS_URL } from '@/config';

/**
 * Create a BLE adapter based on configuration.
 */
export function createBLEAdapter(config: BLEConfig): BLEAdapter {
  if (config.useProxy) {
    return new ProxyBLEAdapter({ url: config.proxyUrl ?? RELAY_WS_URL });
  }
  return new NativeBLEAdapter();
}

/**
 * Default configuration - use proxy on web, native BLE on devices.
 */
export const defaultBLEConfig: BLEConfig = {
  useProxy: Platform.OS === 'web',
  proxyUrl: RELAY_WS_URL,
};
