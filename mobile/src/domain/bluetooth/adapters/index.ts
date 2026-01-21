/**
 * BLE Abstraction Layer
 * 
 * Provides a unified interface for BLE communication that can be
 * implemented by either native BLE or a WebSocket proxy.
 */

export * from './types';
export { ProxyBLEAdapter, type ProxyAdapterConfig } from './proxy';
export { NativeBLEAdapter, type NativeAdapterConfig, type BLEServiceConfig } from './native';
export { ReplayBLEAdapter } from './replay';

import { Platform } from 'react-native';
import type { BLEAdapter } from './types';
import { ProxyBLEAdapter } from './proxy';
import { NativeBLEAdapter, type BLEServiceConfig } from './native';
import { RELAY_WS_URL } from '@/config';

/**
 * Full configuration for creating a BLE adapter.
 */
export interface CreateBLEAdapterConfig {
  /** BLE service configuration (UUIDs, device name prefix) */
  ble: BLEServiceConfig;
  /** Use proxy adapter (WebSocket to Python relay) instead of native BLE */
  useProxy?: boolean;
  /** Proxy server URL (only used if useProxy is true) */
  proxyUrl?: string;
}

/**
 * Create a BLE adapter based on configuration.
 * 
 * @param config Adapter configuration including BLE service UUIDs
 * @returns BLEAdapter instance (NativeBLEAdapter or ProxyBLEAdapter)
 */
export function createBLEAdapter(config: CreateBLEAdapterConfig): BLEAdapter {
  const useProxy = config.useProxy ?? Platform.OS === 'web';
  
  if (useProxy) {
    return new ProxyBLEAdapter({ url: config.proxyUrl ?? RELAY_WS_URL });
  }
  return new NativeBLEAdapter({ ble: config.ble });
}
