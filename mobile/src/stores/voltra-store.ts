/**
 * Voltra Store
 *
 * Factory function that creates a Zustand store for one Voltra device.
 * Thin reactive wrapper over SDK's VoltraClient.
 *
 * Responsibilities:
 * - Device identity and settings
 * - Connection state management
 * - Recording lifecycle (start/stop)
 * - Raw telemetry frame tracking
 * - Convert TelemetryFrame to WorkoutSample
 *
 * NOT responsible for (moved to recording-store):
 * - Rep detection and counting
 * - Rep/set aggregation
 * - Analytics computation (SetMetrics, RPE, RIR)
 *
 * Usage:
 *   const voltra = createVoltraStore(client, deviceId, deviceName);
 *   const weight = useStore(voltra, s => s.weight);
 */

import { createStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// SDK imports
import type {
  VoltraClient,
  TelemetryFrame,
  VoltraConnectionState,
  VoltraRecordingState,
} from '@/domain/device';
import { TrainingMode } from '@/domain/device';

// Domain imports - Device adapter
import { toWorkoutSample } from '@/domain/device';

// Domain imports - Workout (hardware-agnostic)
import type { WorkoutSample } from '@/domain/workout';

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';
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
  inverseChains: number;
  eccentric: number;
  mode: TrainingMode;

  // Device Status
  battery: number | null;

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
  setInverseChains: (lbs: number) => Promise<void>;
  setEccentric: (pct: number) => Promise<void>;
  setMode: (mode: TrainingMode) => Promise<void>;

  // Actions - Recording Control
  prepareWorkout: () => Promise<void>; // PREPARE + SETUP (device ready, motor off)
  engageMotor: () => Promise<void>; // GO (motor engaged, start recording)
  disengageMotor: () => Promise<void>; // STOP but stay in workout mode
  endSet: () => Promise<number>; // Disengage + return duration
  startRecording: () => Promise<void>; // Legacy: prepare + engage combined
  stopRecording: () => Promise<number>; // Full stop (exit workout mode)
  resetRecording: () => void;

  // Connection management (for ConnectionStore to use)
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: string | null) => void;
  setReconnecting: (value: boolean) => void;

  // Internal - exposed for ConnectionStore
  _client: VoltraClient | null;
  _setClient: (client: VoltraClient | null) => void;
  _dispose: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function mapConnectionState(state: VoltraConnectionState): ConnectionState {
  return state as ConnectionState;
}

function mapRecordingState(state: VoltraRecordingState): RecordingState {
  return state as RecordingState;
}

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Create a Voltra store for a single device.
 * Each device gets its own store instance with isolated state.
 */
