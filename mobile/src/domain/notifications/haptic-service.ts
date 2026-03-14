/**
 * Haptic Feedback Service
 *
 * Wraps expo-haptics with platform detection.
 * Gracefully degrades on platforms without haptic support (web).
 */

import { Platform } from 'react-native';

export type HapticIntensity = 'light' | 'medium' | 'heavy';

let hapticsModule: typeof import('expo-haptics') | null = null;
let hapticsSupported = false;

/**
 * Initialize haptics module lazily.
 * On web or unsupported platforms, haptics silently become no-ops.
 */
async function ensureModule(): Promise<typeof import('expo-haptics') | null> {
  if (hapticsModule) return hapticsModule;

  if (Platform.OS === 'web') {
    hapticsSupported = false;
    return null;
  }

  try {
    hapticsModule = await import('expo-haptics');
    hapticsSupported = true;
    return hapticsModule;
  } catch {
    hapticsSupported = false;
    return null;
  }
}

/**
 * Trigger haptic feedback at the given intensity.
 */
export async function triggerHaptic(intensity: HapticIntensity): Promise<void> {
  const mod = await ensureModule();
  if (!mod) return;

  const style =
    intensity === 'light'
      ? mod.ImpactFeedbackStyle.Light
      : intensity === 'medium'
        ? mod.ImpactFeedbackStyle.Medium
        : mod.ImpactFeedbackStyle.Heavy;

  await mod.impactAsync(style);
}

/**
 * Trigger a notification-style haptic (used for rest-complete).
 */
export async function triggerNotificationHaptic(
  type: 'success' | 'warning' | 'error'
): Promise<void> {
  const mod = await ensureModule();
  if (!mod) return;

  const feedbackType =
    type === 'success'
      ? mod.NotificationFeedbackType.Success
      : type === 'warning'
        ? mod.NotificationFeedbackType.Warning
        : mod.NotificationFeedbackType.Error;

  await mod.notificationAsync(feedbackType);
}

/**
 * Check if haptics are supported on this platform.
 */
export function isHapticsSupported(): boolean {
  return hapticsSupported;
}

/**
 * Reset module state (for testing).
 */
export function _resetHapticsModule(): void {
  hapticsModule = null;
  hapticsSupported = false;
}
