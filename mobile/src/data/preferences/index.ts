/**
 * Preferences Data Module
 *
 * Storage layer for device and connection preferences.
 */

// Schema types
export type { Device } from './preferences-schema';

// Onboarding milestones
export type { OnboardingMilestone } from './onboarding-milestones';
export { isOnboardingMilestoneSeen, markOnboardingMilestoneSeen } from './onboarding-milestones';

// Storage functions
export {
  getLastDevice,
  saveLastDevice,
  clearLastDevice,
  isAutoReconnectEnabled,
  setAutoReconnectEnabled,
  isHapticCuesEnabled,
  setHapticCuesEnabled,
  isAudioCuesEnabled,
  setAudioCuesEnabled,
  isAICoachingEnabled,
  setAICoachingEnabled,
  isVoiceCoachingEnabled,
  setVoiceCoachingEnabled,
  isVelocityAutoStopEnabled,
  setVelocityAutoStopEnabled,
  getVelocityAutoStopThreshold,
  setVelocityAutoStopThreshold,
} from './preferences-storage';
