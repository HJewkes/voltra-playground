/**
 * Minimal react-native stub for vitest.
 *
 * React Native's index.js uses Flow syntax (`import typeof`) that
 * Node/Vite cannot parse. Domain tests don't render components but
 * transitively import RN via @titan-design/react-ui. This stub
 * satisfies the import chain with just enough API surface.
 *
 * Approach cribbed from vitest-react-native (sheremet-va/vitest-react-native)
 * but drastically simplified — we only need token resolution, not
 * full component rendering.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T | undefined =>
    obj.ios ?? obj.default,
  Version: 17,
  isPad: false,
  isTV: false,
  isTesting: true,
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style ?? {}),
  compose: (a: any, b: any) => [a, b],
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  set: () => {},
  addEventListener: () => ({ remove: () => {} }),
};

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size: number) => size * 2,
  roundToNearestPixel: (size: number) => Math.round(size * 2) / 2,
};

export const Appearance = {
  getColorScheme: () => 'dark' as const,
  setColorScheme: () => {},
  addChangeListener: () => ({ remove: () => {} }),
};

export const AccessibilityInfo = {
  isScreenReaderEnabled: async () => false,
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
  setAccessibilityFocus: () => {},
};

export const I18nManager = { isRTL: false, allowRTL: () => {}, forceRTL: () => {} };

export const NativeModules = {};
export const NativeEventEmitter = class {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {}
};

export const useWindowDimensions = () => ({ width: 375, height: 812, scale: 2, fontScale: 1 });
export const useColorScheme = () => 'dark' as const;
