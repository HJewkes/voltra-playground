/**
 * Voltra Connection Controller
 *
 * Manages Voltra device connection lifecycle including authentication and initialization.
 */

import type { BLEAdapter, NotificationCallback } from '@/domain/bluetooth/adapters';
import { Auth, Init, Timing } from '@/domain/voltra/protocol';
import { delay } from '@/domain/shared';
import { type DiscoveredDevice } from '@/domain/bluetooth/models/device';
import {
  type VoltraConnectionState,
  VoltraConnectionStateModel,
} from '@/domain/voltra/models/connection';

/**
 * Connection event types.
 */
export type VoltraConnectionEvent =
  | { type: 'stateChanged'; state: VoltraConnectionState }
  | { type: 'connected'; deviceId: string }
  | { type: 'disconnected'; deviceId: string }
  | { type: 'error'; error: string };

/**
 * Connection event listener.
 */
export type VoltraConnectionEventListener = (event: VoltraConnectionEvent) => void;

/**
 * Connection result with adapter reference.
 */
export interface VoltraConnectionResult {
  deviceId: string;
  adapter: BLEAdapter;
  connectionState: VoltraConnectionStateModel;
}

/**
 * Controller for Voltra device connection lifecycle.
 * Handles BLE connection, authentication, and initialization.
 */
export class VoltraConnectionController {
  private _connectionState: VoltraConnectionStateModel;
  private _connectedDeviceId: string | null = null;
  private _error: string | null = null;
  private _isReconnecting = false;
  private _listeners: Set<VoltraConnectionEventListener> = new Set();

  constructor(private adapter: BLEAdapter) {
    this._connectionState = new VoltraConnectionStateModel();
  }

  /**
   * Get current connection state.
   */
  get state(): VoltraConnectionState {
    return this._connectionState.state;
  }

  /**
   * Get connected device ID.
   */
  get connectedDeviceId(): string | null {
    return this._connectedDeviceId;
  }

  /**
   * Get current error.
   */
  get error(): string | null {
    return this._error;
  }

  /**
   * Check if connected.
   */
  get isConnected(): boolean {
    return this._connectionState.isConnected;
  }

  /**
   * Check if reconnecting.
   */
  get isReconnecting(): boolean {
    return this._isReconnecting;
  }

  /**
   * Subscribe to connection events.
   */
  subscribe(listener: VoltraConnectionEventListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private emit(event: VoltraConnectionEvent): void {
    this._listeners.forEach((listener) => listener(event));
  }

  private setState(state: VoltraConnectionState): void {
    this._connectionState.forceState(state);
    this.emit({ type: 'stateChanged', state });
  }

  /**
   * Connect to a Voltra device with authentication and initialization.
   */
  async connect(device: DiscoveredDevice): Promise<VoltraConnectionResult> {
    if (this._connectionState.isConnected) {
      throw new Error('Already connected to a device');
    }

    this._error = null;
    this.setState('connecting');

    try {
      // Connect adapter
      await this.adapter.connect(device.id);

      this.setState('authenticating');

      // Authenticate
      await this.adapter.write(Auth.DEVICE_ID);
      await delay(Timing.AUTH_TIMEOUT_MS);

      // Send init sequence
      for (const cmd of Init.SEQUENCE) {
        await this.adapter.write(cmd);
        await delay(Timing.INIT_COMMAND_DELAY_MS);
      }

      // Mark as connected
      this._connectedDeviceId = device.id;
      this.setState('connected');

      this.emit({ type: 'connected', deviceId: device.id });

      return {
        deviceId: device.id,
        adapter: this.adapter,
        connectionState: this._connectionState,
      };
    } catch (e: unknown) {
      this.setState('disconnected');
      this._connectedDeviceId = null;

      // Categorize error
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.includes('WebSocket') || errorMsg.includes('relay')) {
        this._error = 'Cannot connect to BLE relay. Run "make relay" in terminal.';
      } else if (errorMsg.includes('timeout')) {
        this._error = 'Connection timed out. Ensure Voltra is powered on.';
      } else {
        this._error = `Connection failed: ${errorMsg}`;
      }

      this.emit({ type: 'error', error: this._error });
      throw new Error(this._error);
    }
  }

  /**
   * Disconnect from current device.
   */
  async disconnect(): Promise<void> {
    if (!this._connectedDeviceId) {
      return;
    }

    const deviceId = this._connectedDeviceId;

    try {
      await this.adapter.disconnect();
    } catch (e: unknown) {
      console.warn('[VoltraConnectionController] Disconnect error:', e);
    }

    this._connectedDeviceId = null;
    this.setState('disconnected');

    this.emit({ type: 'disconnected', deviceId });
  }

  /**
   * Attempt to reconnect to a device.
   */
  async reconnect(device: DiscoveredDevice): Promise<VoltraConnectionResult | null> {
    if (this._isReconnecting) {
      return null;
    }

    this._isReconnecting = true;

    try {
      const result = await this.connect(device);
      return result;
    } catch (e) {
      console.warn('[VoltraConnectionController] Reconnect failed:', e);
      return null;
    } finally {
      this._isReconnecting = false;
    }
  }

  /**
   * Register notification callback.
   */
  onNotification(callback: NotificationCallback): () => void {
    return this.adapter.onNotification(callback);
  }

  /**
   * Clear error state.
   */
  clearError(): void {
    this._error = null;
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this._listeners.clear();
    if (this._connectedDeviceId) {
      this.disconnect().catch(() => {});
    }
  }
}
