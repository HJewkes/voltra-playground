/**
 * Proxy BLE Adapter
 * 
 * Connects to a Python BLE relay service via WebSocket.
 * Used for development when testing on Mac without a real device.
 * 
 * The relay maintains BLE connections independently, so browser
 * refreshes won't disconnect from the Voltra device.
 * 
 * Mirrors the auto-reconnect behavior of the native adapter for
 * consistent development/testing experience.
 */

import type {
  BLEAdapter,
  Device,
  ConnectionState,
  NotificationCallback,
  ConnectionStateCallback,
  ConnectOptions,
} from './types';
import { bytesToHex, hexToBytes } from '@/domain/shared/utils';
import { RELAY_WS_URL } from '@/config';

interface ProxyMessage {
  type: 'status' | 'connected' | 'disconnected' | 'notification' | 'error';
  data?: any;
  error?: string;
  connected?: boolean;
  device?: { id: string; name: string };
  unexpected?: boolean;
}

/**
 * Configuration for proxy adapter behavior.
 */
export interface ProxyAdapterConfig {
  /** WebSocket URL for the relay */
  url: string;
  /** Enable auto-reconnect when tab becomes visible */
  autoReconnect: boolean;
  /** Max attempts for auto-reconnect */
  maxReconnectAttempts: number;
  /** Delay between reconnect attempts (ms) */
  reconnectDelayMs: number;
}

const DEFAULT_CONFIG: ProxyAdapterConfig = {
  url: RELAY_WS_URL,
  autoReconnect: true,
  maxReconnectAttempts: 3,
  reconnectDelayMs: 1000,
};

/**
 * BLE adapter that proxies commands through a WebSocket to a Python relay.
 * 
 * The relay maintains the BLE connection independently, allowing browser
 * refreshes without losing the device connection.
 * 
 * Supports the same auto-reconnect patterns as NativeBLEAdapter for
 * consistent behavior during development.
 */
export class ProxyBLEAdapter implements BLEAdapter {
  private ws: WebSocket | null = null;
  private config: ProxyAdapterConfig;
  private connectionState: ConnectionState = 'disconnected';
  private connectedDevice: Device | null = null;
  private notificationCallbacks: NotificationCallback[] = [];
  private stateCallbacks: ConnectionStateCallback[] = [];
  private pendingResolves: Map<string, (value: any) => void> = new Map();
  private pendingRejects: Map<string, (error: Error) => void> = new Map();
  private messageId = 0;
  private statusResolve: ((value: void) => void) | null = null;
  
  // Auto-reconnect state (mirrors NativeBLEAdapter)
  private lastConnectedDeviceId: string | null = null;
  private lastConnectedDeviceName: string | null = null;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private visibilityHandler: (() => void) | null = null;
  
  // Callbacks for reconnect events
  private onReconnectStart?: () => void;
  private onReconnectSuccess?: () => void;
  private onReconnectFailed?: (error: Error) => void;
  
  constructor(config: Partial<ProxyAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Set up visibility change listener for auto-reconnect
    if (this.config.autoReconnect && typeof document !== 'undefined') {
      this.setupVisibilityListener();
    }
  }
  
  /**
   * Set up listener for tab visibility changes (browser equivalent of AppState).
   */
  private setupVisibilityListener(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.handleBecameVisible();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }
  
  /**
   * Handle tab becoming visible - check connection and reconnect if needed.
   */
  private async handleBecameVisible(): Promise<void> {
    console.log('[ProxyBLE] Tab became visible');
    
    // If WebSocket is closed, we need to reconnect to relay first
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      try {
        await this.ensureConnected();
      } catch (e) {
        console.warn('[ProxyBLE] Could not reconnect to relay:', e);
        return;
      }
    }
    
