/**
 * Discovery Session Integration Tests
 *
 * Tests the discovery workflow by exercising the same strategy functions
 * that useDiscoverySession uses internally. This validates the state machine
 * transitions and recommendation generation without needing React test utils.
 */

import { describe, it, expect } from 'vitest';
import { TrainingGoal } from '@/domain/planning';
import {
  createDiscoveryState,
  getFirstDiscoveryStep,
  getNextDiscoveryStep,
  type DiscoveryState,
} from '@/domain/planning/strategies/discovery';
import type { DiscoverySetResult } from '@/domain/planning';
import { discoverySetResultBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Simulate a full discovery flow: initialize, record sets, get recommendation.
 * Mirrors what useDiscoverySession does internally.
 */
function runDiscoveryFlow(
  exerciseId: string,
  exerciseType: 'compound' | 'isolation',
  goal: TrainingGoal,
  setResults: DiscoverySetResult[]
): {
  finalState: DiscoveryState;
  completedResults: DiscoverySetResult[];
  recommendation: ReturnType<typeof getNextDiscoveryStep> extends infer R
    ? R extends { recommendation: infer Rec }
      ? Rec
      : null
    : null;
} {
  let state = createDiscoveryState(exerciseId, exerciseType, goal);
  const { updatedState } = getFirstDiscoveryStep(state);
  state = updatedState;

  const completedResults: DiscoverySetResult[] = [];

  for (const setResult of setResults) {
    const result = getNextDiscoveryStep(state, setResult);
    state = result.updatedState;
    completedResults.push(setResult);

    if ('recommendation' in result) {
      return {
        finalState: state,
        completedResults,
        recommendation: result.recommendation,
      };
    }
  }

  return { finalState: state, completedResults, recommendation: null };
}

// =============================================================================
// Tests
// =============================================================================

describe('Discovery session flow', () => {
  describe('initialization', () => {
    it('creates exploring state for compound exercise', () => {
      const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.HYPERTROPHY);
      const { step, updatedState } = getFirstDiscoveryStep(state);

      expect(updatedState.phase).toBe('exploring');
      expect(step.stepNumber).toBe(1);
      expect(step.weight).toBe(20);
      expect(step.targetReps).toBe(5);
    });

    it('starts at 30% of guessed max', () => {
      const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.STRENGTH);
      const { step } = getFirstDiscoveryStep(state, { guessedMax: 200 });

      expect(step.weight).toBe(60);
    });
  });

  describe('exploration progression', () => {
    it('increases weight after fast velocity set', () => {
      const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.HYPERTROPHY);
      const { updatedState } = getFirstDiscoveryStep(state);

      const fastSet = discoverySetResultBuilder().weight(20).meanVelocity(0.95).build();
      const result = getNextDiscoveryStep(updatedState, fastSet);

      expect('step' in result).toBe(true);
      if ('step' in result) {
        expect(result.step.weight).toBe(40);
      }
    });

    it('uses smaller increments for moderate velocity', () => {
      const testState: DiscoveryState = {
        exerciseId: 'bench_press',
        exerciseType: 'compound',
        goal: TrainingGoal.HYPERTROPHY,
        phase: 'exploring',
        sets: [],
        currentWeight: 80,
        lastVelocity: 0,
      };

      const moderateSet = discoverySetResultBuilder().weight(80).meanVelocity(0.6).build();
      const result = getNextDiscoveryStep(testState, moderateSet);

      expect('step' in result).toBe(true);
      if ('step' in result) {
        expect(result.step.weight).toBe(90);
      }
    });
  });

  describe('completion via failure', () => {
    it('generates recommendation when set fails', () => {
      const flow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.HYPERTROPHY, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.15).failed().build(),
      ]);

      expect(flow.recommendation).not.toBeNull();
      expect(flow.finalState.phase).toBe('complete');
      expect(flow.recommendation!.estimated1RM).toBeGreaterThan(0);
      expect(flow.recommendation!.workingWeight).toBeGreaterThan(0);
    });
  });

  describe('completion via grinding', () => {
    it('generates recommendation when velocity is grinding with enough data', () => {
      const flow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.HYPERTROPHY, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.22).build(),
      ]);

      expect(flow.recommendation).not.toBeNull();
      expect(flow.finalState.phase).toBe('complete');
    });
  });

  describe('recommendation properties', () => {
    it('includes warmup sets, rep range, and explanation', () => {
      const flow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.HYPERTROPHY, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.15).failed().build(),
      ]);

      const rec = flow.recommendation!;
      expect(rec.warmupSets.length).toBeGreaterThan(0);
      expect(rec.repRange).toBeDefined();
      expect(rec.repRange.length).toBe(2);
      expect(rec.explanation.length).toBeGreaterThan(0);
      expect(rec.confidence).toBeDefined();
    });

    it('adjusts working weight for different goals', () => {
      const strengthFlow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.STRENGTH, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.15).failed().build(),
      ]);

      const enduranceFlow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.ENDURANCE, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.15).failed().build(),
      ]);

      expect(strengthFlow.recommendation!.workingWeight).toBeGreaterThan(
        enduranceFlow.recommendation!.workingWeight
      );
    });
  });

  describe('phase transitions', () => {
    it('tracks completed results count', () => {
      const flow = runDiscoveryFlow('bench_press', 'compound', TrainingGoal.HYPERTROPHY, [
        discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
        discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        discoverySetResultBuilder().weight(120).meanVelocity(0.15).failed().build(),
      ]);

      // May complete after 2 sets if profile confidence is sufficient
      expect(flow.completedResults.length).toBeGreaterThanOrEqual(2);
    });

    it('transitions to dialing_in when slow with data spread', () => {
      const testState: DiscoveryState = {
        exerciseId: 'test',
        exerciseType: 'compound',
        goal: TrainingGoal.HYPERTROPHY,
        phase: 'exploring',
        sets: [
          discoverySetResultBuilder().weight(50).meanVelocity(0.85).build(),
          discoverySetResultBuilder().weight(80).meanVelocity(0.55).build(),
        ],
        currentWeight: 100,
        lastVelocity: 0.55,
      };

      const slowSet = discoverySetResultBuilder().weight(100).meanVelocity(0.38).build();
      const result = getNextDiscoveryStep(testState, slowSet);

      if ('step' in result) {
        expect(result.updatedState.phase).toBe('dialing_in');
      }
    });
  });
});
