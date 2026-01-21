/**
 * Connection Store
 * 
 * Singleton Zustand store that manages the fleet of connected Voltra devices.
 * Handles scanning, connection, auto-reconnect, relay status, and auto-scan logic.
 * 
 * Uses ScannerController for scanning operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { createBLEAdapter, ReplayBLEAdapter, type BLEAdapter, type Device } from '@/domain/bluetooth';
import type { SampleRecording } from '@/data/recordings';
import { Auth, Init, Timing, BLE, filterVoltraDevices } from '@/domain/voltra';
import {
  getLastDevice,
  saveLastDevice,
  clearLastDevice,
  isAutoReconnectEnabled,
  setAutoReconnectEnabled,
} from '@/data/preferences';
import { createVoltraStore, VoltraStoreApi, ConnectionState } from './voltra-store';
import { delay } from '@/domain/shared/utils';

// Domain imports
import { 
  ScannerController, 
  type ScannerConfig,
  type ScannerEvent,
  type RelayStatus,
} from '@/domain/bluetooth';
import { detectBLEEnvironment } from '@/domain/bluetooth/models/environment';

import {
  RELAY_HTTP_URL,
  RELAY_CHECK_TIMEOUT,
  RELAY_CHECK_INTERVAL,
  SCAN_DURATION,
  SCAN_INTERVAL,
} from '@/config';

// =============================================================================
// Types
// =============================================================================

export type { RelayStatus };

// Import BLEEnvironmentInfo type for the store
import type { BLEEnvironmentInfo } from '@/domain/bluetooth/models/environment';

interface ConnectionStoreState {
  // BLE Environment (static - detected once at startup)
  bleEnvironment: BLEEnvironmentInfo;
  
  // Fleet of connected devices
  devices: Map<string, VoltraStoreApi>;
  
  // For single-device screens (workout tab, etc.)
  primaryDeviceId: string | null;
  
  // Scanning state (synced from ScannerController)
  isScanning: boolean;
  discoveredDevices: Device[];
  
  // Connection restoration state
  isRestoring: boolean;
  isReconnecting: boolean;
  
  // Connection in progress
  connectingDeviceId: string | null;
  
  // Relay status (synced from ScannerController)
  relayStatus: RelayStatus;
  
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
  connectDevice: (device: Device) => Promise<VoltraStoreApi>;
  connectToReplay: (recording: SampleRecording) => Promise<VoltraStoreApi>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  
  // Actions - Primary device
  setPrimaryDevice: (deviceId: string) => void;
  getPrimaryDevice: () => VoltraStoreApi | null;
  getDevice: (deviceId: string) => VoltraStoreApi | undefined;
  
  // Actions - Auto-reconnect
  restoreLastConnection: () => Promise<void>;
  setAutoReconnect: (enabled: boolean) => Promise<void>;
  
  // Actions - Relay status
  checkRelayStatus: () => Promise<void>;
  
  // Actions - Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Actions - Auto-scan
  startAutoScan: () => () => void;
  
  // Lifecycle
  _setupAppStateListener: () => () => void;
  _handleAppStateChange: (state: AppStateStatus) => void;
  
  // Internal
  _adapter: BLEAdapter | null;
  _scanner: ScannerController | null;
  _initAdapter: () => BLEAdapter;
  _initScanner: () => ScannerController;
}

// =============================================================================
// Scanner Configuration
// =============================================================================

const scannerConfig: ScannerConfig = {
  scanDurationMs: SCAN_DURATION,
  scanIntervalMs: SCAN_INTERVAL,
  relayCheckTimeoutMs: RELAY_CHECK_TIMEOUT,
  relayCheckIntervalMs: RELAY_CHECK_INTERVAL,
  relayHttpUrl: RELAY_HTTP_URL,
};

// =============================================================================
// Store
// =============================================================================

// Detect environment once at module load
const bleEnvironment = detectBLEEnvironment();

export const useConnectionStore = create<ConnectionStoreState>()(
  devtools(
    (set, get) => ({
      // BLE Environment (static)
      bleEnvironment,
      
      // State
      devices: new Map(),
      primaryDeviceId: null,
      isScanning: false,
      discoveredDevices: [],
      isRestoring: false,
      isReconnecting: false,
      connectingDeviceId: null,
      relayStatus: bleEnvironment.isWeb ? 'checking' : 'connected',
      error: null,
      autoReconnectEnabled: true,
      autoScanEnabled: true,
      lastScanTime: 0,
      _adapter: null,
      _scanner: null,
      
      _initAdapter: () => {
        let adapter = get()._adapter;
        if (!adapter) {
          adapter = createBLEAdapter({
            ble: {
              serviceUUID: BLE.SERVICE_UUID,
              notifyCharUUID: BLE.NOTIFY_CHAR_UUID,
              writeCharUUID: BLE.WRITE_CHAR_UUID,
              deviceNamePrefix: BLE.DEVICE_NAME_PREFIX,
            },
          });
          set({ _adapter: adapter });
        }
        return adapter;
      },
      
      _initScanner: () => {
        let scanner = get()._scanner;
        if (!scanner) {
          const adapter = get()._initAdapter();
          const environment = detectBLEEnvironment();
          scanner = new ScannerController(adapter, environment, scannerConfig, filterVoltraDevices);
          
          // Subscribe to scanner events
          scanner.subscribe((event: ScannerEvent) => {
            switch (event.type) {
              case 'scanStarted':
                set({ isScanning: true, error: null });
                break;
              
              case 'scanCompleted':
                set({ 
                  isScanning: false, 
                  discoveredDevices: event.devices as Device[],
                  lastScanTime: Date.now(),
                });
                break;
              
              case 'scanFailed':
                set({ isScanning: false, error: event.error });
                break;
              
              case 'relayStatusChanged':
                set({ relayStatus: event.status });
                break;
            }
          });
          
          set({ _scanner: scanner });
        }
        return scanner;
      },
      
      checkRelayStatus: async () => {
        const scanner = get()._initScanner();
        await scanner.checkRelayStatus();
      },
      
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      scan: async () => {
        const { primaryDeviceId, devices } = get();
        const isConnected = primaryDeviceId && devices.has(primaryDeviceId);
        
        // Don't scan if connected
        if (isConnected) return;
        
        const scanner = get()._initScanner();
        set({ discoveredDevices: [] });
        await scanner.scan();
      },
      
      startAutoScan: () => {
        const scanner = get()._initScanner();
        
        // Provide isConnected callback to scanner
        const isConnected = () => {
          const { primaryDeviceId, devices } = get();
          return !!(primaryDeviceId && devices.has(primaryDeviceId));
        };
        
        return scanner.startAutoScan(isConnected);
      },
      
      stopScan: () => {
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
        
        // Track connecting state
        set({ connectingDeviceId: device.id, error: null });
        
        // Create voltra store first (will update connection state)
        const voltraStore = createVoltraStore(null, device.id, device.name);
        voltraStore.getState().setConnectionState('connecting');
        
        // Add to devices map immediately
        set(state => ({
          devices: new Map(state.devices).set(device.id, voltraStore),
          primaryDeviceId: state.primaryDeviceId ?? device.id,
        }));
        
        try {
          // Connect adapter with immediate auth write
          // The Voltra device requires authentication within a tight time window
          // after connection, so we pass it as an immediate write option
          voltraStore.getState().setConnectionState('authenticating');
          await adapter.connect(device.id, { immediateWrite: Auth.DEVICE_ID });
          
          // Wait for device to process authentication
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
          voltraStore.getState()._setAdapter(adapter);
          voltraStore.getState().setConnectionState('connected');
          
          // Persist for auto-reconnect
          await saveLastDevice(device);
          
          console.log('[SessionStore] Connected successfully:', device.name ?? device.id);
          
          return voltraStore;
        } catch (e: any) {
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
          voltraStore.getState()._dispose();
          
          // Categorize error for better UX
          const errorMsg = e?.message || String(e);
          if (errorMsg.includes('WebSocket') || errorMsg.includes('relay')) {
            set({ error: 'Cannot connect to BLE relay. Run "make relay" in terminal.' });
          } else if (errorMsg.includes('timeout')) {
            set({ error: 'Connection timed out. Ensure Voltra is powered on.' });
          } else {
            set({ error: `Connection failed: ${errorMsg}` });
          }
          
          throw e;
        } finally {
          set({ connectingDeviceId: null });
        }
      },
      
      connectToReplay: async (recording) => {
        const replayDeviceId = `replay-${recording.id}`;
        const replayDeviceName = `Replay: ${recording.exerciseName}`;
        
        // Check if already connected to this replay
        const existing = get().devices.get(replayDeviceId);
        if (existing) {
          console.log('[SessionStore] Replay already connected:', replayDeviceId);
          return existing;
        }
        
        console.log('[SessionStore] Connecting to replay:', recording.exerciseName);
        
        // Track connecting state
        set({ connectingDeviceId: replayDeviceId, error: null });
        
        try {
          // Create replay adapter
          const replayAdapter = new ReplayBLEAdapter(recording);
          
          // Create voltra store with replay adapter
          const voltraStore = createVoltraStore(replayAdapter, replayDeviceId, replayDeviceName);
          
          // Connect the replay adapter
          await replayAdapter.connect(replayDeviceId);
          
          // Set up notification handler
          replayAdapter.onNotification((data) => {
            voltraStore.getState()._processNotification(data);
          });
          
          // Update store state
          voltraStore.getState().setConnectionState('connected');
          
          // Add to devices map
          set(state => ({
            devices: new Map(state.devices).set(replayDeviceId, voltraStore),
            primaryDeviceId: replayDeviceId,
          }));
          
          console.log('[SessionStore] Replay connected, starting playback...');
          
          // Start playback
          replayAdapter.play();
          
          return voltraStore;
        } catch (e: any) {
          console.error('[SessionStore] Replay connection failed:', e);
          set({ error: `Replay failed: ${e?.message || e}` });
          throw e;
        } finally {
          set({ connectingDeviceId: null });
        }
      },
      
      disconnectDevice: async (deviceId) => {
        const voltra = get().devices.get(deviceId);
        if (!voltra) return;
        
        set({ error: null });
        
        const adapter = voltra.getState()._adapter;
        if (adapter) {
          try {
            await adapter.disconnect();
          } catch (e: any) {
            set({ error: `Disconnect failed: ${e?.message || e}` });
          }
        }
        
        // Cleanup voltra store
        voltra.getState()._dispose();
        
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
            const autoReconnect = await isAutoReconnectEnabled();
            set({ autoReconnectEnabled: autoReconnect });
            
            if (autoReconnect) {
              const lastDevice = await getLastDevice();
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
    { name: 'connection-store' }
  )
);

// =============================================================================
// Selectors
// =============================================================================
// Use these with useConnectionStore(selector) for proper reactivity.
// Do NOT use the getters pattern (get isX() { return get()... }) as Zustand
// cannot track those for re-renders.

/** Whether running on web */
export const selectIsWeb = (state: ConnectionStoreState) => 
  state.bleEnvironment.isWeb;

/** Whether a device is connected */
export const selectIsConnected = (state: ConnectionStoreState) => 
  !!(state.primaryDeviceId && state.devices.has(state.primaryDeviceId));

/** Name of the connected device (primary) - requires getPrimaryDevice action */
export const selectConnectedDeviceName = (state: ConnectionStoreState) => {
  const device = state.primaryDeviceId ? state.devices.get(state.primaryDeviceId) : null;
  return device?.getState().deviceName ?? null;
};

/** Whether relay is required but not ready */
export const selectRelayNotReady = (state: ConnectionStoreState) => 
  state.bleEnvironment.isWeb && state.relayStatus !== 'connected';
