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
  | 'native' // Real device with dev build - BLE works
  | 'simulator' // iOS Simulator or Android Emulator - no BLE
  | 'expo-go' // Expo Go app - no native BLE module
  | 'web' // Web browser - uses Web Bluetooth API
  | 'node'; // Node.js - uses webbluetooth npm package

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
  /** Whether scanning requires a user gesture (click/tap) - true for Web Bluetooth */
  requiresUserGesture: boolean;
}

/**
 * Warning messages for unsupported environments.
 */
const WARNING_MESSAGES: Partial<Record<BLEEnvironment, string>> = {
  'expo-go':
    'Bluetooth is not available in Expo Go. Run "npx expo run:ios --device" to build with native BLE support.',
  simulator: 'Bluetooth is not available in the simulator. Connect a physical device to test BLE.',
};

/**
 * Detect the current BLE environment.
 *
 * This is a pure function with no React dependencies.
 */
export function detectBLEEnvironment(): BLEEnvironmentInfo {
  // Check for browser environment first (window and document exist)
  // This is the most reliable check for web browsers
  const isBrowser =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined';

  // Platform.OS check as secondary confirmation
  const platformIsWeb = Platform.OS === 'web';

  // Web browser: either Platform says web OR we detect browser globals
  // Use isBrowser as primary since Platform.OS can be unreliable during SSR/bundling
  if (isBrowser || platformIsWeb) {
    // Double-check we're actually in a browser (not Node with jsdom)
    const hasNavigator = typeof navigator !== 'undefined' && navigator.userAgent !== undefined;
    if (hasNavigator || platformIsWeb) {
      return {
        environment: 'web',
        bleSupported: true, // Via Web Bluetooth API
        warningMessage: null,
        isWeb: true,
        requiresUserGesture: true, // Web Bluetooth requires user gesture for requestDevice()
      };
    }
  }

  // Check for Node.js environment (no real browser, has process.versions.node)
  const isNode =
    !isBrowser &&
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null;

  if (isNode) {
    return {
      environment: 'node',
      bleSupported: true, // Via webbluetooth npm package
      warningMessage: null,
      isWeb: false,
      requiresUserGesture: false,
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
      requiresUserGesture: false,
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
      requiresUserGesture: false,
    };
  }

  // Native build on real device
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
  };
}

/**
 * Check if BLE is available in the current environment.
 */
export function isBLEAvailable(env: BLEEnvironmentInfo): boolean {
  return env.bleSupported;
}
