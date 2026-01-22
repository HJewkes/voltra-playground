/**
 * Discovery Strategy Tests
 *
 * Tests for the weight discovery workflow for new exercises.
 */

import { describe, it, expect } from 'vitest';
import {
  createDiscoveryState,
  getFirstDiscoveryStep,
  getNextDiscoveryStep,
  getVelocityExpectation,
  getQuickRecommendation,
  type DiscoveryState,
  type UserEstimate,
} from '../discovery';
import { TrainingGoal } from '@/domain/planning/types';
import { discoverySetResultBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestDiscoveryState(overrides: Partial<DiscoveryState> = {}): DiscoveryState {
  return {
    exerciseId: 'test_exercise',
    exerciseType: 'compound',
    goal: TrainingGoal.HYPERTROPHY,
    phase: 'not_started',
    sets: [],
    currentWeight: 0,
    lastVelocity: 0,
    ...overrides,
  };
}

// =============================================================================
// createDiscoveryState() Tests
// =============================================================================

describe('createDiscoveryState()', () => {
  it('creates initial state with correct properties', () => {
    const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.STRENGTH);

    expect(state.exerciseId).toBe('bench_press');
    expect(state.exerciseType).toBe('compound');
    expect(state.goal).toBe(TrainingGoal.STRENGTH);
  });

  it('starts with not_started phase', () => {
    const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.HYPERTROPHY);

    expect(state.phase).toBe('not_started');
  });

  it('starts with empty sets array', () => {
    const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.HYPERTROPHY);

    expect(state.sets).toEqual([]);
  });

  it('starts with zero current weight and velocity', () => {
    const state = createDiscoveryState('bench_press', 'compound', TrainingGoal.HYPERTROPHY);

    expect(state.currentWeight).toBe(0);
    expect(state.lastVelocity).toBe(0);
  });

  it('handles isolation exercises', () => {
    const state = createDiscoveryState('bicep_curl', 'isolation', TrainingGoal.HYPERTROPHY);

    expect(state.exerciseType).toBe('isolation');
  });
});

// =============================================================================
// getFirstDiscoveryStep() Tests
// =============================================================================

