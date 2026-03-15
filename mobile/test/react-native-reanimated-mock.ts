/**
 * Minimal react-native-reanimated stub for vitest.
 *
 * Tests that import useAmbientColor (or any hook using Reanimated) hit this
 * stub. We expose enough surface to satisfy import-time resolution without
 * spinning up a UI runtime.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const useSharedValue = (init: any) => ({ value: init });
export const useAnimatedStyle = (fn: () => any) => fn();
export const withTiming = (value: any) => value;
export const interpolateColor = (_: number, __: number[], colors: string[]) => colors[0];

const Animated = {
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Image: 'Image',
  createAnimatedComponent: (c: any) => c,
};

export default Animated;
