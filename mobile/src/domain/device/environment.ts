// =============================================================================
// Environment Detection
// =============================================================================

export interface BLEEnvironmentInfo {
  environment: 'native' | 'web' | 'node';
  bleSupported: boolean;
  warningMessage: string | null;
  isWeb: boolean;
  requiresUserGesture: boolean;
  forceMock: boolean;
}

/**
 * Detect the current BLE environment and capabilities.
 * Append ?mock to the URL to force the mock adapter (useful for Playwright / visual dev).
 */
export function detectBLEEnvironment(): BLEEnvironmentInfo {
  // React Native MUST be checked first: it defines both `window` and
  // `navigator`, so the browser check below matches on a real device and
  // wrongly selects the Web Bluetooth adapter. RN sets
  // `navigator.product === 'ReactNative'`; browsers report 'Gecko'.
  if (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { product?: string }).product === 'ReactNative'
  ) {
    return {
      environment: 'native',
      bleSupported: true,
      warningMessage: null,
      isWeb: false,
      requiresUserGesture: false,
      forceMock: false,
    };
  }

  // Check for browser environment
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const forceMock = new URLSearchParams(window.location?.search).has('mock');
    const hasWebBluetooth = 'bluetooth' in navigator;
    return {
      environment: 'web',
      bleSupported: forceMock || hasWebBluetooth,
      warningMessage:
        !forceMock && !hasWebBluetooth ? 'Web Bluetooth is not supported in this browser' : null,
      isWeb: true,
      requiresUserGesture: !forceMock && hasWebBluetooth,
      forceMock,
    };
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return {
      environment: 'node',
      bleSupported: true,
      warningMessage: null,
      isWeb: false,
      requiresUserGesture: false,
      forceMock: false,
    };
  }

  // Default to native (React Native)
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
    forceMock: false,
  };
}
