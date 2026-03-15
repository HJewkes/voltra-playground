/**
 * Onboarding Milestone Tracking
 *
 * Tracks one-time contextual tips so each VBT concept is explained
 * at the moment it first becomes relevant, and never shown again.
 */

import { getMMKVAdapter } from '@/data/provider';
import { STORAGE_KEYS } from '@/data/adapters';

export type OnboardingMilestone =
  | 'velocity_explained'
  | 'velocity_loss_explained'
  | 'rpe_explained'
  | 'readiness_explained';

function milestoneKey(milestone: OnboardingMilestone): string {
  return `${STORAGE_KEYS.ONBOARDING_MILESTONE_PREFIX}${milestone}`;
}

/**
 * Returns true if the user has already dismissed this onboarding tip.
 */
export async function isOnboardingMilestoneSeen(
  milestone: OnboardingMilestone,
): Promise<boolean> {
  const seen = await getMMKVAdapter().get<boolean>(milestoneKey(milestone));
  return seen === true;
}

/**
 * Marks an onboarding tip as seen so it is never shown again.
 */
export async function markOnboardingMilestoneSeen(
  milestone: OnboardingMilestone,
): Promise<void> {
  await getMMKVAdapter().set(milestoneKey(milestone), true);
}
