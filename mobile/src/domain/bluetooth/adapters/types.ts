/**
 * BLE Abstraction Layer Types
 * 
 * Defines interfaces for BLE operations that can be implemented by
 * either native BLE (react-native-ble-plx) or a WebSocket proxy relay.
 */

import { DiscoveredDevice } from '@/domain/bluetooth/models/device';

/**
 * Device alias - uses the canonical DiscoveredDevice type from models.
 */
export type Device = DiscoveredDevice;

/**
 * Connection state for the BLE adapter.
 */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting';

/**
 * Callback for receiving BLE notifications.
 */
export type NotificationCallback = (data: Uint8Array) => void;

/**
 * Callback for connection state changes.
 */
export type ConnectionStateCallback = (state: ConnectionState) => void;

/**
 * Abstract interface for BLE operations.
 * 
 * Implemented by:
 * - NativeBLEAdapter: Uses react-native-ble-plx for direct device communication
 * - ProxyBLEAdapter: Uses WebSocket to relay through Python backend (for dev)
 */
/**
 * Options for BLE connection.
 */
export interface ConnectOptions {
  /**
   * Data to write immediately after raw connection, before service discovery.
   * Used for authentication that must happen within a tight time window.
   */
  immediateWrite?: Uint8Array;
}

export interface BLEAdapter {
  /**
   * Scan for Voltra devices.
   * @param timeout Scan duration in seconds
   * @returns List of discovered devices
   */
  scan(timeout: number): Promise<Device[]>;
  
  /**
   * Connect to a device.
   * @param deviceId Device identifier from scan results
   * @param options Optional connection options
   */
  connect(deviceId: string, options?: ConnectOptions): Promise<void>;
  
  /**
   * Disconnect from the current device.
   */
  disconnect(): Promise<void>;
  
  /**
   * Write data to the device's write characteristic.
   * @param data Bytes to write
   */
  write(data: Uint8Array): Promise<void>;
  
  /**
   * Register a callback for notifications from the device.
   * @param callback Function called with notification data
   * @returns Unsubscribe function
   */
  onNotification(callback: NotificationCallback): () => void;
  
  /**
   * Register a callback for connection state changes.
   * @param callback Function called when state changes
   * @returns Unsubscribe function
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void;
  
  /**
   * Get current connection state.
   */
  getConnectionState(): ConnectionState;
  
  /**
   * Check if currently connected to a device.
   */
  isConnected(): boolean;
}

/**
 * Configuration for BLE adapter selection.
 */
export interface BLEConfig {
  /** Use proxy adapter (WebSocket to Python relay) instead of native BLE */
  useProxy: boolean;
  /** Proxy server URL (only used if useProxy is true) */
  proxyUrl?: string;
}
