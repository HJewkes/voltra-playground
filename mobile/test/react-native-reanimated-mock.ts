/**
 * Minimal react-native-reanimated mock for Vitest unit tests.
 * Provides no-op implementations of animation primitives.
 */

export function useSharedValue<T>(initial: T): { value: T } {
  return { value: initial };
}

export function useAnimatedStyle(fn: () => Record<string, unknown>) {
  return fn();
}

export function withSpring<T>(value: T): T {
  return value;
}

export function withTiming<T>(value: T): T {
  return value;
}

export function interpolateColor(
  _value: number,
  _inputRange: number[],
  outputRange: string[],
): string {
  return outputRange[0] ?? 'transparent';
}

const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  createAnimatedComponent: (c: unknown) => c,
};

export default Animated;
