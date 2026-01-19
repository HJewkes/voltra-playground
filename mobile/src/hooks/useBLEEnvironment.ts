/**
 * useBLEEnvironment
 * 
 * Detects the current environment and whether BLE will work.
 * - Simulator: BLE won't work
 * - Expo Go: BLE won't work (native module not included)
 * - Web: BLE works via relay only
 * - Native build on device: BLE works natively
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type BLEEnvironment = 
  | 'native'      // Real device with dev build - BLE works
  | 'simulator'   // iOS Simulator or Android Emulator - no BLE
  | 'expo-go'     // Expo Go app - no native BLE module
  | 'web';        // Web browser - uses relay

export interface BLEEnvironmentInfo {
  environment: BLEEnvironment;
  bleSupported: boolean;
  warningMessage: string | null;
}

export function useBLEEnvironment(): BLEEnvironmentInfo {
  // Web always uses relay
  if (Platform.OS === 'web') {
    return {
      environment: 'web',
      bleSupported: true, // Via relay
      warningMessage: null,
    };
  }
  
  // Check if running in Expo Go
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    return {
      environment: 'expo-go',
      bleSupported: false,
      warningMessage: 'Bluetooth is not available in Expo Go. Run "npx expo run:ios --device" to build with native BLE support.',
    };
  }
  
  // Check if running in simulator/emulator
  const isSimulator = !Device.isDevice;
  if (isSimulator) {
    return {
      environment: 'simulator',
      bleSupported: false,
      warningMessage: 'Bluetooth is not available in the simulator. Connect a physical device to test BLE.',
    };
  }
  
  // Native build on real device
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
  };
}

/**
 * Get BLE environment info synchronously (for non-hook contexts).
 */
export function getBLEEnvironment(): BLEEnvironmentInfo {
  if (Platform.OS === 'web') {
    return {
      environment: 'web',
      bleSupported: true,
      warningMessage: null,
    };
  }
  
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    return {
      environment: 'expo-go',
      bleSupported: false,
      warningMessage: 'Bluetooth is not available in Expo Go. Build with "npx expo run:ios --device" for native BLE.',
    };
  }
  
  const isSimulator = !Device.isDevice;
  if (isSimulator) {
    return {
      environment: 'simulator',
      bleSupported: false,
      warningMessage: 'Bluetooth is not available in the simulator.',
    };
  }
  
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
  };
}
