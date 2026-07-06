/**
 * useAmbientColor
 *
 * Returns a Reanimated animated style with a background tint that reflects
 * current velocity quality. Color shifts smoothly between thresholds:
 *   0%  loss → green  (#22c55e, fades to transparent — no tint needed)
 *   20% loss → yellow (#eab308)
 *   35%+ loss → red   (#ef4444)
 *
 * Intended for subtle, ambient feedback — opacity stays in 0.08–0.12 range.
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

/** Opacity of the ambient tint at maximum loss */
const MAX_TINT_OPACITY = 0.1;

/** Transition speed in ms — smooth but not sluggish */
const TRANSITION_MS = 600;

/**
 * Maps velocity loss (0–∞) to a 0–1 progress value.
 * 0 = green (0% loss), ~0.57 = yellow (20% loss), 1 = red (35%+ loss).
 *
 * Exported for unit tests.
 */
export function lossToProgress(velocityLoss: number): number {
  'worklet';
  const LOSS_RED = 0.35;
  return Math.max(0, Math.min(velocityLoss / LOSS_RED, 1));
}

/**
 * Hook that returns an animated style for the ambient velocity color overlay.
 *
 * @param velocityLoss - fraction of velocity lost (0 = none, 0.35+ = max red)
 * @param active       - whether a set is currently in progress
 */
export function useAmbientColor(velocityLoss: number, active: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = active ? lossToProgress(velocityLoss) : 0;
    progress.value = withTiming(target, { duration: TRANSITION_MS });
  }, [velocityLoss, active, progress]);

  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.57, 1], // 0 → ~20% loss → 35%+ loss
      ['#22c55e', '#eab308', '#ef4444']
    ),
    opacity: progress.value * MAX_TINT_OPACITY,
  }));
}