    // Check if we were connected to a device but lost connection
    if (
      this.lastConnectedDeviceId &&
      this.connectionState === 'disconnected' &&
      !this.isReconnecting
    ) {
      console.log('[ProxyBLE] Was connected before, checking relay status...');
      // The relay may still have the connection - syncStatus will restore it
      // If not, we could attempt reconnect
    }
  }
  
  /**
   * Attempt to reconnect to the last known device.
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.lastConnectedDeviceId || this.isReconnecting) {
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts = 0;
    this.onReconnectStart?.();
    
    while (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[ProxyBLE] Reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      
      try {
        await this.connect(this.lastConnectedDeviceId);
        console.log('[ProxyBLE] Reconnect successful');
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.onReconnectSuccess?.();
        return;
      } catch (error) {
        console.warn(`[ProxyBLE] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
        
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelayMs));
        }
      }
    }
    
    // All attempts failed
    console.error('[ProxyBLE] Auto-reconnect failed after all attempts');
    this.isReconnecting = false;
    this.onReconnectFailed?.(new Error('Auto-reconnect failed'));
  }
  
  /**
   * Connect to the WebSocket relay and restore any existing BLE connection state.
   */
  private async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        
        // We'll resolve after receiving the initial status message
        this.statusResolve = resolve;
        
        this.ws.onopen = () => {
          console.log('[ProxyBLE] WebSocket connected to relay');
          // Don't resolve yet - wait for status message
        };
        
        this.ws.onerror = (error) => {
          console.error('[ProxyBLE] WebSocket error:', error);
          this.statusResolve = null;
          reject(new Error('Failed to connect to BLE relay'));
        };
        
        this.ws.onclose = () => {
          console.log('[ProxyBLE] WebSocket closed');
          // Don't change BLE connection state - relay maintains it
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        // Timeout if we don't get status
        setTimeout(() => {
          if (this.statusResolve) {
            this.statusResolve = null;
            reject(new Error('Timeout waiting for relay status'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private handleMessage(data: string): void {
    try {
      const msg: ProxyMessage & { id?: string } = JSON.parse(data);
      
      // Handle response to a pending request
      if (msg.id && this.pendingResolves.has(msg.id)) {
        const resolve = this.pendingResolves.get(msg.id)!;
        const reject = this.pendingRejects.get(msg.id)!;
        this.pendingResolves.delete(msg.id);
        this.pendingRejects.delete(msg.id);
        
        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.data);
        }
        return;
      }
      
      // Handle async messages
      switch (msg.type) {
        case 'status':
          // Initial status from relay - restore connection state
          console.log('[ProxyBLE] Relay status:', msg.connected ? `connected to ${msg.device?.name}` : 'not connected');
          
          if (msg.connected && msg.device) {
            this.connectedDevice = {
              id: msg.device.id,
              name: msg.device.name,
              rssi: null,
            };
            this.lastConnectedDeviceId = msg.device.id;
            this.lastConnectedDeviceName = msg.device.name;
            this.setConnectionState('connected');
          } else {
            this.connectedDevice = null;
            this.setConnectionState('disconnected');
          }
          
          // Resolve the ensureConnected promise
          if (this.statusResolve) {
            this.statusResolve();
            this.statusResolve = null;
          }
          break;
          
        case 'notification':
          // Convert hex string to Uint8Array and notify callbacks
          const bytes = hexToBytes(msg.data);
          for (const callback of this.notificationCallbacks) {
            try {
              callback(bytes);
            } catch (e) {
              console.error('[ProxyBLE] Notification callback error:', e);
            }
          }
          break;
          
        case 'connected':
          if (msg.device) {
            this.connectedDevice = {
              id: msg.device.id,
              name: msg.device.name,
              rssi: null,
            };
            this.lastConnectedDeviceId = msg.device.id;
            this.lastConnectedDeviceName = msg.device.name;
          }
          this.setConnectionState('connected');
          break;
          
        case 'disconnected':
          this.connectedDevice = null;
          this.setConnectionState('disconnected');
          if (msg.unexpected) {
            console.warn('[ProxyBLE] Device disconnected unexpectedly');
            // Don't clear lastConnectedDevice - we want to try reconnecting
          }
          break;
          
        case 'error':
          console.error('[ProxyBLE] Relay error:', msg.error);
          break;
      }
    } catch (e) {
      console.error('[ProxyBLE] Failed to parse message:', e);
    }
  }
  
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      for (const callback of this.stateCallbacks) {
        try {
          callback(state);
        } catch (e) {
          console.error('[ProxyBLE] State callback error:', e);
        }
      }
    }
  }
  
  private async sendRequest<T>(action: string, payload?: any): Promise<T> {
    await this.ensureConnected();
    
    const id = String(++this.messageId);
    
    return new Promise((resolve, reject) => {
      this.pendingResolves.set(id, resolve);
      this.pendingRejects.set(id, reject);
      
      const msg = JSON.stringify({ id, action, ...payload });
      this.ws!.send(msg);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingResolves.has(id)) {
          this.pendingResolves.delete(id);
          this.pendingRejects.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }
  
  async scan(timeout: number): Promise<Device[]> {
    const devices = await this.sendRequest<Device[]>('scan', { timeout });
    return devices;
  }
  
  async connect(deviceId: string, options?: ConnectOptions): Promise<void> {
    this.setConnectionState('connecting');
    try {
      const result = await this.sendRequest<{ status: string; device: { id: string; name: string } }>(
        'connect', 
        { device_id: deviceId }
      );
      if (result.device) {
        this.connectedDevice = {
          id: result.device.id,
          name: result.device.name,
          rssi: null,
        };
        this.lastConnectedDeviceId = result.device.id;
        this.lastConnectedDeviceName = result.device.name;
      }
      
      // Handle immediate write if provided (for auth)
      if (options?.immediateWrite) {
        await this.write(options.immediateWrite);
      }
      
      this.setConnectionState('connected');
    } catch (error) {
      this.setConnectionState('disconnected');
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    this.setConnectionState('disconnecting');
    try {
      await this.sendRequest('disconnect');
    } finally {
      this.connectedDevice = null;
      // Clear last device so we don't auto-reconnect after intentional disconnect
      this.lastConnectedDeviceId = null;
      this.lastConnectedDeviceName = null;
      this.setConnectionState('disconnected');
    }
  }
  
  async write(data: Uint8Array): Promise<void> {
    const hex = bytesToHex(data);
    await this.sendRequest('write', { data: hex });
  }
  
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index >= 0) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }
  
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index >= 0) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }
  
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
  
  /**
   * Get the currently connected device, if any.
   */
  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }
  
  /**
   * Get the last connected device ID (for reconnection).
   */
  getLastConnectedDeviceId(): string | null {
    return this.lastConnectedDeviceId;
  }
  
  /**
   * Set callbacks for reconnect events.
   */
  setReconnectCallbacks(callbacks: {
    onStart?: () => void;
    onSuccess?: () => void;
    onFailed?: (error: Error) => void;
  }): void {
    this.onReconnectStart = callbacks.onStart;
    this.onReconnectSuccess = callbacks.onSuccess;
    this.onReconnectFailed = callbacks.onFailed;
  }
  
  /**
   * Manually trigger a reconnect attempt.
   */
  async reconnect(): Promise<void> {
    if (this.lastConnectedDeviceId) {
      await this.connect(this.lastConnectedDeviceId);
    } else {
      throw new Error('No previous device to reconnect to');
    }
  }
  
  /**
   * Set the last connected device (for restoring from storage).
   */
  setLastConnectedDevice(deviceId: string, deviceName?: string): void {
    this.lastConnectedDeviceId = deviceId;
    this.lastConnectedDeviceName = deviceName ?? null;
  }
  
  /**
   * Check if auto-reconnect is in progress.
   */
  isAutoReconnecting(): boolean {
    return this.isReconnecting;
  }
  
  /**
   * Check relay status and sync connection state.
   * Useful after browser refresh to restore state.
   */
  async syncStatus(): Promise<{ connected: boolean; device: Device | null }> {
    await this.ensureConnected();
    return {
      connected: this.isConnected(),
      device: this.connectedDevice,
    };
  }
  
  /**
   * Close the WebSocket connection to the relay.
   * Note: This does NOT disconnect the BLE device - the relay maintains that.
   */
  close(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  /**
   * Destroy the adapter (mirrors NativeBLEAdapter interface).
   */
  destroy(): void {
    this.close();
  }
}
