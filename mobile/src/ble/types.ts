/**
 * BLE Abstraction Layer Types
 * 
 * Defines interfaces for BLE operations that can be implemented by
 * either native BLE (react-native-ble-plx) or a WebSocket proxy relay.
 */

/**
 * Represents a discovered BLE device.
 */
export interface Device {
  /** Device identifier (address on Android, UUID on iOS) */
  id: string;
  /** Device name (e.g., "VTR-212006") */
  name: string | null;
  /** Signal strength in dBm */
  rssi: number | null;
}

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
   */
  connect(deviceId: string): Promise<void>;
  
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

/**
 * Helper to convert hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
