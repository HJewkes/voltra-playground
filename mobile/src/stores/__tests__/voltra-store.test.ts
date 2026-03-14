/**
 * Voltra Store Tests
 *
 * Tests for device store creation, connection state management,
 * device settings, recording lifecycle, and cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVoltraStore, type VoltraStoreApi } from '../voltra-store';

// Mock @/domain/device to avoid react-native-ble-plx parse errors
vi.mock('@/domain/device', () => ({
  TrainingMode: { Idle: 0, WeightTraining: 1, ResistanceBand: 2, Rowing: 3, Damper: 4, CustomCurves: 6, Isokinetic: 7, Isometric: 8 },
  TrainingModeNames: {},
  toWorkoutSample: vi.fn((frame: unknown) => frame),
  toWorkoutSamples: vi.fn((frames: unknown[]) => frames),
  detectBLEEnvironment: vi.fn(() => ({
    environment: 'node',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
    forceMock: false,
  })),
  VoltraManager: { forMock: vi.fn(), forNative: vi.fn(), forWeb: vi.fn(), forNode: vi.fn() },
}));

const TrainingMode = { Idle: 0, WeightTraining: 1, Standard: 1, ResistanceBand: 2 } as const;

// =============================================================================
// Tests
// =============================================================================

describe('VoltraStore', () => {
  let store: VoltraStoreApi;

  beforeEach(() => {
    store = createVoltraStore(null, 'device-001', 'Test Voltra');
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('stores device identity', () => {
      const state = store.getState();

      expect(state.deviceId).toBe('device-001');
      expect(state.deviceName).toBe('Test Voltra');
    });

    it('starts disconnected with no client', () => {
      const state = store.getState();

      expect(state.connectionState).toBe('disconnected');
      expect(state._client).toBeNull();
      expect(state.isReconnecting).toBe(false);
      expect(state.error).toBeNull();
    });

    it('initializes device settings to defaults', () => {
      const state = store.getState();

      expect(state.weight).toBe(0);
      expect(state.chains).toBe(0);
      expect(state.inverseChains).toBe(0);
      expect(state.eccentric).toBe(0);
      expect(state.mode).toBe(TrainingMode.Idle);
      expect(state.battery).toBeNull();
    });

    it('starts with idle recording state', () => {
      const state = store.getState();

      expect(state.recordingState).toBe('idle');
      expect(state.recordingStartTime).toBeNull();
      expect(state.currentFrame).toBeNull();
      expect(state.recentFrames).toEqual([]);
      expect(state.currentSample).toBeNull();
      expect(state.recentSamples).toEqual([]);
    });

    it('handles null device name', () => {
      const s = createVoltraStore(null, 'device-002');
      expect(s.getState().deviceName).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Connection State Management
  // ---------------------------------------------------------------------------

  describe('connection state management', () => {
    it('setConnectionState updates connection state', () => {
      store.getState().setConnectionState('connecting');
      expect(store.getState().connectionState).toBe('connecting');

      store.getState().setConnectionState('authenticating');
      expect(store.getState().connectionState).toBe('authenticating');

      store.getState().setConnectionState('connected');
      expect(store.getState().connectionState).toBe('connected');

      store.getState().setConnectionState('disconnected');
      expect(store.getState().connectionState).toBe('disconnected');
    });

    it('setError stores error message', () => {
      store.getState().setError('Connection timeout');
      expect(store.getState().error).toBe('Connection timeout');
    });

    it('setError clears error with null', () => {
      store.getState().setError('Some error');
      store.getState().setError(null);
      expect(store.getState().error).toBeNull();
    });

    it('setReconnecting updates reconnecting flag', () => {
      store.getState().setReconnecting(true);
      expect(store.getState().isReconnecting).toBe(true);

      store.getState().setReconnecting(false);
      expect(store.getState().isReconnecting).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Device Control (without client)
  // ---------------------------------------------------------------------------

  describe('device control without client', () => {
    it('setWeight sets error when not connected', async () => {
      await store.getState().setWeight(100);
      expect(store.getState().error).toBe('Not connected');
    });

    it('setChains sets error when not connected', async () => {
      await store.getState().setChains(20);
      expect(store.getState().error).toBe('Not connected');
    });

    it('setInverseChains sets error when not connected', async () => {
      await store.getState().setInverseChains(15);
      expect(store.getState().error).toBe('Not connected');
    });

    it('setEccentric sets error when not connected', async () => {
      await store.getState().setEccentric(80);
      expect(store.getState().error).toBe('Not connected');
    });

    it('setMode sets error when not connected', async () => {
      await store.getState().setMode(TrainingMode.Standard);
      expect(store.getState().error).toBe('Not connected');
    });
  });

  // ---------------------------------------------------------------------------
  // Recording Control (without client)
  // ---------------------------------------------------------------------------

  describe('recording control without client', () => {
    it('prepareWorkout throws when not connected', async () => {
      await expect(store.getState().prepareWorkout()).rejects.toThrow('Not connected');
    });

    it('engageMotor throws when not connected', async () => {
      await expect(store.getState().engageMotor()).rejects.toThrow('Not connected');
    });

    it('disengageMotor throws when not connected', async () => {
      await expect(store.getState().disengageMotor()).rejects.toThrow('Not connected');
    });

    it('startRecording throws when not connected', async () => {
      await expect(store.getState().startRecording()).rejects.toThrow('Not connected');
    });

    it('stopRecording throws when not connected', async () => {
      await expect(store.getState().stopRecording()).rejects.toThrow('Not connected');
    });

    it('endSet throws when not connected', async () => {
      await expect(store.getState().endSet()).rejects.toThrow('Not connected');
    });
  });

  // ---------------------------------------------------------------------------
  // resetRecording
  // ---------------------------------------------------------------------------

  describe('resetRecording()', () => {
    it('clears all recording data', () => {
      store.getState().resetRecording();
      const state = store.getState();

      expect(state.currentFrame).toBeNull();
      expect(state.recentFrames).toEqual([]);
      expect(state.currentSample).toBeNull();
      expect(state.recentSamples).toEqual([]);
      expect(state.recordingStartTime).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // _setClient
  // ---------------------------------------------------------------------------

  describe('_setClient()', () => {
    it('updates client reference', () => {
      const mockClient = createMockClient();
      store.getState()._setClient(mockClient);
      expect(store.getState()._client).toBe(mockClient);
    });

    it('clears client with null', () => {
      const mockClient = createMockClient();
      store.getState()._setClient(mockClient);
      store.getState()._setClient(null);
      expect(store.getState()._client).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // _dispose
  // ---------------------------------------------------------------------------

  describe('_dispose()', () => {
    it('cleans up without errors', () => {
      expect(() => store.getState()._dispose()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Device Control (with mock client)
  // ---------------------------------------------------------------------------

  describe('device control with mock client', () => {
    let mockClient: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      mockClient = createMockClient();
      store.getState()._setClient(mockClient);
    });

    it('setWeight delegates to client and updates state', async () => {
      await store.getState().setWeight(185);

      expect(mockClient.setWeight).toHaveBeenCalledWith(185);
      expect(store.getState().weight).toBe(185);
      expect(store.getState().error).toBeNull();
    });

    it('setWeight stores error on client failure', async () => {
      mockClient.setWeight.mockRejectedValueOnce(new Error('BLE write failed'));

      await store.getState().setWeight(185);

      expect(store.getState().error).toBe('BLE write failed');
    });

    it('setChains delegates to client and updates state', async () => {
      await store.getState().setChains(25);

      expect(mockClient.setChains).toHaveBeenCalledWith(25);
      expect(store.getState().chains).toBe(25);
    });

    it('setMode delegates to client and updates state', async () => {
      await store.getState().setMode(TrainingMode.Standard);

      expect(mockClient.setMode).toHaveBeenCalledWith(TrainingMode.Standard);
      expect(store.getState().mode).toBe(TrainingMode.Standard);
    });

    it('prepareWorkout delegates to client', async () => {
      await store.getState().prepareWorkout();
      expect(mockClient.prepareRecording).toHaveBeenCalled();
    });

    it('engageMotor delegates to client startRecording', async () => {
      await store.getState().engageMotor();
      expect(mockClient.startRecording).toHaveBeenCalled();
    });

    it('startRecording clears frame buffers and delegates to client', async () => {
      await store.getState().startRecording();

      expect(mockClient.startRecording).toHaveBeenCalled();
      expect(store.getState().currentFrame).toBeNull();
      expect(store.getState().recentFrames).toEqual([]);
      expect(store.getState().currentSample).toBeNull();
      expect(store.getState().recentSamples).toEqual([]);
    });

    it('stopRecording delegates to client and returns duration', async () => {
      const duration = await store.getState().stopRecording();
      expect(mockClient.stopRecording).toHaveBeenCalled();
      expect(duration).toBeTypeOf('number');
    });
  });
});

// =============================================================================
// Mock Client Factory
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function createMockClient(): any {
  return {
    connectionState: 'connected' as const,
    recordingState: 'idle' as const,
    settings: { weight: 0, chains: 0, inverseChains: 0, eccentric: 0, mode: TrainingMode.Idle, battery: null },
    setWeight: vi.fn().mockResolvedValue(undefined),
    setChains: vi.fn().mockResolvedValue(undefined),
    setInverseChains: vi.fn().mockResolvedValue(undefined),
    setEccentric: vi.fn().mockResolvedValue(undefined),
    setMode: vi.fn().mockResolvedValue(undefined),
    prepareRecording: vi.fn().mockResolvedValue(undefined),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(undefined),
    endSet: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => vi.fn()),
    onFrame: vi.fn(() => vi.fn()),
    onSettingsUpdate: vi.fn(() => vi.fn()),
    onBatteryUpdate: vi.fn(() => vi.fn()),
    onModeConfirmed: vi.fn(() => vi.fn()),
  };
}