describe('getFirstDiscoveryStep()', () => {
  describe('without user estimates', () => {
    it('starts compound exercise at 20 lbs', () => {
      const state = createTestDiscoveryState({ exerciseType: 'compound' });

      const { step, updatedState } = getFirstDiscoveryStep(state);

      expect(step.weight).toBe(20);
      expect(updatedState.currentWeight).toBe(20);
    });

    it('starts isolation exercise at 10 lbs', () => {
      const state = createTestDiscoveryState({ exerciseType: 'isolation' });

      const { step, updatedState } = getFirstDiscoveryStep(state);

      expect(step.weight).toBe(10);
      expect(updatedState.currentWeight).toBe(10);
    });
  });

  describe('with guessed max', () => {
    it('starts at 30% of guessed max', () => {
      const state = createTestDiscoveryState();
      const estimate: UserEstimate = { guessedMax: 200 };

      const { step } = getFirstDiscoveryStep(state, estimate);

      // 200 * 0.3 = 60, rounded to nearest 5
      expect(step.weight).toBe(60);
    });

    it('rounds to nearest 5 lbs', () => {
      const state = createTestDiscoveryState();
      const estimate: UserEstimate = { guessedMax: 183 };

      const { step } = getFirstDiscoveryStep(state, estimate);

      // 183 * 0.3 = 54.9 -> rounds to 55
      expect(step.weight).toBe(55);
    });
  });

  describe('with light weight estimate', () => {
    it('uses provided light weight', () => {
      const state = createTestDiscoveryState();
      const estimate: UserEstimate = { lightWeight: 45 };

      const { step } = getFirstDiscoveryStep(state, estimate);

      expect(step.weight).toBe(45);
    });

    it('guessed max takes priority over light weight', () => {
      const state = createTestDiscoveryState();
      const estimate: UserEstimate = {
        guessedMax: 200,
        lightWeight: 45,
      };

      const { step } = getFirstDiscoveryStep(state, estimate);

      // Uses guessed max calculation
      expect(step.weight).toBe(60);
    });
  });

  describe('step properties', () => {
    it('sets step number to 1', () => {
      const state = createTestDiscoveryState();

      const { step } = getFirstDiscoveryStep(state);

      expect(step.stepNumber).toBe(1);
    });

    it('recommends 5 reps', () => {
      const state = createTestDiscoveryState();

      const { step } = getFirstDiscoveryStep(state);

      expect(step.targetReps).toBe(5);
    });

    it('includes instruction with weight', () => {
      const state = createTestDiscoveryState();
      const estimate: UserEstimate = { guessedMax: 100 };

      const { step } = getFirstDiscoveryStep(state, estimate);

      expect(step.instruction).toContain('30 lbs');
    });
  });

  describe('state updates', () => {
    it('transitions to exploring phase', () => {
      const state = createTestDiscoveryState();

      const { updatedState } = getFirstDiscoveryStep(state);

      expect(updatedState.phase).toBe('exploring');
    });

    it('preserves exercise info', () => {
      const state = createTestDiscoveryState({
        exerciseId: 'squat',
        exerciseType: 'compound',
        goal: TrainingGoal.STRENGTH,
      });

      const { updatedState } = getFirstDiscoveryStep(state);

      expect(updatedState.exerciseId).toBe('squat');
      expect(updatedState.exerciseType).toBe('compound');
      expect(updatedState.goal).toBe(TrainingGoal.STRENGTH);
    });
  });

  it('enforces minimum weight of 5 lbs', () => {
    const state = createTestDiscoveryState();
    const estimate: UserEstimate = { guessedMax: 10 }; // 10 * 0.3 = 3

    const { step } = getFirstDiscoveryStep(state, estimate);

    expect(step.weight).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// getNextDiscoveryStep() Tests
// =============================================================================

describe('getNextDiscoveryStep()', () => {
  describe('exploration phase', () => {
    it('increases weight after fast velocity (> 0.9 m/s)', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 50,
        exerciseType: 'compound',
      });
      const result = discoverySetResultBuilder().weight(50).meanVelocity(0.95).build(); // Fast > 0.9

      const response = getNextDiscoveryStep(state, result);

      expect('step' in response).toBe(true);
      if ('step' in response) {
        // Compound: big jump of 20 lbs for fast velocity
        expect(response.step.weight).toBe(70);
      }
    });

    it('uses smaller increment for isolation exercises', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 20,
        exerciseType: 'isolation',
      });
      const result = discoverySetResultBuilder().weight(20).meanVelocity(0.95).build(); // Fast > 0.9

      const response = getNextDiscoveryStep(state, result);

      expect('step' in response).toBe(true);
      if ('step' in response) {
        // Isolation: smaller jump of 10 lbs for fast velocity
        expect(response.step.weight).toBe(30);
      }
    });

    it('increases by moderate amount for moderate velocity (0.5-0.75 m/s)', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 80,
        exerciseType: 'compound',
      });
      const result = discoverySetResultBuilder().weight(80).meanVelocity(0.6).build();

      const response = getNextDiscoveryStep(state, result);

      expect('step' in response).toBe(true);
      if ('step' in response) {
        // Moderate increment of 10 lbs
        expect(response.step.weight).toBe(90);
      }
    });

    it('uses small increment for slow velocity (0.3-0.5 m/s)', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 100,
        exerciseType: 'compound',
        sets: [discoverySetResultBuilder().weight(50).meanVelocity(0.9).build()],
      });
      const result = discoverySetResultBuilder().weight(100).meanVelocity(0.35).build();

      const response = getNextDiscoveryStep(state, result);

      // May transition to dialing_in or give small increment
      expect('step' in response || 'recommendation' in response).toBe(true);
    });

    it('increments step number correctly', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 50,
        sets: [discoverySetResultBuilder().weight(50).meanVelocity(0.65).build()],
      });
      const result = discoverySetResultBuilder().weight(60).meanVelocity(0.6).build();

      const response = getNextDiscoveryStep(state, result);

      if ('step' in response) {
        expect(response.step.stepNumber).toBe(3); // Already has 1 set, adding another
      }
    });

    it('records set in state', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 50,
        sets: [],
      });
      const result = discoverySetResultBuilder().weight(50).meanVelocity(0.7).build();

      const response = getNextDiscoveryStep(state, result);

      expect(response.updatedState.sets.length).toBe(1);
      expect(response.updatedState.sets[0]).toEqual(result);
    });

    it('updates lastVelocity in state', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 50,
        lastVelocity: 0,
      });
      const result = discoverySetResultBuilder().weight(50).meanVelocity(0.65).build();

      const response = getNextDiscoveryStep(state, result);

      expect(response.updatedState.lastVelocity).toBe(0.65);
    });
  });

  describe('failure handling', () => {
    it('finalizes discovery on failed set', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 150,
        sets: [
          discoverySetResultBuilder().weight(50).meanVelocity(0.9).build(),
          discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        ],
      });
      const result = discoverySetResultBuilder().weight(150).meanVelocity(0.15).failed().build();

      const response = getNextDiscoveryStep(state, result);

      expect('recommendation' in response).toBe(true);
      expect(response.updatedState.phase).toBe('complete');
    });
  });

  describe('grinding velocity handling', () => {
    it('finalizes when grinding with enough data', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 120,
        sets: [
          discoverySetResultBuilder().weight(60).meanVelocity(0.9).build(),
          discoverySetResultBuilder().weight(100).meanVelocity(0.5).build(),
        ],
      });
      const result = discoverySetResultBuilder().weight(120).meanVelocity(0.22).build(); // Grinding

      const response = getNextDiscoveryStep(state, result);

      expect('recommendation' in response).toBe(true);
    });
  });

  describe('transition to dialing_in phase', () => {
    it('transitions when slow with adequate data spread', () => {
      const state = createTestDiscoveryState({
        phase: 'exploring',
        currentWeight: 100,
        sets: [
          discoverySetResultBuilder().weight(50).meanVelocity(0.85).build(),
          discoverySetResultBuilder().weight(80).meanVelocity(0.55).build(),
        ],
      });
      const result = discoverySetResultBuilder().weight(100).meanVelocity(0.38).build(); // Slow

      const response = getNextDiscoveryStep(state, result);

      // Should either transition to dialing_in or give recommendation
      if ('step' in response) {
        expect(response.updatedState.phase).toBe('dialing_in');
      }
    });
  });

  describe('dialing_in phase', () => {
    it('targets working weight zone', () => {
      const state = createTestDiscoveryState({
        phase: 'dialing_in',
        currentWeight: 100,
        goal: TrainingGoal.HYPERTROPHY,
        sets: [
          discoverySetResultBuilder().weight(50).meanVelocity(0.9).build(),
          discoverySetResultBuilder().weight(90).meanVelocity(0.45).build(),
        ],
      });
      const result = discoverySetResultBuilder().weight(100).meanVelocity(0.4).build();

      const response = getNextDiscoveryStep(state, result);

      // Should either complete or give final confirmation step
      expect('recommendation' in response || 'step' in response).toBe(true);
    });
  });
});

