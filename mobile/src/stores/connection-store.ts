/**
 * Connection Store
 *
 * Singleton Zustand store that manages the fleet of connected Voltra devices.
 * Handles scanning, connection, auto-reconnect, and auto-scan logic.
 *
 * Uses @voltras/node-sdk's VoltraManager for device discovery and connection.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, type AppStateStatus } from 'react-native';
import {
  VoltraManager,
  detectBLEEnvironment,
  type BLEEnvironmentInfo,
  type DiscoveredDevice,
} from '@/domain/device';
import {
  getLastDevice,
  saveLastDevice,
  clearLastDevice,
  isAutoReconnectEnabled,
  setAutoReconnectEnabled,
} from '@/data/preferences';
import { createVoltraStore, type VoltraStoreApi } from './voltra-store';

import { SCAN_DURATION, SCAN_INTERVAL } from '@/config';

// =============================================================================
// Types
// =============================================================================

interface ConnectionStoreState {
  // BLE Environment (static - detected once at startup)
  bleEnvironment: BLEEnvironmentInfo;

  // Fleet of connected devices
  devices: Map<string, VoltraStoreApi>;

  // For single-device screens (workout tab, etc.)
  primaryDeviceId: string | null;

  // Scanning state
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];

  // Connection restoration state
  isRestoring: boolean;
  isReconnecting: boolean;

  // Connection in progress
  connectingDeviceId: string | null;

  // Error state
  error: string | null;

  // Preferences
  autoReconnectEnabled: boolean;

  // Auto-scan state
  autoScanEnabled: boolean;
  lastScanTime: number;

  // Actions - Scanning
  scan: (timeout?: number) => Promise<void>;
  stopScan: () => void;

  // Actions - Connection
  connectDevice: (device: DiscoveredDevice) => Promise<VoltraStoreApi>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;

  // Actions - Primary device
  setPrimaryDevice: (deviceId: string) => void;
  getPrimaryDevice: () => VoltraStoreApi | null;
  getDevice: (deviceId: string) => VoltraStoreApi | undefined;

  // Actions - Auto-reconnect
  restoreLastConnection: () => Promise<void>;
  setAutoReconnect: (enabled: boolean) => Promise<void>;

  // Actions - Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Actions - Auto-scan
  startAutoScan: () => () => void;

  // Lifecycle
  _setupAppStateListener: () => () => void;
  _handleAppStateChange: (state: AppStateStatus) => void;

  // Internal
  _manager: VoltraManager | null;
  _initManager: () => VoltraManager;
}

// =============================================================================
// Store
// =============================================================================

// Placeholder environment - will be replaced by selector
const PLACEHOLDER_ENVIRONMENT: BLEEnvironmentInfo = {
  environment: 'web',
  bleSupported: true,
  warningMessage: null,
  isWeb: true,
  requiresUserGesture: true,
};

export const useConnectionStore = create<ConnectionStoreState>()(
  devtools(
    (set, get) => ({
      // BLE Environment - placeholder, use selectBleEnvironment selector instead
      bleEnvironment: PLACEHOLDER_ENVIRONMENT,

      // State
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
      _manager: null,

      _initManager: () => {
        let manager = get()._manager;
        if (!manager) {
          const env = detectBLEEnvironment();

          if (env.environment === 'native') {
            manager = VoltraManager.forNative();
          } else if (env.environment === 'web') {
            manager = VoltraManager.forWeb();
          } else {
            manager = VoltraManager.forNode();
          }

          // Subscribe to manager events
          manager.subscribe((event) => {
            switch (event.type) {
              case 'scanStarted':
                set({ isScanning: true, error: null });
                break;

              case 'scanStopped':
                set({
                  isScanning: false,
                  discoveredDevices: event.devices,
                  lastScanTime: Date.now(),
                });
                break;

              case 'deviceDisconnected': {
                const { devices, primaryDeviceId } = get();
                const voltraStore = devices.get(event.deviceId);

                if (voltraStore) {
                  voltraStore.getState()._dispose();

                  set((state) => {
                    const newDevices = new Map(state.devices);
                    newDevices.delete(event.deviceId);
                    return {
                      devices: newDevices,
                      primaryDeviceId:
                        primaryDeviceId === event.deviceId ? null : state.primaryDeviceId,
                    };
                  });
                }
                break;
              }

              case 'deviceError':
                set({ error: event.error.message });
                break;
            }
          });

          set({ _manager: manager });
        }
        return manager;
      },

      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      scan: async (timeout = SCAN_DURATION) => {
        const { primaryDeviceId, devices } = get();
        const isConnected = primaryDeviceId && devices.has(primaryDeviceId);

        // Don't scan if connected
        if (isConnected) return;

        const manager = get()._initManager();
        set({ discoveredDevices: [], isScanning: true, error: null });

        try {
          const foundDevices = await manager.scan({ timeout });
          set({
            isScanning: false,
            discoveredDevices: foundDevices,
            lastScanTime: Date.now(),
          });
        } catch (e: unknown) {
          set({
            isScanning: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      },

      startAutoScan: () => {
        // On web, auto-scan is not possible - Web Bluetooth requires user gesture
        const env = detectBLEEnvironment();
        if (env.requiresUserGesture) {
          console.log('[ConnectionStore] Skipping auto-scan on web (requires user gesture)');
          return () => {}; // Return no-op cleanup
        }

        let intervalId: ReturnType<typeof setInterval> | null = null;

        const doScan = () => {
          const { primaryDeviceId, devices, isScanning } = get();
          const isConnected = primaryDeviceId && devices.has(primaryDeviceId);

          if (!isConnected && !isScanning) {
            get().scan();
          }
        };

        // Initial scan
        doScan();

        // Set up interval
        intervalId = setInterval(doScan, SCAN_INTERVAL);

        // Return cleanup function
        return () => {
          if (intervalId) {
            clearInterval(intervalId);
          }
        };
      },

      stopScan: () => {
        set({ isScanning: false });
      },

      connectDevice: async (device) => {
        const manager = get()._initManager();

        // Check if already connected
        const existing = get().devices.get(device.id);
        if (existing) {
          console.log('[ConnectionStore] Device already connected:', device.id);
          return existing;
        }

        console.log('[ConnectionStore] Connecting to:', device.name ?? device.id);

        // Track connecting state
        set({ connectingDeviceId: device.id, error: null });

        // Create voltra store (will add to devices map after connection succeeds)
        const voltraStore = createVoltraStore(null, device.id, device.name);
        voltraStore.getState().setConnectionState('connecting');

        try {
          // Connect via manager - handles auth and init
          voltraStore.getState().setConnectionState('authenticating');
          const client = await manager.connect(device);

          // Update store with client BEFORE adding to devices map
          // This prevents race condition where UI sees device but client is null
          voltraStore.getState()._setClient(client);
          voltraStore.getState().setConnectionState('connected');

          // NOW add to devices map - UI will see fully connected device
          set((state) => ({
            devices: new Map(state.devices).set(device.id, voltraStore),
            primaryDeviceId: state.primaryDeviceId ?? device.id,
          }));

          // Persist for auto-reconnect
          await saveLastDevice(device);

          console.log('[ConnectionStore] Connected successfully:', device.name ?? device.id);

          return voltraStore;
        } catch (e: unknown) {
          console.error('[ConnectionStore] Connection failed:', e);

          // Clean up the voltra store (never added to devices map since connection failed)
          const errMsg = e instanceof Error ? e.message : String(e);
          voltraStore.getState().setError(`Connection failed: ${errMsg}`);
          voltraStore.getState().setConnectionState('disconnected');
          voltraStore.getState()._dispose();

          // Categorize error for better UX
          if (errMsg.includes('timeout')) {
            set({ error: 'Connection timed out. Ensure Voltra is powered on.' });
          } else {
            set({ error: `Connection failed: ${errMsg}` });
          }

          throw e;
        } finally {
          set({ connectingDeviceId: null });
        }
      },

      disconnectDevice: async (deviceId) => {
        const manager = get()._manager;
        const voltra = get().devices.get(deviceId);

        if (!voltra) return;

        set({ error: null });

        try {
          // Disconnect via manager
          if (manager) {
            await manager.disconnect(deviceId);
          }
        } catch (e: unknown) {
          set({ error: `Disconnect failed: ${e instanceof Error ? e.message : String(e)}` });
        }

        // Cleanup voltra store
        voltra.getState()._dispose();

        // Remove from devices map
        set((state) => {
          const newDevices = new Map(state.devices);
          newDevices.delete(deviceId);
          return {
            devices: newDevices,
            primaryDeviceId: state.primaryDeviceId === deviceId ? null : state.primaryDeviceId,
          };
        });

        // Clear last device if it was this one
        const lastDevice = await getLastDevice();
        if (lastDevice?.id === deviceId) {
          await clearLastDevice();
        }
      },

      disconnectAll: async () => {
        const { devices } = get();
        for (const [deviceId] of devices) {
          await get().disconnectDevice(deviceId);
        }
      },

      setPrimaryDevice: (deviceId) => {
        if (get().devices.has(deviceId)) {
          set({ primaryDeviceId: deviceId });
        }
      },

      getPrimaryDevice: () => {
        const { devices, primaryDeviceId } = get();
        return primaryDeviceId ? (devices.get(primaryDeviceId) ?? null) : null;
      },

      getDevice: (deviceId) => {
        return get().devices.get(deviceId);
      },

      restoreLastConnection: async () => {
        // On web, auto-reconnect is not possible - Web Bluetooth requires user gesture
        const env = detectBLEEnvironment();
        if (env.requiresUserGesture) {
          console.log('[ConnectionStore] Skipping auto-reconnect on web (requires user gesture)');
          const autoReconnect = await isAutoReconnectEnabled();
          set({ autoReconnectEnabled: autoReconnect, isRestoring: false });
          return;
        }

        set({ isRestoring: true });

        // Add a timeout to prevent hanging forever
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Connection restore timeout')), 10000);
        });

        const restorePromise = async () => {
          try {
            const autoReconnect = await isAutoReconnectEnabled();
            set({ autoReconnectEnabled: autoReconnect });

            if (autoReconnect) {
              const lastDevice = await getLastDevice();
              if (lastDevice) {
                console.log(
                  '[ConnectionStore] Restoring connection to:',
                  lastDevice.name ?? lastDevice.id
                );
                try {
                  await get().connectDevice(lastDevice);
                } catch (e) {
                  console.warn('[ConnectionStore] Could not restore connection:', e);
                }
              } else {
                console.log('[ConnectionStore] No saved device to restore');
              }
            } else {
              console.log('[ConnectionStore] Auto-reconnect disabled');
            }
          } catch (e) {
            console.warn('[ConnectionStore] Error during restore:', e);
          }
        };

        try {
          await Promise.race([restorePromise(), timeoutPromise]);
        } catch (e) {
          console.warn('[ConnectionStore] Restore timed out or failed:', e);
        } finally {
          set({ isRestoring: false });
        }
      },

      setAutoReconnect: async (enabled) => {
        await setAutoReconnectEnabled(enabled);
        set({ autoReconnectEnabled: enabled });
      },

      _setupAppStateListener: () => {
        const subscription = AppState.addEventListener('change', (state) => {
          get()._handleAppStateChange(state);
        });
        return () => subscription.remove();
      },

      _handleAppStateChange: async (nextState) => {
        if (nextState === 'active') {
          const { primaryDeviceId, devices, autoReconnectEnabled, isReconnecting } = get();

          if (primaryDeviceId && autoReconnectEnabled && !isReconnecting) {
            const voltra = devices.get(primaryDeviceId);
            if (voltra && voltra.getState().connectionState === 'disconnected') {
              set({ isReconnecting: true });

              try {
                const lastDevice = await getLastDevice();
                if (lastDevice && lastDevice.id === primaryDeviceId) {
                  console.log('[ConnectionStore] Attempting reconnect...');
                  await get().connectDevice(lastDevice);
                }
              } catch (e) {
                console.warn('[ConnectionStore] Reconnect failed:', e);
              } finally {
                set({ isReconnecting: false });
              }
            }
          }
        }
      },
    }),
    { name: 'connection-store' }
  )
);

// =============================================================================
// Selectors
// =============================================================================
// Use these with useConnectionStore(selector) for proper reactivity.

/**
 * Get the BLE environment - always detects fresh to avoid SSR/caching issues.
 * Use this selector instead of accessing bleEnvironment directly.
 */
export const selectBleEnvironment = (): BLEEnvironmentInfo => {
  return detectBLEEnvironment();
};

/** Whether running on web */
export const selectIsWeb = () => selectBleEnvironment().isWeb;

/** Whether a device is connected */
export const selectIsConnected = (state: ConnectionStoreState) =>
  !!(state.primaryDeviceId && state.devices.has(state.primaryDeviceId));

/** Name of the connected device (primary) - requires getPrimaryDevice action */
export const selectConnectedDeviceName = (state: ConnectionStoreState) => {
  const device = state.primaryDeviceId ? state.devices.get(state.primaryDeviceId) : null;
  return device?.getState().deviceName ?? null;
};
