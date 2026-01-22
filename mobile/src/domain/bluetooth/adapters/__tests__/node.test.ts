/**
 * NodeBLEAdapter Tests
 *
 * Tests for the Node.js webbluetooth-based adapter.
 * Tests focus on Node.js-specific behavior like device chooser.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NodeBLEAdapter } from '../node';
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

// Track deviceFound callbacks for testing
let deviceFoundCallback:
  | ((device: unknown, selectFn: () => void) => boolean | void)
  | null = null;

// Mock characteristic
function createMockCharacteristic(supportsNotify = true) {
  return {
    properties: { notify: supportsNotify },
    value: null as DataView | null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
  };
}

// Mock service
function createMockService() {
  const notifyChar = createMockCharacteristic();
  const writeChar = createMockCharacteristic();

  return {
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

  return {
    id: `device-${name}`,
    name,
    gatt: {
      ...server,
      connect: vi.fn().mockResolvedValue(server),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    _service: service,
  };
}

// Mock Bluetooth class constructor
// The NodeBLEAdapter creates a new Bluetooth instance with deviceFound in constructor
const mockRequestDevice = vi.fn();

class MockBluetooth {
  private deviceFound:
    | ((device: unknown, selectFn: () => void) => boolean | void)
    | null;

  constructor(options?: {
    deviceFound?: (device: unknown, selectFn: () => void) => boolean | void;
  }) {
    this.deviceFound = options?.deviceFound ?? null;
    // Store for test access
    deviceFoundCallback = this.deviceFound;
  }

  requestDevice(
    _options: Record<string, unknown>
  ): Promise<ReturnType<typeof createMockDevice>> {
    return new Promise((resolve, reject) => {
      const mockDevice = createMockDevice('VTR-Test');

      if (this.deviceFound) {
        // Simulate discovering a device - call deviceFound callback
        let selected = false;
        const selectFn = () => {
          selected = true;
          resolve(mockDevice);
        };

        const result = this.deviceFound(mockDevice, selectFn);

        // If callback returns true or calls selectFn, device is selected
        if (result === true && !selected) {
          resolve(mockDevice);
        }

        // If neither happened, reject with NotFoundError after a tick
        if (!selected && result !== true) {
          setTimeout(() => {
            const error = new Error('No device selected');
            error.name = 'NotFoundError';
            reject(error);
          }, 10);
        }
      } else {
        resolve(mockDevice);
      }
    });
  }
}

// Mock webbluetooth module - now exports Bluetooth class
vi.mock('webbluetooth', () => ({
  Bluetooth: MockBluetooth,
  // Keep bluetooth singleton for backward compat (not used by our code anymore)
  bluetooth: {
    requestDevice: mockRequestDevice,
  },
}));

// =============================================================================
// Tests
// =============================================================================

describe('NodeBLEAdapter', () => {
  let adapter: NodeBLEAdapter;

  beforeEach(() => {
    adapter = new NodeBLEAdapter(TEST_CONFIG);
    deviceFoundCallback = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts disconnected', () => {
      expect(adapter.getConnectionState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('has no discovered devices initially', () => {
      expect(adapter.getDiscoveredDevices()).toHaveLength(0);
    });
  });

  describe('scan()', () => {
    it('returns discovered devices', async () => {
      const devices = await adapter.scan(5);

      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0].name).toBe('VTR-Test');
    });

    it('creates Bluetooth instance with deviceFound callback', async () => {
      await adapter.scan(5);

      // The deviceFound callback should have been stored
      expect(deviceFoundCallback).not.toBeNull();
    });

    it('filters devices by name prefix', async () => {
      // The deviceFound callback should filter by prefix
      await adapter.scan(5);

      // Simulate a non-matching device
      if (deviceFoundCallback) {
        const nonMatchingDevice = createMockDevice('OTHER-Device');
        let wasSelected = false;
        const result = deviceFoundCallback(nonMatchingDevice, () => {
          wasSelected = true;
        });

        // Should return false and not select
        expect(result).toBe(false);
        expect(wasSelected).toBe(false);
      }
    });
  });

  describe('setDeviceChooser()', () => {
    it('accepts custom device chooser', () => {
      const chooser = vi.fn().mockReturnValue(null);
      adapter.setDeviceChooser(chooser);

      // No error should occur
      expect(true).toBe(true);
    });

    it('uses custom chooser during scan', async () => {
      const chooser = vi.fn().mockImplementation((devices) => {
        // Only select if we have at least one device
        return devices.length > 0 ? devices[0] : null;
      });
      adapter.setDeviceChooser(chooser);

      await adapter.scan(5);

      expect(chooser).toHaveBeenCalled();
    });
  });

  describe('connect()', () => {
    it('throws if no device selected', async () => {
      await expect(adapter.connect('some-id')).rejects.toThrow(
        'No device selected. Call scan() first.'
      );
    });

    it('connects after scan', async () => {
      await adapter.scan(5);
      const devices = adapter.getDiscoveredDevices();

      if (devices.length > 0) {
        await adapter.connect(devices[0].id);
        expect(adapter.getConnectionState()).toBe('connected');
      }
    });
  });

  describe('disconnect()', () => {
    it('clears state on disconnect', async () => {
      await adapter.scan(5);
      const devices = adapter.getDiscoveredDevices();

      if (devices.length > 0) {
        await adapter.connect(devices[0].id);
        await adapter.disconnect();

        expect(adapter.getConnectionState()).toBe('disconnected');
        expect(adapter.getDiscoveredDevices()).toHaveLength(0);
      }
    });
  });

  describe('isNodeEnvironment()', () => {
    it('returns true in Node.js', () => {
      expect(NodeBLEAdapter.isNodeEnvironment()).toBe(true);
    });
  });

  describe('getDiscoveredDevices()', () => {
    it('returns copy of discovered devices', async () => {
      await adapter.scan(5);

      const devices1 = adapter.getDiscoveredDevices();
      const devices2 = adapter.getDiscoveredDevices();

      // Should be different array instances
      expect(devices1).not.toBe(devices2);
      // But same content
      expect(devices1).toEqual(devices2);
    });
  });
});
