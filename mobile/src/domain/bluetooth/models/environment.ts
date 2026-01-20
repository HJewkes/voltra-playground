/**
 * Bluetooth Environment Model
 * 
 * Detects the current environment and BLE capabilities.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * BLE environment types.
 */
export type BLEEnvironment = 
  | 'native'      // Real device with dev build - BLE works
  | 'simulator'   // iOS Simulator or Android Emulator - no BLE
  | 'expo-go'     // Expo Go app - no native BLE module
  | 'web';        // Web browser - uses relay

/**
 * BLE environment information.
 */
export interface BLEEnvironmentInfo {
  /** Current environment type */
  environment: BLEEnvironment;
  /** Whether BLE is supported in this environment */
  bleSupported: boolean;
  /** Warning message if BLE is not supported */
  warningMessage: string | null;
  /** Whether this is running on web */
  isWeb: boolean;
}

/**
 * Warning messages for unsupported environments.
 */
const WARNING_MESSAGES: Partial<Record<BLEEnvironment, string>> = {
  'expo-go': 'Bluetooth is not available in Expo Go. Run "npx expo run:ios --device" to build with native BLE support.',
  'simulator': 'Bluetooth is not available in the simulator. Connect a physical device to test BLE.',
};

/**
 * Detect the current BLE environment.
 * 
 * This is a pure function with no React dependencies.
 */
export function detectBLEEnvironment(): BLEEnvironmentInfo {
  const isWeb = Platform.OS === 'web';
  
  // Web always uses relay
  if (isWeb) {
    return {
      environment: 'web',
      bleSupported: true, // Via relay
      warningMessage: null,
      isWeb: true,
    };
  }
  
  // Check if running in Expo Go
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    return {
      environment: 'expo-go',
      bleSupported: false,
      warningMessage: WARNING_MESSAGES['expo-go']!,
      isWeb: false,
    };
  }
  
  // Check if running in simulator/emulator
  const isSimulator = !Device.isDevice;
  if (isSimulator) {
    return {
      environment: 'simulator',
      bleSupported: false,
      warningMessage: WARNING_MESSAGES['simulator']!,
      isWeb: false,
    };
  }
  
  // Native build on real device
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
  };
}

/**
 * Check if BLE requires a relay (web environment).
 */
export function requiresRelay(env: BLEEnvironmentInfo): boolean {
  return env.environment === 'web';
}

/**
 * Check if BLE is available in the current environment.
 */
export function isBLEAvailable(env: BLEEnvironmentInfo): boolean {
  return env.bleSupported;
}
