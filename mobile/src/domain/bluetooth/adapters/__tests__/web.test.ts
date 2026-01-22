/**
 * WebBLEAdapter Tests
 *
 * Tests for the browser-based Web Bluetooth adapter.
 * Uses mocked navigator.bluetooth API.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebBLEAdapter } from '../web';
import type { BLEServiceConfig } from '../types';

// =============================================================================
// Mock Setup
// =============================================================================

const TEST_CONFIG: { ble: BLEServiceConfig } = {
  ble: {
    serviceUUID: 'test-service-uuid',
    notifyCharUUID: 'test-notify-uuid',
    writeCharUUID: 'test-write-uuid',
    deviceNamePrefix: 'VTR-',
  },
};

// Mock characteristic
function createMockCharacteristic(uuid: string, supportsNotify = true) {
  const listeners: Map<string, EventListener> = new Map();
  
  return {
    uuid,
    properties: { notify: supportsNotify },
    value: null as DataView | null,
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      listeners.set(event, listener);
    }),
    removeEventListener: vi.fn((event: string, _listener: EventListener) => {
      listeners.delete(event);
    }),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
    // Helper to simulate notification
    _simulateNotification: (data: Uint8Array) => {
      const dataView = new DataView(data.buffer);
      const event = { target: { value: dataView } } as unknown as Event;
      listeners.get('characteristicvaluechanged')?.(event);
    },
  };
}

// Mock service
function createMockService() {
  const notifyChar = createMockCharacteristic('test-notify-uuid');
  const writeChar = createMockCharacteristic('test-write-uuid');
  
  return {
    uuid: 'test-service-uuid',
    getCharacteristic: vi.fn((uuid: string) => {
      if (uuid === 'test-notify-uuid') return Promise.resolve(notifyChar);
      if (uuid === 'test-write-uuid') return Promise.resolve(writeChar);
      return Promise.reject(new Error('Unknown characteristic'));
    }),
    _notifyChar: notifyChar,
    _writeChar: writeChar,
  };
}

// Mock GATT server
function createMockServer(service: ReturnType<typeof createMockService>) {
  return {
    connected: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn().mockResolvedValue(service),
  };
}

// Mock device
function createMockDevice(name = 'VTR-12345') {
  const service = createMockService();
  const server = createMockServer(service);
  const listeners: Map<string, EventListener> = new Map();
  
  return {
    id: 'mock-device-id',
    name,
    gatt: {
      ...server,
      connect: vi.fn().mockResolvedValue(server),
    },
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      listeners.set(event, listener);
    }),
    removeEventListener: vi.fn(),
    _service: service,
    _server: server,
    _simulateDisconnect: () => {
      listeners.get('gattserverdisconnected')?.({} as Event);
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('WebBLEAdapter', () => {
  let adapter: WebBLEAdapter;
  let mockDevice: ReturnType<typeof createMockDevice>;
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    adapter = new WebBLEAdapter(TEST_CONFIG);
    mockDevice = createMockDevice();
    
    // Save original navigator
    originalNavigator = globalThis.navigator;
    
    // Mock navigator.bluetooth
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        bluetooth: {
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('scan()', () => {
    it('calls requestDevice with correct filters', async () => {
      await adapter.scan(5);

      expect(navigator.bluetooth.requestDevice).toHaveBeenCalledWith({
        filters: [{ namePrefix: 'VTR-' }],
        acceptAllDevices: false,
        optionalServices: ['test-service-uuid'],
      });
    });

    it('returns device from picker', async () => {
      const devices = await adapter.scan(5);

      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('mock-device-id');
      expect(devices[0].name).toBe('VTR-12345');
    });

    it('returns empty array when user cancels', async () => {
      const cancelError = new Error('User cancelled');
      cancelError.name = 'NotFoundError';
      (navigator.bluetooth.requestDevice as ReturnType<typeof vi.fn>).mockRejectedValue(cancelError);

      const devices = await adapter.scan(5);

      expect(devices).toHaveLength(0);
    });

    it('throws on other errors', async () => {
      (navigator.bluetooth.requestDevice as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Bluetooth not available')
      );

      await expect(adapter.scan(5)).rejects.toThrow('Bluetooth not available');
    });

    it('accepts all devices when no prefix configured', async () => {
      const noFilterAdapter = new WebBLEAdapter({
        ble: { ...TEST_CONFIG.ble, deviceNamePrefix: undefined },
      });

      await noFilterAdapter.scan(5);

      expect(navigator.bluetooth.requestDevice).toHaveBeenCalledWith({
        filters: undefined,
        acceptAllDevices: true,
        optionalServices: ['test-service-uuid'],
      });
    });
  });

  describe('connect()', () => {
    it('throws if no device selected', async () => {
      await expect(adapter.connect('some-id')).rejects.toThrow(
        'No device selected. Call scan() first.'
      );
    });

    it('connects to GATT server', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      expect(mockDevice.gatt.connect).toHaveBeenCalled();
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('sets up characteristics', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      expect(mockDevice._service.getCharacteristic).toHaveBeenCalledWith('test-notify-uuid');
      expect(mockDevice._service.getCharacteristic).toHaveBeenCalledWith('test-write-uuid');
    });

    it('starts notifications', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      expect(mockDevice._service._notifyChar.startNotifications).toHaveBeenCalled();
    });

    it('handles immediate write', async () => {
      await adapter.scan(5);
      const immediateData = new Uint8Array([1, 2, 3]);
      await adapter.connect('mock-device-id', {
        immediateWrite: immediateData,
      });

      // Verify writeValueWithResponse was called with the correct data
      // (data is converted to ArrayBuffer for Web Bluetooth API)
      expect(mockDevice._service._writeChar.writeValueWithResponse).toHaveBeenCalledTimes(1);
      const calledWith = mockDevice._service._writeChar.writeValueWithResponse.mock.calls[0][0];
      expect(new Uint8Array(calledWith)).toEqual(immediateData);
    });
  });

  describe('disconnect()', () => {
    it('disconnects from GATT', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');
      await adapter.disconnect();

      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('clears selected device', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');
      await adapter.disconnect();

      // Should throw because device is cleared
      await expect(adapter.connect('mock-device-id')).rejects.toThrow(
        'No device selected. Call scan() first.'
      );
    });
  });

  describe('write()', () => {
    it('writes data to characteristic', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      const data = new Uint8Array([1, 2, 3, 4]);
      await adapter.write(data);

      // Verify writeValueWithResponse was called with the correct data
      // (data is converted to ArrayBuffer for Web Bluetooth API)
      expect(mockDevice._service._writeChar.writeValueWithResponse).toHaveBeenCalledTimes(1);
      const calledWith = mockDevice._service._writeChar.writeValueWithResponse.mock.calls[0][0];
      expect(new Uint8Array(calledWith)).toEqual(data);
    });

    it('throws if not connected', async () => {
      await expect(adapter.write(new Uint8Array([1]))).rejects.toThrow(
        'Not connected to device'
      );
    });
  });

  describe('notifications', () => {
    it('emits notifications via callback', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      const callback = vi.fn();
      adapter.onNotification(callback);

      // Simulate notification
      mockDevice._service._notifyChar._simulateNotification(new Uint8Array([1, 2, 3]));

      expect(callback).toHaveBeenCalled();
      const receivedData = callback.mock.calls[0][0];
      expect(receivedData).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe('isSupported()', () => {
    it('returns true when bluetooth available', () => {
      expect(WebBLEAdapter.isSupported()).toBe(true);
    });

    it('returns false when bluetooth not available', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      expect(WebBLEAdapter.isSupported()).toBe(false);
    });
  });

  describe('getConnectedDevice()', () => {
    it('returns null when not connected', () => {
      expect(adapter.getConnectedDevice()).toBeNull();
    });

    it('returns device info when connected', async () => {
      await adapter.scan(5);
      await adapter.connect('mock-device-id');

      const device = adapter.getConnectedDevice();
      expect(device).not.toBeNull();
      expect(device?.id).toBe('mock-device-id');
      expect(device?.name).toBe('VTR-12345');
    });
  });
});
