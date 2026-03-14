/**
 * Connection Store Tests
 *
 * Tests for connection state selectors, device management,
 * and error handling in the connection store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConnectionStore, selectIsConnected } from '../connection-store';
import { createVoltraStore } from '../voltra-store';

// Mock react-native AppState (not in the RN mock)
vi.mock('react-native', async () => {
  const actual = await vi.importActual('react-native');
  return {
    ...actual,
    AppState: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      currentState: 'active',
    },
  };
});

// Mock @/domain/device fully to avoid react-native-ble-plx parse errors
vi.mock('@/domain/device', () => ({
  TrainingMode: { Idle: 0, WeightTraining: 1 },
  TrainingModeNames: {},
  toWorkoutSample: vi.fn((frame: unknown) => frame),
  toWorkoutSamples: vi.fn((frames: unknown[]) => frames),
  detectBLEEnvironment: vi.fn(() => ({
    environment: 'web',
    bleSupported: true,
    warningMessage: null,
    isWeb: true,
    requiresUserGesture: true,
    forceMock: false,
  })),
  VoltraManager: {
    forMock: vi.fn(),
    forNative: vi.fn(),
    forWeb: vi.fn(),
    forNode: vi.fn(),
  },
  ConnectionError: class extends Error {},
  AuthenticationError: class extends Error {},
  TimeoutError: class extends Error {},
  NotConnectedError: class extends Error {},
}));

vi.mock('@/data/preferences', () => ({
  getLastDevice: vi.fn().mockResolvedValue(null),
  saveLastDevice: vi.fn().mockResolvedValue(undefined),
  clearLastDevice: vi.fn().mockResolvedValue(undefined),
  isAutoReconnectEnabled: vi.fn().mockResolvedValue(true),
  setAutoReconnectEnabled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/config', () => ({
  SCAN_DURATION: 5000,
  SCAN_INTERVAL: 10000,
}));

// =============================================================================
// Tests
// =============================================================================

describe('Connection Store', () => {
  beforeEach(() => {
    // Reset the singleton store state between tests
    useConnectionStore.setState({
      devices: new Map(),
      primaryDeviceId: null,
      isScanning: false,
      discoveredDevices: [],
      isRestoring: false,
      isReconnecting: false,
      connectingDeviceId: null,
      error: null,
      autoReconnectEnabled: true,
      autoScanEnabled: true,
      lastScanTime: 0,
    });
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('has no connected devices', () => {
      const state = useConnectionStore.getState();
      expect(state.devices.size).toBe(0);
      expect(state.primaryDeviceId).toBeNull();
    });

    it('is not scanning', () => {
      const state = useConnectionStore.getState();
      expect(state.isScanning).toBe(false);
      expect(state.discoveredDevices).toEqual([]);
    });

    it('has no errors', () => {
      expect(useConnectionStore.getState().error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // selectIsConnected Selector
  // ---------------------------------------------------------------------------

  describe('selectIsConnected', () => {
    it('returns false when no primary device', () => {
      const state = useConnectionStore.getState();
      expect(selectIsConnected(state)).toBe(false);
    });

    it('returns false when primary device not in devices map', () => {
      useConnectionStore.setState({ primaryDeviceId: 'missing-device' });
      const state = useConnectionStore.getState();
      expect(selectIsConnected(state)).toBe(false);
    });

    it('returns true when primary device exists in devices map', () => {
      const voltraStore = createVoltraStore(null, 'device-001', 'Test');
      const devices = new Map([['device-001', voltraStore]]);
      useConnectionStore.setState({
        devices,
        primaryDeviceId: 'device-001',
      });

      const state = useConnectionStore.getState();
      expect(selectIsConnected(state)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error Management
  // ---------------------------------------------------------------------------

  describe('error management', () => {
    it('setError stores error message', () => {
      useConnectionStore.getState().setError('BLE unavailable');
      expect(useConnectionStore.getState().error).toBe('BLE unavailable');
    });

    it('clearError removes error', () => {
      useConnectionStore.getState().setError('Some error');
      useConnectionStore.getState().clearError();
      expect(useConnectionStore.getState().error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Primary Device Management
  // ---------------------------------------------------------------------------

  describe('primary device management', () => {
    it('setPrimaryDevice updates when device exists in map', () => {
      const voltraStore = createVoltraStore(null, 'device-001', 'Test');
      const devices = new Map([['device-001', voltraStore]]);
      useConnectionStore.setState({ devices });

      useConnectionStore.getState().setPrimaryDevice('device-001');
      expect(useConnectionStore.getState().primaryDeviceId).toBe('device-001');
    });

    it('setPrimaryDevice ignores unknown device', () => {
      useConnectionStore.getState().setPrimaryDevice('unknown');
      expect(useConnectionStore.getState().primaryDeviceId).toBeNull();
    });

    it('getPrimaryDevice returns null when no primary', () => {
      expect(useConnectionStore.getState().getPrimaryDevice()).toBeNull();
    });

    it('getPrimaryDevice returns store when primary is set', () => {
      const voltraStore = createVoltraStore(null, 'device-001', 'Test');
      const devices = new Map([['device-001', voltraStore]]);
      useConnectionStore.setState({ devices, primaryDeviceId: 'device-001' });

      expect(useConnectionStore.getState().getPrimaryDevice()).toBe(voltraStore);
    });

    it('getDevice returns undefined for unknown device', () => {
      expect(useConnectionStore.getState().getDevice('nope')).toBeUndefined();
    });

    it('getDevice returns store for known device', () => {
      const voltraStore = createVoltraStore(null, 'device-001', 'Test');
      const devices = new Map([['device-001', voltraStore]]);
      useConnectionStore.setState({ devices });

      expect(useConnectionStore.getState().getDevice('device-001')).toBe(voltraStore);
    });
  });

  // ---------------------------------------------------------------------------
  // stopScan
  // ---------------------------------------------------------------------------

  describe('stopScan()', () => {
    it('sets isScanning to false', () => {
      useConnectionStore.setState({ isScanning: true });
      useConnectionStore.getState().stopScan();
      expect(useConnectionStore.getState().isScanning).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-reconnect preference
  // ---------------------------------------------------------------------------

  describe('setAutoReconnect()', () => {
    it('updates local state', async () => {
      await useConnectionStore.getState().setAutoReconnect(false);
      expect(useConnectionStore.getState().autoReconnectEnabled).toBe(false);
    });
  });
});
