/**
 * BaseBLEAdapter Tests
 *
 * Tests for the abstract BaseBLEAdapter class.
 * Uses a concrete test implementation to verify shared functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseBLEAdapter } from '../base';
import type { Device, ConnectOptions, ConnectionState } from '../types';

// =============================================================================
// Test Implementation
// =============================================================================

/**
 * Concrete implementation of BaseBLEAdapter for testing.
 */
class TestBLEAdapter extends BaseBLEAdapter {
  // Track method calls for testing
  public scanCalled = false;
  public connectCalled = false;
  public disconnectCalled = false;
  public writeCalled = false;
  public lastWriteData: Uint8Array | null = null;

  async scan(_timeout: number): Promise<Device[]> {
    this.scanCalled = true;
    return [{ id: 'test-device', name: 'Test Device', rssi: -50 }];
  }

  async connect(_deviceId: string, _options?: ConnectOptions): Promise<void> {
    this.connectCalled = true;
    this.setConnectionState('connecting');
    this.setConnectionState('connected');
  }

  async disconnect(): Promise<void> {
    this.disconnectCalled = true;
    this.setConnectionState('disconnecting');
    this.setConnectionState('disconnected');
  }

  async write(data: Uint8Array): Promise<void> {
    this.writeCalled = true;
    this.lastWriteData = data;
  }

  // Expose protected methods for testing
  public testSetConnectionState(state: ConnectionState): void {
    this.setConnectionState(state);
  }

  public testEmitNotification(data: Uint8Array): void {
    this.emitNotification(data);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('BaseBLEAdapter', () => {
  let adapter: TestBLEAdapter;

  beforeEach(() => {
    adapter = new TestBLEAdapter();
  });

  describe('initial state', () => {
    it('starts with disconnected state', () => {
      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('isConnected() returns false initially', () => {
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('connection state management', () => {
    it('setConnectionState updates state', () => {
      adapter.testSetConnectionState('connecting');
      expect(adapter.getConnectionState()).toBe('connecting');
    });

    it('isConnected() returns true when connected', () => {
      adapter.testSetConnectionState('connected');
      expect(adapter.isConnected()).toBe(true);
    });

    it('isConnected() returns false for other states', () => {
      adapter.testSetConnectionState('connecting');
      expect(adapter.isConnected()).toBe(false);

      adapter.testSetConnectionState('disconnecting');
      expect(adapter.isConnected()).toBe(false);

      adapter.testSetConnectionState('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('notifies callbacks on state change', () => {
      const callback = vi.fn();
      adapter.onConnectionStateChange(callback);

      adapter.testSetConnectionState('connecting');

      expect(callback).toHaveBeenCalledWith('connecting');
    });

    it('does not notify if state is unchanged', () => {
      adapter.testSetConnectionState('disconnected'); // Already disconnected
      
      const callback = vi.fn();
      adapter.onConnectionStateChange(callback);

      adapter.testSetConnectionState('disconnected');

      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple state callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      adapter.onConnectionStateChange(callback1);
      adapter.onConnectionStateChange(callback2);

      adapter.testSetConnectionState('connected');

      expect(callback1).toHaveBeenCalledWith('connected');
      expect(callback2).toHaveBeenCalledWith('connected');
    });
  });

  describe('notification callbacks', () => {
    it('emitNotification calls registered callback', () => {
      const callback = vi.fn();
      adapter.onNotification(callback);

      const data = new Uint8Array([1, 2, 3]);
      adapter.testEmitNotification(data);

      expect(callback).toHaveBeenCalledWith(data);
    });

    it('supports multiple notification callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      adapter.onNotification(callback1);
      adapter.onNotification(callback2);

      const data = new Uint8Array([1, 2, 3]);
      adapter.testEmitNotification(data);

      expect(callback1).toHaveBeenCalledWith(data);
      expect(callback2).toHaveBeenCalledWith(data);
    });

    it('does not fail when no callbacks registered', () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(() => adapter.testEmitNotification(data)).not.toThrow();
    });
  });

  describe('callback unsubscription', () => {
    it('state callback unsubscribe removes callback', () => {
      const callback = vi.fn();
      const unsubscribe = adapter.onConnectionStateChange(callback);

      unsubscribe();
      adapter.testSetConnectionState('connected');

      expect(callback).not.toHaveBeenCalled();
    });

    it('notification callback unsubscribe removes callback', () => {
      const callback = vi.fn();
      const unsubscribe = adapter.onNotification(callback);

      unsubscribe();
      adapter.testEmitNotification(new Uint8Array([1, 2, 3]));

      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribe only removes specific callback', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = adapter.onConnectionStateChange(callback1);
      adapter.onConnectionStateChange(callback2);

      unsubscribe1();
      adapter.testSetConnectionState('connected');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('connected');
    });
  });

  describe('callback error isolation', () => {
    it('state callback error does not prevent other callbacks', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      adapter.onConnectionStateChange(errorCallback);
      adapter.onConnectionStateChange(normalCallback);

      // Should not throw
      expect(() => adapter.testSetConnectionState('connected')).not.toThrow();

      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('notification callback error does not prevent other callbacks', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      adapter.onNotification(errorCallback);
      adapter.onNotification(normalCallback);

      const data = new Uint8Array([1, 2, 3]);

      // Should not throw
      expect(() => adapter.testEmitNotification(data)).not.toThrow();

      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('abstract method delegation', () => {
    it('scan() is delegated to subclass', async () => {
      const devices = await adapter.scan(5);

      expect(adapter.scanCalled).toBe(true);
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('test-device');
    });

    it('connect() is delegated to subclass', async () => {
      await adapter.connect('test-device');

      expect(adapter.connectCalled).toBe(true);
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('disconnect() is delegated to subclass', async () => {
      await adapter.connect('test-device');
      await adapter.disconnect();

      expect(adapter.disconnectCalled).toBe(true);
      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('write() is delegated to subclass', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await adapter.write(data);

      expect(adapter.writeCalled).toBe(true);
      expect(adapter.lastWriteData).toEqual(data);
    });
  });
});