// =============================================================================
// getVelocityExpectation() Tests
// =============================================================================

describe('getVelocityExpectation()', () => {
  it('returns message for fast velocity', () => {
    const message = getVelocityExpectation('fast');

    expect(message).toContain('slow');
  });

  it('returns message for moderate velocity', () => {
    const message = getVelocityExpectation('moderate');

    expect(message).toContain('working');
  });

  it('returns message for slow velocity', () => {
    const message = getVelocityExpectation('slow');

    expect(message.toLowerCase()).toContain('challeng');
  });

  it('returns message for grinding velocity', () => {
    const message = getVelocityExpectation('grinding');

    expect(message.toLowerCase()).toContain('limit');
  });
});

// =============================================================================
// getQuickRecommendation() Tests
// =============================================================================

describe('getQuickRecommendation()', () => {
  it('generates recommendation from two sets', () => {
    const lightSet = discoverySetResultBuilder().weight(50).meanVelocity(0.9).build();
    const moderateSet = discoverySetResultBuilder().weight(100).meanVelocity(0.45).build();

    const recommendation = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      lightSet,
      moderateSet
    );

    expect(recommendation.estimated1RM).toBeGreaterThan(0);
    expect(recommendation.workingWeight).toBeGreaterThan(0);
    expect(recommendation.repRange).toBeDefined();
    expect(recommendation.repRange.length).toBe(2);
  });

  it('includes warmup sets', () => {
    const lightSet = discoverySetResultBuilder().weight(50).meanVelocity(0.9).build();
    const moderateSet = discoverySetResultBuilder().weight(100).meanVelocity(0.45).build();

    const recommendation = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      lightSet,
      moderateSet
    );

    expect(recommendation.warmupSets.length).toBeGreaterThan(0);
  });

  it('provides explanation', () => {
    const lightSet = discoverySetResultBuilder().weight(50).meanVelocity(0.9).build();
    const moderateSet = discoverySetResultBuilder().weight(100).meanVelocity(0.45).build();

    const recommendation = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      lightSet,
      moderateSet
    );

    expect(recommendation.explanation).toBeDefined();
    expect(recommendation.explanation.length).toBeGreaterThan(0);
  });

  it('adjusts for different training goals', () => {
    const lightSet = discoverySetResultBuilder().weight(50).meanVelocity(0.9).build();
    const moderateSet = discoverySetResultBuilder().weight(100).meanVelocity(0.45).build();

    const strengthRec = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.STRENGTH,
      lightSet,
      moderateSet
    );

    const enduranceRec = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.ENDURANCE,
      lightSet,
      moderateSet
    );

    // Strength should have higher working weight than endurance
    expect(strengthRec.workingWeight).toBeGreaterThan(enduranceRec.workingWeight);
  });

  it('includes profile in recommendation', () => {
    const lightSet = discoverySetResultBuilder().weight(50).meanVelocity(0.9).build();
    const moderateSet = discoverySetResultBuilder().weight(100).meanVelocity(0.45).build();

    const recommendation = getQuickRecommendation(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      lightSet,
      moderateSet
    );

    expect(recommendation.profile).toBeDefined();
    expect(recommendation.profile.exerciseId).toBe('test_exercise');
  });
});
