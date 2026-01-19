/**
 * Preferences Models
 * 
 * User preferences and device state models.
 */

/**
 * A BLE device reference for storage.
 */
export interface Device {
  /** Device identifier (BLE address/UUID) */
  id: string;
  
  /** Device name (e.g., "VTR-1234") */
  name: string | null;
  
  /** Last known RSSI (signal strength) */
  rssi: number | null;
}

/**
 * Saved connection info for auto-reconnect.
 */
export interface SavedConnection {
  /** The device that was connected */
  device: Device;
  
  /** When the connection was saved */
  connectedAt: number;
}

/**
 * User preferences.
 */
export interface UserPreferences {
  /** Whether to auto-reconnect on app launch */
  autoReconnect: boolean;
  
  /** Preferred units (lbs or kg) */
  weightUnit: 'lbs' | 'kg';
  
  /** Default training goal */
  defaultGoal: 'strength' | 'hypertrophy' | 'endurance';
  
  /** Whether to show advanced metrics */
  showAdvancedMetrics: boolean;
  
  /** Default rest period between sets (seconds) */
  defaultRestPeriod: number;
  
  /** Whether to vibrate on rep complete */
  hapticFeedback: boolean;
}

/**
 * Default user preferences.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  autoReconnect: true,
  weightUnit: 'lbs',
  defaultGoal: 'hypertrophy',
  showAdvancedMetrics: true,
  defaultRestPeriod: 90,
  hapticFeedback: true,
};
