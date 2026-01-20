/**
 * Scanner Controller
 * 
 * Manages BLE device scanning with auto-scan and relay status checking.
 * This is a generic controller that can be configured with a device filter.
 */

import type { BLEAdapter } from '@/domain/bluetooth/adapters';
import { DiscoveredDevice } from '@/domain/bluetooth/models/device';
import { BLEEnvironmentInfo, requiresRelay } from '@/domain/bluetooth/models/environment';

/**
 * Device filter function type.
 * Used to filter discovered devices (e.g., by name prefix).
 */
export type DeviceFilter = (devices: DiscoveredDevice[]) => DiscoveredDevice[];

/**
 * Relay status for web environments.
 */
export type RelayStatus = 'checking' | 'connected' | 'disconnected' | 'error';

/**
 * Scanner state snapshot.
 */
export interface ScannerState {
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];
  relayStatus: RelayStatus;
  lastScanTime: number;
  error: string | null;
}

/**
 * Scanner event types.
 */
export type ScannerEvent = 
  | { type: 'scanStarted' }
  | { type: 'scanCompleted'; devices: DiscoveredDevice[] }
  | { type: 'scanFailed'; error: string }
  | { type: 'relayStatusChanged'; status: RelayStatus };

/**
 * Scanner event listener.
 */
export type ScannerEventListener = (event: ScannerEvent) => void;

/**
 * Scanner configuration.
 */
export interface ScannerConfig {
  scanDurationMs: number;
  scanIntervalMs: number;
  relayCheckTimeoutMs: number;
  relayCheckIntervalMs: number;
  relayHttpUrl: string;
}

/**
 * Controller for BLE device scanning.
 */
export class ScannerController {
  private _isScanning = false;
  private _discoveredDevices: DiscoveredDevice[] = [];
  private _relayStatus: RelayStatus = 'checking';
  private _lastScanTime = 0;
  private _error: string | null = null;
  
  private _autoScanInterval: ReturnType<typeof setInterval> | null = null;
  private _relayCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _listeners: Set<ScannerEventListener> = new Set();
  
  constructor(
    private adapter: BLEAdapter,
    private environment: BLEEnvironmentInfo,
    private config: ScannerConfig,
    private deviceFilter?: DeviceFilter,
  ) {
    // Set initial relay status based on environment
    this._relayStatus = requiresRelay(this.environment) ? 'checking' : 'connected';
  }
  
  /**
   * Get current scanner state.
   */
  getState(): ScannerState {
    return {
      isScanning: this._isScanning,
      discoveredDevices: this._discoveredDevices,
      relayStatus: this._relayStatus,
      lastScanTime: this._lastScanTime,
      error: this._error,
    };
  }
  
  /**
   * Subscribe to scanner events.
   */
  subscribe(listener: ScannerEventListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  
  private emit(event: ScannerEvent): void {
    this._listeners.forEach(listener => listener(event));
  }
  
  /**
   * Scan for devices.
   */
  async scan(): Promise<DiscoveredDevice[]> {
    // Don't scan if already scanning
    if (this._isScanning) {
      return this._discoveredDevices;
    }
    
    // Don't scan if relay not ready on web
    if (requiresRelay(this.environment) && this._relayStatus !== 'connected') {
      this._error = 'BLE relay not running. Start with "make relay".';
      return [];
    }
    
    this._isScanning = true;
    this._error = null;
    this.emit({ type: 'scanStarted' });
    
    try {
      const devices = await this.adapter.scan(this.config.scanDurationMs / 1000);
      // Apply device filter if provided, otherwise return all devices
      const filteredDevices = this.deviceFilter 
        ? this.deviceFilter(devices as DiscoveredDevice[])
        : devices as DiscoveredDevice[];
      
      this._discoveredDevices = filteredDevices;
      this._lastScanTime = Date.now();
      this._isScanning = false;
      
      this.emit({ type: 'scanCompleted', devices: filteredDevices });
      return filteredDevices;
    } catch (e: any) {
      this._isScanning = false;
      const errorMsg = e?.message || String(e);
      
      // Categorize errors
      if (errorMsg.includes('WebSocket') || errorMsg.includes('Failed to connect')) {
        this._relayStatus = 'disconnected';
        this._error = 'BLE relay not running. Start with "make relay".';
        this.emit({ type: 'relayStatusChanged', status: 'disconnected' });
      } else if (errorMsg.includes('permission') || errorMsg.includes('Unauthorized')) {
        this._error = 'Bluetooth permission required. Please enable in Settings.';
      } else if (errorMsg.includes('Timeout') || errorMsg.includes('PoweredOff')) {
        this._error = 'Please enable Bluetooth on your device.';
      } else {
        this._error = `Scan failed: ${errorMsg}`;
      }
      
      this.emit({ type: 'scanFailed', error: this._error });
      return [];
    }
  }
  
  /**
   * Check relay status (web only).
   */
  async checkRelayStatus(): Promise<RelayStatus> {
    if (!requiresRelay(this.environment)) {
      this._relayStatus = 'connected';
      return 'connected';
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(), 
        this.config.relayCheckTimeoutMs
      );
      
      const response = await fetch(
        `${this.config.relayHttpUrl}/`, 
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      
      const newStatus: RelayStatus = response.ok ? 'connected' : 'error';
      if (newStatus !== this._relayStatus) {
        this._relayStatus = newStatus;
        this.emit({ type: 'relayStatusChanged', status: newStatus });
      }
      return newStatus;
    } catch {
      if (this._relayStatus !== 'disconnected') {
        this._relayStatus = 'disconnected';
        this.emit({ type: 'relayStatusChanged', status: 'disconnected' });
      }
      return 'disconnected';
    }
  }
  
  /**
   * Start auto-scanning.
   * Returns cleanup function.
   */
  startAutoScan(isConnected: () => boolean): () => void {
    // Clear existing intervals
    this.stopAutoScan();
    
    // Check relay status immediately and periodically
    this.checkRelayStatus();
    this._relayCheckInterval = setInterval(
      () => this.checkRelayStatus(), 
      this.config.relayCheckIntervalMs
    );
    
    // Initial scan after short delay
    setTimeout(() => {
      if ((this._relayStatus === 'connected' || !requiresRelay(this.environment)) && !isConnected()) {
        this.scan();
      }
    }, 500);
    
    // Periodic auto-scan when not connected
    this._autoScanInterval = setInterval(() => {
      if (!this._isScanning && !isConnected()) {
        this.scan();
      }
    }, this.config.scanIntervalMs);
    
    return () => this.stopAutoScan();
  }
  
  /**
   * Stop auto-scanning.
   */
  stopAutoScan(): void {
    if (this._autoScanInterval) {
      clearInterval(this._autoScanInterval);
      this._autoScanInterval = null;
    }
    if (this._relayCheckInterval) {
      clearInterval(this._relayCheckInterval);
      this._relayCheckInterval = null;
    }
  }
  
  /**
   * Clear error state.
   */
  clearError(): void {
    this._error = null;
  }
  
  /**
   * Cleanup resources.
   */
  dispose(): void {
    this.stopAutoScan();
    this._listeners.clear();
  }
}
