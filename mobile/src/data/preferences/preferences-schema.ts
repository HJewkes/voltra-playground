/**
 * Preferences Schema
 * 
 * Device and preferences data structures.
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
