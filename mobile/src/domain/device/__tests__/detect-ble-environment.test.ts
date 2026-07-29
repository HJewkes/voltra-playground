import { describe, it, expect, afterEach } from 'vitest';
import { detectBLEEnvironment } from '../environment';

describe('detectBLEEnvironment', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalProcess = globalThis.process;

  afterEach(() => {
    // Restore globals
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'process', { value: originalProcess, configurable: true });
  });

  /**
   * Regression (2026-07-28, found on a physical iPhone): React Native
   * defines BOTH `window` and `navigator`, so the browser check matched on
   * device and the app selected the Web Bluetooth adapter — surfacing as
   * "Web Bluetooth not supported in this browser" with no BLE prompt and a
   * scan that never started. RN must be detected before the browser branch.
   */
  describe('react native environment', () => {
    function setupReactNativeGlobals() {
      // RN provides window and navigator, and navigator.product is 'ReactNative'.
      Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
      Object.defineProperty(globalThis, 'navigator', {
        value: { product: 'ReactNative' },
        configurable: true,
      });
    }

    it('detects native even though window and navigator are defined', () => {
      setupReactNativeGlobals();

      const env = detectBLEEnvironment();
      expect(env.environment).toBe('native');
      expect(env.isWeb).toBe(false);
      expect(env.bleSupported).toBe(true);
      expect(env.warningMessage).toBeNull();
      expect(env.requiresUserGesture).toBe(false);
    });

    it('takes precedence over the node check', () => {
      // A RN bundle can still expose a `process` shim; native must win.
      setupReactNativeGlobals();
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '20.0.0' } },
        configurable: true,
      });

      expect(detectBLEEnvironment().environment).toBe('native');
    });
  });

  describe('node environment', () => {
    it('detects node when process.versions.node is defined', () => {
      // Vitest runs in Node, so default detection should work
      // But window may be defined by jsdom/happy-dom — remove it
      Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

      const env = detectBLEEnvironment();
      expect(env.environment).toBe('node');
      expect(env.bleSupported).toBe(true);
      expect(env.requiresUserGesture).toBe(false);
      expect(env.forceMock).toBe(false);
    });
  });

  describe('web environment', () => {
    function setupWebGlobals(options: { hasBluetooth?: boolean; search?: string } = {}) {
      const { hasBluetooth = false, search = '' } = options;

      const mockNavigator: Record<string, unknown> = {};
      if (hasBluetooth) {
        mockNavigator.bluetooth = {};
      }

      Object.defineProperty(globalThis, 'window', {
        value: { location: { search } },
        configurable: true,
      });
      Object.defineProperty(globalThis, 'navigator', {
        value: mockNavigator,
        configurable: true,
      });
    }

    it('detects web with bluetooth', () => {
      setupWebGlobals({ hasBluetooth: true });

      const env = detectBLEEnvironment();
      expect(env.environment).toBe('web');
      expect(env.bleSupported).toBe(true);
      expect(env.isWeb).toBe(true);
      expect(env.requiresUserGesture).toBe(true);
      expect(env.forceMock).toBe(false);
      expect(env.warningMessage).toBeNull();
    });

    it('detects web without bluetooth', () => {
      setupWebGlobals({ hasBluetooth: false });

      const env = detectBLEEnvironment();
      expect(env.environment).toBe('web');
      expect(env.bleSupported).toBe(false);
      expect(env.requiresUserGesture).toBe(false);
      expect(env.forceMock).toBe(false);
      expect(env.warningMessage).toBe('Web Bluetooth is not supported in this browser');
    });

    describe('?mock query parameter', () => {
      it('sets forceMock when ?mock is present', () => {
        setupWebGlobals({ hasBluetooth: true, search: '?mock' });

        const env = detectBLEEnvironment();
        expect(env.forceMock).toBe(true);
      });

      it('overrides requiresUserGesture to false', () => {
        setupWebGlobals({ hasBluetooth: true, search: '?mock' });

        const env = detectBLEEnvironment();
        expect(env.requiresUserGesture).toBe(false);
      });

      it('sets bleSupported to true even without bluetooth API', () => {
        setupWebGlobals({ hasBluetooth: false, search: '?mock' });

        const env = detectBLEEnvironment();
        expect(env.bleSupported).toBe(true);
      });

      it('clears warning message', () => {
        setupWebGlobals({ hasBluetooth: false, search: '?mock' });

        const env = detectBLEEnvironment();
        expect(env.warningMessage).toBeNull();
      });

      it('works with other query params present', () => {
        setupWebGlobals({ hasBluetooth: true, search: '?debug=true&mock&foo=bar' });

        const env = detectBLEEnvironment();
        expect(env.forceMock).toBe(true);
        expect(env.requiresUserGesture).toBe(false);
      });

      it('does not activate for similar param names', () => {
        setupWebGlobals({ hasBluetooth: true, search: '?mockDevice=true' });

        const env = detectBLEEnvironment();
        // URLSearchParams.has('mock') is false when the key is 'mockDevice'
        expect(env.forceMock).toBe(false);
        expect(env.requiresUserGesture).toBe(true);
      });
    });
  });
});
