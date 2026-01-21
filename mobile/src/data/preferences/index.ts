/**
 * Preferences Data Module
 *
 * Storage layer for device and connection preferences.
 */

// Schema types
export type { Device } from './preferences-schema';

// Storage functions
export {
  getLastDevice,
  saveLastDevice,
  clearLastDevice,
  isAutoReconnectEnabled,
  setAutoReconnectEnabled,
} from './preferences-storage';