export function createVoltraStore(
  client: VoltraClient | null,
  deviceId: string,
  deviceName?: string | null
): VoltraStoreApi {
  // Subscriptions to clean up
  const subscriptions: (() => void)[] = [];

  // Buffers for recent frames and samples (maintained incrementally)
  const recentFramesBuffer: TelemetryFrame[] = [];
  const recentSamplesBuffer: WorkoutSample[] = [];
  const MAX_RECENT_FRAMES = 100;

  // Track recording start time locally (SDK doesn't expose this)
  let localRecordingStartTime: number | null = null;

  /**
   * Setup event subscriptions for a client.
   */
  function setupClientSubscriptions(
    client: VoltraClient,
    set: (partial: Partial<VoltraState>) => void
  ): void {
    // Subscribe to all client events via the generic subscribe
    const eventSub = client.subscribe((event) => {
      switch (event.type) {
        case 'connectionStateChanged':
          set({ connectionState: mapConnectionState(event.state) });
          break;

        case 'recordingStateChanged': {
          const recordingState = mapRecordingState(event.state);
          set({ recordingState });

          if (event.state === 'active') {
            localRecordingStartTime = Date.now();
            set({ recordingStartTime: localRecordingStartTime });
          } else if (event.state === 'idle') {
            localRecordingStartTime = null;
            set({ recordingStartTime: null });
          }
          break;
        }

        case 'error':
          set({ error: event.error.message });
          break;
      }
    });
    subscriptions.push(eventSub);

    // Subscribe to frames via dedicated onFrame method
    const frameSub = client.onFrame((frame: TelemetryFrame) => {
      // Add frame to buffer
      recentFramesBuffer.push(frame);
      if (recentFramesBuffer.length > MAX_RECENT_FRAMES) {
        recentFramesBuffer.shift();
      }

      // Convert current frame to sample (single conversion, not whole buffer)
      const sample = toWorkoutSample(frame);
      
      // Add sample to buffer incrementally
      recentSamplesBuffer.push(sample);
      if (recentSamplesBuffer.length > MAX_RECENT_FRAMES) {
        recentSamplesBuffer.shift();
      }

      set({
        currentFrame: frame,
        recentFrames: [...recentFramesBuffer],
        currentSample: sample,
        recentSamples: [...recentSamplesBuffer],
      });
    });
    subscriptions.push(frameSub);

    // Subscribe to settings updates from device notifications
    // DeviceSettings uses protocol field names (baseWeight, trainingMode)
    const settingsSub = client.onSettingsUpdate((settings) => {
      set({
        weight: settings.baseWeight ?? 0,
        chains: settings.chains ?? 0,
        inverseChains: settings.inverseChains ?? 0,
        eccentric: settings.eccentric ?? 0,
        mode: settings.trainingMode ?? TrainingMode.Idle,
      });
    });
    subscriptions.push(settingsSub);

    // Subscribe to battery updates
    const batterySub = client.onBatteryUpdate((battery) => {
      set({ battery });
    });
    subscriptions.push(batterySub);

    // Subscribe to mode confirmation
    const modeSub = client.onModeConfirmed((mode) => {
      set({ mode });
    });
    subscriptions.push(modeSub);
  }

  const store = createStore<VoltraState>()(
    devtools(
      (set, get) => {
        // Subscribe to client events if client exists
        if (client) {
          setupClientSubscriptions(client, set);
        }

        return {
          // Identity
          deviceId,
          deviceName: deviceName ?? null,

          // Connection
          connectionState: client?.connectionState
            ? mapConnectionState(client.connectionState)
            : 'disconnected',
          isReconnecting: false,
          error: null,

          // Settings (synced from device via onSettingsUpdate events)
          weight: client?.settings?.weight ?? 0,
          chains: client?.settings?.chains ?? 0,
          inverseChains: client?.settings?.inverseChains ?? 0,
          eccentric: client?.settings?.eccentric ?? 0,
          mode: client?.settings?.mode ?? TrainingMode.Idle,

          // Device Status
          battery: client?.settings?.battery ?? null,

          // Recording
          recordingState: client?.recordingState
            ? mapRecordingState(client.recordingState)
            : 'idle',
          recordingStartTime: null,

          // Raw Telemetry
          currentFrame: null,
          recentFrames: [],

          // Workout Samples
          currentSample: null,
          recentSamples: [],

          // Internal
          _client: client,

          // Connection management
          setConnectionState: (state) => set({ connectionState: state }),
          setError: (error) => set({ error }),
          setReconnecting: (value) => set({ isReconnecting: value }),

          _setClient: (newClient) => {
            // Clean up old subscriptions
            subscriptions.forEach((unsub) => unsub());
            subscriptions.length = 0;

            if (newClient) {
              setupClientSubscriptions(newClient, set);
            }

            set({ _client: newClient });
          },

          // Device control - delegate to client
          setWeight: async (lbs) => {
            const currentClient = get()._client;
            if (!currentClient) {
              set({ error: 'Not connected' });
              return;
            }
            try {
              await currentClient.setWeight(lbs);
              set({ weight: lbs, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setChains: async (lbs) => {
            const currentClient = get()._client;
            if (!currentClient) {
              set({ error: 'Not connected' });
              return;
            }
            try {
              await currentClient.setChains(lbs);
              set({ chains: lbs, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setInverseChains: async (lbs) => {
            const currentClient = get()._client;
            if (!currentClient) {
              set({ error: 'Not connected' });
              return;
            }
            try {
              await currentClient.setInverseChains(lbs);
              set({ inverseChains: lbs, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setEccentric: async (pct) => {
            const currentClient = get()._client;
            if (!currentClient) {
              set({ error: 'Not connected' });
              return;
            }
            try {
              await currentClient.setEccentric(pct);
              set({ eccentric: pct, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          setMode: async (mode) => {
            const currentClient = get()._client;
            if (!currentClient) {
              set({ error: 'Not connected' });
              return;
            }
            try {
              await currentClient.setMode(mode);
              set({ mode, error: null });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              set({ error: message });
            }
          },

          // Recording control - delegate to client
          prepareWorkout: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');
            await currentClient.prepareRecording();
          },

          engageMotor: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');
            await currentClient.startRecording();
          },

          disengageMotor: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');
            await currentClient.endSet();
          },

          endSet: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');

            const startTime = localRecordingStartTime ?? Date.now();
            await currentClient.endSet();
            return Date.now() - startTime;
          },

          startRecording: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');

            // Clear frame buffer
            recentFramesBuffer.length = 0;
            set({
              currentFrame: null,
              recentFrames: [],
              currentSample: null,
              recentSamples: [],
            });

            await currentClient.startRecording();
          },

          stopRecording: async () => {
            const currentClient = get()._client;
            if (!currentClient) throw new Error('Not connected');

            const startTime = localRecordingStartTime ?? Date.now();
            await currentClient.stopRecording();
            return Date.now() - startTime;
          },

          resetRecording: () => {
            recentFramesBuffer.length = 0;
            localRecordingStartTime = null;
            set({
              currentFrame: null,
              recentFrames: [],
              currentSample: null,
              recentSamples: [],
              recordingStartTime: null,
            });
          },

          // Cleanup
          _dispose: () => {
            subscriptions.forEach((unsub) => unsub());
            subscriptions.length = 0;
          },
        };
      },
      { name: `voltra-${deviceId}` }
    )
  );

  return store;
}

// =============================================================================
// Types
// =============================================================================

export type VoltraStoreApi = StoreApi<VoltraState>;
