/**
 * Voltra Store
 *
 * Factory function that creates a Zustand store for one Voltra device.
 * Thin reactive wrapper over domain controllers.
 *
 * Responsibilities:
 * - Device identity and settings
 * - Connection state management
 * - Recording lifecycle (start/stop)
 * - Raw telemetry frame tracking
 *
 * NOT responsible for (moved to recording-store):
 * - Rep detection and counting
 * - Rep/set aggregation
 * - Analytics computation (SetMetrics, RPE, RIR)
 *
 * Usage:
 *   const voltra = createVoltraStore(adapter, deviceId, deviceName);
 *   const weight = useStore(voltra, s => s.weight);
 */

import { createStore, StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BLEAdapter } from '@/domain/bluetooth/adapters';

// Domain imports - Voltra (hardware-specific)
import {
  VoltraDevice,
  VoltraDeviceController,
  TelemetryController,
  RecordingController,
  toWorkoutSample,
  toWorkoutSamples,
  type TelemetryFrame,
  type TelemetryEvent,
  type RecordingEvent,
} from '@/domain/voltra';

// Domain imports - Workout (hardware-agnostic)
import type { WorkoutSample } from '@/domain/workout';

// =============================================================================
// Types
// =============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected';
export type RecordingState = 'idle' | 'preparing' | 'ready' | 'active' | 'stopping';

export interface VoltraState {
  // Identity
  deviceId: string;
  deviceName: string | null;

  // Connection
  connectionState: ConnectionState;
  isReconnecting: boolean;
  error: string | null;

  // Device Settings
  weight: number;
  chains: number;
  eccentric: number;

  // Recording State (active telemetry streaming)
  recordingState: RecordingState;
  recordingStartTime: number | null;

  // Raw Telemetry (internal - use samples for UI)
  currentFrame: TelemetryFrame | null;
  recentFrames: TelemetryFrame[];
  
  // Workout Samples (hardware-agnostic, for UI display)
  currentSample: WorkoutSample | null;
  recentSamples: WorkoutSample[];

  // Actions - Device Control
  setWeight: (lbs: number) => Promise<void>;
  setChains: (lbs: number) => Promise<void>;
  setEccentric: (pct: number) => Promise<void>;

  // Actions - Recording Control
  prepareWorkout: () => Promise<void>;  // PREPARE + SETUP (device ready, motor off)
  engageMotor: () => Promise<void>;     // GO (motor engaged, start recording)
  disengageMotor: () => Promise<void>;  // STOP but stay in workout mode
  endSet: () => Promise<number>;        // Disengage + return duration
  startRecording: () => Promise<void>;  // Legacy: prepare + engage combined
  stopRecording: () => Promise<number>; // Full stop (exit workout mode)
  resetRecording: () => void;

  // Connection management (for SessionStore to use)
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: string | null) => void;
  setReconnecting: (value: boolean) => void;

  // Internal - exposed for SessionStore
  _adapter: BLEAdapter | null;
  _setAdapter: (adapter: BLEAdapter | null) => void;
  _processNotification: (data: Uint8Array) => void;
  _telemetryController: TelemetryController;
  _dispose: () => void;
}

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Create a Voltra store for a single device.
 * Each device gets its own store instance with isolated state.
 */
