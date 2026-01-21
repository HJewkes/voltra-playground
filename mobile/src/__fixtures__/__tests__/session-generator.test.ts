/**
 * Session Generator Tests
 *
 * Tests for StoredSet and StoredSession generation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateStoredSet,
  generateStoredSession,
} from '../generators/session-generator';
import { TrainingGoal } from '@/domain/planning';

// =============================================================================
// Tests
// =============================================================================

describe('Session Generator', () => {
  describe('generateStoredSet()', () => {
    it('generates correct number of reps', () => {
      const set = generateStoredSet({ repCount: 8 });

      expect(set.reps.length).toBe(8);
    });

    it('includes all required set fields', () => {
      const set = generateStoredSet();

      expect(set).toHaveProperty('setIndex');
      expect(set).toHaveProperty('weight');
      expect(set).toHaveProperty('reps');
      expect(set).toHaveProperty('startTime');
      expect(set).toHaveProperty('endTime');
      expect(set).toHaveProperty('meanVelocity');
      expect(set).toHaveProperty('estimatedRPE');
      expect(set).toHaveProperty('estimatedRIR');
      expect(set).toHaveProperty('velocityLossPercent');
    });

    it('uses provided weight', () => {
      const set = generateStoredSet({ weight: 150 });

      expect(set.weight).toBe(150);
    });

    it('endTime is after startTime', () => {
      const set = generateStoredSet();

      expect(set.endTime).toBeGreaterThan(set.startTime);
    });

    it('optional includeRawSamples populates rawSamples field', () => {
      const setWithSamples = generateStoredSet({ includeRawSamples: true });
      const setWithoutSamples = generateStoredSet({ includeRawSamples: false });

      expect(setWithSamples.rawSamples).toBeDefined();
      expect(setWithSamples.rawSamples!.length).toBeGreaterThan(0);

      expect(setWithoutSamples.rawSamples).toBeUndefined();
    });

    it('rep numbers are sequential starting from 1', () => {
      const set = generateStoredSet({ repCount: 5 });

      for (let i = 0; i < set.reps.length; i++) {
        expect(set.reps[i].repNumber).toBe(i + 1);
      }
    });

    it('simulates velocity fatigue across reps', () => {
      const set = generateStoredSet({
        repCount: 8,
        startingVelocity: 1.0,
        fatigueRate: 0.05,
      });

      // First rep should have higher velocity than last rep
      const firstRepVelocity = set.reps[0].metrics.concentricMeanVelocity;
      const lastRepVelocity = set.reps[set.reps.length - 1].metrics.concentricMeanVelocity;

      expect(firstRepVelocity).toBeGreaterThan(lastRepVelocity);
    });
  });

  describe('generateStoredSession()', () => {
    it('generates correct number of sets', () => {
      const session = generateStoredSession({ setCount: 4 });

      expect(session.completedSets.length).toBe(4);
      expect(session.plan.sets.length).toBe(4);
    });

    it('sets exerciseId and exerciseName from options', () => {
      const session = generateStoredSession({
        exerciseId: 'bench_press',
        exerciseName: 'Bench Press',
      });

      expect(session.exerciseId).toBe('bench_press');
      expect(session.exerciseName).toBe('Bench Press');
      expect(session.plan.exerciseId).toBe('bench_press');
    });

    it('discovery sessions have generatedBy: discovery', () => {
      const discoverySession = generateStoredSession({ isDiscovery: true });
      const standardSession = generateStoredSession({ isDiscovery: false });

      expect(discoverySession.plan.generatedBy).toBe('discovery');
      expect(standardSession.plan.generatedBy).toBe('standard');
    });

    it('daysAgo option backdates session properly', () => {
      const now = Date.now();
      const daysAgo = 7;
      const session = generateStoredSession({ daysAgo });

      const expectedTime = now - (daysAgo * 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance for test execution time
      expect(session.startTime).toBeGreaterThan(expectedTime - 1000);
      expect(session.startTime).toBeLessThan(expectedTime + 1000);
    });

    it('uses provided weight', () => {
      const session = generateStoredSession({ weight: 200 });

      // First planned set should have the specified weight
      expect(session.plan.sets[0].weight).toBe(200);
      expect(session.completedSets[0].weight).toBe(200);
    });

    it('uses provided goal', () => {
      const session = generateStoredSession({ goal: TrainingGoal.STRENGTH });

      expect(session.plan.goal).toBe(TrainingGoal.STRENGTH);
    });

    it('has status completed', () => {
      const session = generateStoredSession();

      expect(session.status).toBe('completed');
    });

    it('has unique id', () => {
      const session1 = generateStoredSession();
      const session2 = generateStoredSession();

      expect(session1.id).not.toBe(session2.id);
    });

    it('discovery sessions have increasing weight across sets', () => {
      const session = generateStoredSession({
        isDiscovery: true,
        setCount: 4,
        weight: 100,
      });

      // Each set should be 10 lbs heavier
      expect(session.plan.sets[0].weight).toBe(100);
      expect(session.plan.sets[1].weight).toBe(110);
      expect(session.plan.sets[2].weight).toBe(120);
      expect(session.plan.sets[3].weight).toBe(130);
    });

    it('includeRawSamples option includes samples in sets', () => {
      const session = generateStoredSession({
        setCount: 2,
        includeRawSamples: true,
      });

      // Each completed set should have rawSamples
      for (const set of session.completedSets) {
        expect(set.rawSamples).toBeDefined();
        expect(set.rawSamples!.length).toBeGreaterThan(0);
      }
    });
  });
});
