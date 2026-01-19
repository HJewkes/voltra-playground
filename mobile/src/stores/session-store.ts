/**
 * Session Store
 * 
 * Singleton Zustand store that manages the fleet of connected Voltra devices.
 * Handles scanning, connection, and auto-reconnect logic.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, AppStateStatus } from 'react-native';
import { createBLEAdapter, defaultBLEConfig, BLEAdapter } from '@/ble';
import type { Device } from '@/ble/types';
import { Auth, Init, Timing } from '@/protocol';
import { preferencesRepository } from '@/data/repositories';
import { createVoltraStore, VoltraStoreApi, ConnectionState } from './voltra-store';

// =============================================================================
// Types
// =============================================================================

interface SessionState {
  // Fleet of connected devices
  devices: Map<string, VoltraStoreApi>;
  
  // For single-device screens (workout tab, etc.)
  primaryDeviceId: string | null;
  
  // Scanning state
  isScanning: boolean;
  discoveredDevices: Device[];
  
  // Connection restoration state
  isRestoring: boolean;
  isReconnecting: boolean;
  
  // Preferences
  autoReconnectEnabled: boolean;
  
  // Actions - Scanning
  scan: (timeout?: number) => Promise<void>;
  stopScan: () => void;
  
  // Actions - Connection
  connectDevice: (device: Device) => Promise<VoltraStoreApi>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  
  // Actions - Primary device
  setPrimaryDevice: (deviceId: string) => void;
  getPrimaryDevice: () => VoltraStoreApi | null;
  getDevice: (deviceId: string) => VoltraStoreApi | undefined;
  
  // Actions - Auto-reconnect
  restoreLastConnection: () => Promise<void>;
  setAutoReconnect: (enabled: boolean) => Promise<void>;
  
  // Lifecycle
  _setupAppStateListener: () => () => void;
  _handleAppStateChange: (state: AppStateStatus) => void;
  
  // Internal
  _adapter: BLEAdapter | null;
  _initAdapter: () => BLEAdapter;
}

// =============================================================================
// Store
// =============================================================================

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      devices: new Map(),
      primaryDeviceId: null,
      isScanning: false,
      discoveredDevices: [],
      isRestoring: false,
      isReconnecting: false,
      autoReconnectEnabled: true,
      _adapter: null,
      
      _initAdapter: () => {
        let adapter = get()._adapter;
        if (!adapter) {
          adapter = createBLEAdapter(defaultBLEConfig);
          set({ _adapter: adapter });
        }
        return adapter;
      },
      
      scan: async (timeout = 10000) => {
        const adapter = get()._initAdapter();
        
        set({ isScanning: true, discoveredDevices: [] });
        
        try {
          const devices = await adapter.scan(timeout / 1000); // Convert ms to seconds
          set({ discoveredDevices: devices });
        } finally {
          set({ isScanning: false });
        }
      },
      
      stopScan: () => {
        // BLE adapter doesn't have a stopScan method - scan completes after timeout
        set({ isScanning: false });
      },
      
      connectDevice: async (device) => {
        const adapter = get()._initAdapter();
        
        // Check if already connected
        const existing = get().devices.get(device.id);
        if (existing) {
          console.log('[SessionStore] Device already connected:', device.id);
          return existing;
        }
        
        console.log('[SessionStore] Connecting to:', device.name ?? device.id);
        
        // Create voltra store first (will update connection state)
        const voltraStore = createVoltraStore(null, device.id, device.name);
        voltraStore.getState().setConnectionState('connecting');
        
        // Add to devices map immediately
        set(state => ({
          devices: new Map(state.devices).set(device.id, voltraStore),
          primaryDeviceId: state.primaryDeviceId ?? device.id,
        }));
        
        try {
          // Connect adapter
          await adapter.connect(device.id);
          
          voltraStore.getState().setConnectionState('authenticating');
          
          // Authenticate (ported from BLEContext)
          await adapter.write(Auth.DEVICE_ID);
          await delay(Timing.AUTH_TIMEOUT_MS);
          
          // Send init sequence
          for (const cmd of Init.SEQUENCE) {
            await adapter.write(cmd);
            await delay(Timing.INIT_COMMAND_DELAY_MS);
          }
          
          // Set up notification handler
          adapter.onNotification((data) => {
            voltraStore.getState()._processNotification(data);
          });
          
          // Update store with adapter and connected state
          voltraStore.setState({ _adapter: adapter });
          voltraStore.getState().setConnectionState('connected');
          
          // Persist for auto-reconnect
          await preferencesRepository.saveLastDevice(device);
          
          console.log('[SessionStore] Connected successfully:', device.name ?? device.id);
          
          return voltraStore;
        } catch (e) {
          console.error('[SessionStore] Connection failed:', e);
          
          // Remove from devices map on failure
          set(state => {
            const devices = new Map(state.devices);
            devices.delete(device.id);
            return {
              devices,
              primaryDeviceId: state.primaryDeviceId === device.id ? null : state.primaryDeviceId,
            };
          });
          
          voltraStore.getState().setError(`Connection failed: ${e}`);
          voltraStore.getState().setConnectionState('disconnected');
          
          throw e;
        }
      },
      
      disconnectDevice: async (deviceId) => {
        const voltra = get().devices.get(deviceId);
        if (!voltra) return;
        
        const adapter = voltra.getState()._adapter;
        if (adapter) {
          await adapter.disconnect();
        }
        
        // Remove from devices map
        set(state => {
          const devices = new Map(state.devices);
          devices.delete(deviceId);
          return {
            devices,
            primaryDeviceId: state.primaryDeviceId === deviceId ? null : state.primaryDeviceId,
          };
        });
        
        // Clear last device if it was this one
        const lastDevice = await preferencesRepository.getLastDevice();
        if (lastDevice?.id === deviceId) {
          await preferencesRepository.clearLastDevice();
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
        return primaryDeviceId ? devices.get(primaryDeviceId) ?? null : null;
      },
      
      getDevice: (deviceId) => {
        return get().devices.get(deviceId);
      },
      
      restoreLastConnection: async () => {
        set({ isRestoring: true });
        
        // Add a timeout to prevent hanging forever
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Connection restore timeout')), 10000);
        });
        
        const restorePromise = async () => {
          try {
            const autoReconnect = await preferencesRepository.isAutoReconnectEnabled();
            set({ autoReconnectEnabled: autoReconnect });
            
            if (autoReconnect) {
              const lastDevice = await preferencesRepository.getLastDevice();
              if (lastDevice) {
                console.log('[SessionStore] Restoring connection to:', lastDevice.name ?? lastDevice.id);
                try {
                  await get().connectDevice(lastDevice);
                } catch (e) {
                  console.warn('[SessionStore] Could not restore connection:', e);
                }
              } else {
                console.log('[SessionStore] No saved device to restore');
              }
            } else {
              console.log('[SessionStore] Auto-reconnect disabled');
            }
          } catch (e) {
            console.warn('[SessionStore] Error during restore:', e);
          }
        };
        
        try {
          await Promise.race([restorePromise(), timeoutPromise]);
        } catch (e) {
          console.warn('[SessionStore] Restore timed out or failed:', e);
        } finally {
          set({ isRestoring: false });
        }
      },
      
      setAutoReconnect: async (enabled) => {
        await preferencesRepository.setAutoReconnectEnabled(enabled);
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
                const lastDevice = await preferencesRepository.getLastDevice();
                if (lastDevice && lastDevice.id === primaryDeviceId) {
                  console.log('[SessionStore] Attempting reconnect...');
                  await get().connectDevice(lastDevice);
                }
              } catch (e) {
                console.warn('[SessionStore] Reconnect failed:', e);
              } finally {
                set({ isReconnecting: false });
              }
            }
          }
        }
      },
    }),
    { name: 'session-store' }
  )
);

// =============================================================================
// Helpers
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