export function createVoltraStore(
  adapter: BLEAdapter | null,
  deviceId: string,
  deviceName?: string | null,
): VoltraStoreApi {
  // Create domain objects
  const device = new VoltraDevice(deviceId, deviceName ?? undefined);
  const telemetryController = new TelemetryController();
  const deviceController = new VoltraDeviceController(device, adapter);
  const recordingController = new RecordingController(
    device,
    adapter,
    telemetryController,
  );

  // Subscriptions to clean up
  const subscriptions: (() => void)[] = [];

  const store = createStore<VoltraState>()(
    devtools(
      (set, _get) => {
        // Subscribe to telemetry events (now only frames)
        const telemetrySub = telemetryController.subscribe(
          (event: TelemetryEvent) => {
            switch (event.type) {
              case 'frame':
                // Update raw frame state and converted samples
                const recentFrames = telemetryController.recentFrames;
                set({
                  currentFrame: event.frame,
                  recentFrames,
                  currentSample: toWorkoutSample(event.frame),
                  recentSamples: toWorkoutSamples(recentFrames),
                });
                break;

              // recordingStarted and recordingEnded are handled by RecordingController
            }
          },
        );
        subscriptions.push(telemetrySub);

        // Subscribe to recording events
        const recordingSub = recordingController.subscribe(
          (event: RecordingEvent) => {
            switch (event.type) {
              case 'stateChanged':
                set({ recordingState: event.state as RecordingState });
                break;

              case 'started':
                set({
                  recordingStartTime: Date.now(),
                  currentFrame: null,
                  recentFrames: [],
                  currentSample: null,
                  recentSamples: [],
                });
                break;

              case 'stopped':
                set({ recordingStartTime: null });
                break;

              case 'error':
                set({ error: event.error });
                break;
            }
          },
        );
        subscriptions.push(recordingSub);

        return {
          // Identity
          deviceId,
          deviceName: deviceName ?? null,

          // Connection
          connectionState: adapter ? 'connected' : 'disconnected',
          isReconnecting: false,
          error: null,

          // Settings
          weight: 0,
          chains: 0,
          eccentric: 0,

          // Recording
          recordingState: 'idle',
          recordingStartTime: null,

          // Raw Telemetry
          currentFrame: null,
          recentFrames: [],
          
          // Workout Samples
          currentSample: null,
          recentSamples: [],

          // Internal
          _adapter: adapter,
          _telemetryController: telemetryController,

          // Connection management
          setConnectionState: (state) => set({ connectionState: state }),
          setError: (error) => set({ error }),
          setReconnecting: (value) => set({ isReconnecting: value }),

          _setAdapter: (newAdapter) => {
            deviceController.setAdapter(newAdapter);
            recordingController.setAdapter(newAdapter);
            set({ _adapter: newAdapter });
          },

          // Device control - delegate to controller
          setWeight: async (lbs) => {
            try {
              await deviceController.setWeight(lbs);
              telemetryController.setWeight(lbs);
              set({ weight: lbs, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setChains: async (lbs) => {
            try {
              await deviceController.setChains(lbs);
              set({ chains: lbs, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setEccentric: async (pct) => {
            try {
              await deviceController.setEccentric(pct);
              set({ eccentric: pct, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          // Recording control - delegate to controller
          prepareWorkout: async () => {
            // PREPARE + SETUP: puts device in workout mode but motor not engaged
            await recordingController.prepare();
          },
          
          engageMotor: async () => {
            // GO: engage motor, start recording
            await recordingController.engage();
          },
          
          disengageMotor: async () => {
            // STOP: disengage motor but stay in workout mode
            await recordingController.disengage();
          },
          
          endSet: async () => {
            // End the current set, disengage motor, return duration
            return await recordingController.endSet();
          },
          
          startRecording: async () => {
            // Legacy: combines prepare + engage
            await recordingController.start();
          },

          stopRecording: async () => {
            // Full stop - exits workout mode
            return await recordingController.stop();
          },

          resetRecording: () => {
            recordingController.reset();
            set({
              currentFrame: null,
              recentFrames: [],
              currentSample: null,
              recentSamples: [],
            });
          },

          // Process BLE notification - delegate to controller
          _processNotification: (data: Uint8Array) => {
            telemetryController.processNotification(data);
          },

          // Cleanup
          _dispose: () => {
            subscriptions.forEach((unsub) => unsub());
            telemetryController.dispose();
            recordingController.dispose();
          },
        };
      },
      { name: `voltra-${deviceId}` },
    ),
  );

  return store;
}

// =============================================================================
// Types
// =============================================================================

export type VoltraStoreApi = StoreApi<VoltraState>;
