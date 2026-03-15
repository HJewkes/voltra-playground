/**
 * Onboarding Milestone Tests
 *
 * Verifies that milestone tracking correctly reads and writes seen state,
 * and that each milestone key is independent.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter } from '@/data/adapters/in-memory-adapter';
import { setTestAdapter } from '@/data/provider';
import {
  isOnboardingMilestoneSeen,
  markOnboardingMilestoneSeen,
  type OnboardingMilestone,
} from '../onboarding-milestones';

const ALL_MILESTONES: OnboardingMilestone[] = [
  'velocity_explained',
  'velocity_loss_explained',
  'rpe_explained',
  'readiness_explained',
];

describe('onboarding milestones', () => {
  beforeEach(() => {
    setTestAdapter(new InMemoryAdapter());
  });

  describe('isOnboardingMilestoneSeen', () => {
    it('returns false for an unseen milestone', async () => {
      const seen = await isOnboardingMilestoneSeen('velocity_explained');
      expect(seen).toBe(false);
    });

    it('returns false for all milestones on fresh storage', async () => {
      for (const milestone of ALL_MILESTONES) {
        expect(await isOnboardingMilestoneSeen(milestone)).toBe(false);
      }
    });
  });

  describe('markOnboardingMilestoneSeen', () => {
    it('marks a milestone as seen', async () => {
      await markOnboardingMilestoneSeen('velocity_explained');
      expect(await isOnboardingMilestoneSeen('velocity_explained')).toBe(true);
    });

    it('marking one milestone does not affect others', async () => {
      await markOnboardingMilestoneSeen('velocity_explained');

      expect(await isOnboardingMilestoneSeen('velocity_loss_explained')).toBe(false);
      expect(await isOnboardingMilestoneSeen('rpe_explained')).toBe(false);
      expect(await isOnboardingMilestoneSeen('readiness_explained')).toBe(false);
    });

    it('all milestones can be marked independently', async () => {
      for (const milestone of ALL_MILESTONES) {
        await markOnboardingMilestoneSeen(milestone);
      }

      for (const milestone of ALL_MILESTONES) {
        expect(await isOnboardingMilestoneSeen(milestone)).toBe(true);
      }
    });

    it('marking an already-seen milestone is idempotent', async () => {
      await markOnboardingMilestoneSeen('rpe_explained');
      await markOnboardingMilestoneSeen('rpe_explained');
      expect(await isOnboardingMilestoneSeen('rpe_explained')).toBe(true);
    });
  });

  describe('storage isolation', () => {
    it('fresh adapter shows no milestones seen', async () => {
      setTestAdapter(new InMemoryAdapter());
      for (const milestone of ALL_MILESTONES) {
        expect(await isOnboardingMilestoneSeen(milestone)).toBe(false);
      }
    });
  });
});
