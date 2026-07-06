/**
 * Superset & Circuit Support Tests
 *
 * Tests for superset rotation logic: advancement, completion detection,
 * rest period selection, and upcoming exercise preview.
 */

import { describe, it, expect } from 'vitest';
import {
  createSupersetState,
  createSupersetConfig,
  getCurrentSlot,
  advanceSuperset,
  isSupersetComplete,
  getTotalSupersetSets,
  getUpcomingExercises,
  getSupersetPlannedSet,
  type SupersetConfig,
  type SupersetSlot,
} from '../superset';
import { createTestExercise, planBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Helpers
// =============================================================================

function createTestSlots(count: number): SupersetSlot[] {
  const names = ['chest_press', 'cable_row', 'shoulder_press', 'lat_pulldown'];
  return Array.from({ length: count }, (_, i) => ({
    exercise: createTestExercise(names[i % names.length]),
    plan: planBuilder().workingSets(3).build(),
  }));
}

function createTestConfig(slotCount = 2, overrides?: Partial<SupersetConfig>): SupersetConfig {
  return createSupersetConfig(createTestSlots(slotCount), overrides);
}

// =============================================================================
// createSupersetConfig()
// =============================================================================

describe('createSupersetConfig()', () => {
  it('creates config with default rest values', () => {
    const config = createTestConfig();

    expect(config.slots).toHaveLength(2);
    expect(config.transitionRestSeconds).toBe(30);
    expect(config.roundRestSeconds).toBe(90);
    expect(config.totalRounds).toBe(3);
  });

  it('accepts custom rest values', () => {
    const config = createTestConfig(2, {
      transitionRestSeconds: 15,
      roundRestSeconds: 120,
      totalRounds: 4,
    });

    expect(config.transitionRestSeconds).toBe(15);
    expect(config.roundRestSeconds).toBe(120);
    expect(config.totalRounds).toBe(4);
  });

  it('throws when fewer than 2 exercises provided', () => {
    const singleSlot = createTestSlots(1);
    expect(() => createSupersetConfig(singleSlot)).toThrow('at least 2 exercises');
  });
});

// =============================================================================
// createSupersetState()
// =============================================================================

describe('createSupersetState()', () => {
  it('starts at slot 0, round 0, with 0 completed', () => {
    const state = createSupersetState();

    expect(state.currentSlotIndex).toBe(0);
    expect(state.currentRound).toBe(0);
    expect(state.totalSetsCompleted).toBe(0);
  });
});

// =============================================================================
// getCurrentSlot()
// =============================================================================

describe('getCurrentSlot()', () => {
  it('returns first slot at initial state', () => {
    const config = createTestConfig();
    const state = createSupersetState();

    const slot = getCurrentSlot(config, state);

    expect(slot.exercise.id).toBe('chest_press');
  });

  it('returns correct slot after advancing', () => {
    const config = createTestConfig();
    const state = { currentSlotIndex: 1, currentRound: 0, totalSetsCompleted: 1 };

    const slot = getCurrentSlot(config, state);

    expect(slot.exercise.id).toBe('cable_row');
  });
});

// =============================================================================
// advanceSuperset() - 2-exercise superset
// =============================================================================

describe('advanceSuperset() - 2-exercise superset', () => {
  const config = createTestConfig(2);

  it('advances from slot 0 to slot 1 within same round', () => {
    const state = createSupersetState();
    const result = advanceSuperset(config, state);

    expect(result.state.currentSlotIndex).toBe(1);
    expect(result.state.currentRound).toBe(0);
    expect(result.state.totalSetsCompleted).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.isNewRound).toBe(false);
    expect(result.restSeconds).toBe(30);
    expect(result.nextSlot?.exercise.id).toBe('cable_row');
  });

  it('advances from slot 1 to slot 0 of next round', () => {
    const state = { currentSlotIndex: 1, currentRound: 0, totalSetsCompleted: 1 };
    const result = advanceSuperset(config, state);

    expect(result.state.currentSlotIndex).toBe(0);
    expect(result.state.currentRound).toBe(1);
    expect(result.state.totalSetsCompleted).toBe(2);
    expect(result.isComplete).toBe(false);
    expect(result.isNewRound).toBe(true);
    expect(result.restSeconds).toBe(90);
    expect(result.nextSlot?.exercise.id).toBe('chest_press');
  });

  it('completes after final set of final round', () => {
    const state = { currentSlotIndex: 1, currentRound: 2, totalSetsCompleted: 5 };
    const result = advanceSuperset(config, state);

    expect(result.isComplete).toBe(true);
    expect(result.isNewRound).toBe(true);
    expect(result.nextSlot).toBeNull();
    expect(result.restSeconds).toBe(0);
    expect(result.state.totalSetsCompleted).toBe(6);
  });

  it('uses transition rest within a round', () => {
    const customConfig = createTestConfig(2, { transitionRestSeconds: 20 });
    const state = createSupersetState();
    const result = advanceSuperset(customConfig, state);

    expect(result.restSeconds).toBe(20);
  });

  it('uses round rest between rounds', () => {
    const customConfig = createTestConfig(2, { roundRestSeconds: 150 });
    const state = { currentSlotIndex: 1, currentRound: 0, totalSetsCompleted: 1 };
    const result = advanceSuperset(customConfig, state);

    expect(result.restSeconds).toBe(150);
  });
});

// =============================================================================
// advanceSuperset() - 3-exercise circuit
// =============================================================================

describe('advanceSuperset() - 3-exercise circuit', () => {
  const config = createTestConfig(3);

  it('rotates through all 3 slots before advancing round', () => {
    // Slot 0 -> 1
    let result = advanceSuperset(config, createSupersetState());
    expect(result.state.currentSlotIndex).toBe(1);
    expect(result.isNewRound).toBe(false);

    // Slot 1 -> 2
    result = advanceSuperset(config, result.state);
    expect(result.state.currentSlotIndex).toBe(2);
    expect(result.isNewRound).toBe(false);

    // Slot 2 -> 0 (new round)
    result = advanceSuperset(config, result.state);
    expect(result.state.currentSlotIndex).toBe(0);
    expect(result.state.currentRound).toBe(1);
    expect(result.isNewRound).toBe(true);
  });

  it('completes after all rounds', () => {
    const state = { currentSlotIndex: 2, currentRound: 2, totalSetsCompleted: 8 };
    const result = advanceSuperset(config, state);

    expect(result.isComplete).toBe(true);
    expect(result.state.totalSetsCompleted).toBe(9);
  });
});

// =============================================================================
// isSupersetComplete()
// =============================================================================

describe('isSupersetComplete()', () => {
  it('returns false when rounds remain', () => {
    const config = createTestConfig();
    const state = { currentSlotIndex: 0, currentRound: 1, totalSetsCompleted: 2 };

    expect(isSupersetComplete(config, state)).toBe(false);
  });

  it('returns true when all rounds done', () => {
    const config = createTestConfig();
    const state = { currentSlotIndex: 0, currentRound: 3, totalSetsCompleted: 6 };

    expect(isSupersetComplete(config, state)).toBe(true);
  });
});

// =============================================================================
// getTotalSupersetSets()
// =============================================================================

describe('getTotalSupersetSets()', () => {
  it('returns slots * rounds for a 2-exercise superset', () => {
    const config = createTestConfig(2);

    expect(getTotalSupersetSets(config)).toBe(6);
  });

  it('returns slots * rounds for a 3-exercise circuit', () => {
    const config = createTestConfig(3, { totalRounds: 4 });

    expect(getTotalSupersetSets(config)).toBe(12);
  });
});

// =============================================================================
// getUpcomingExercises()
// =============================================================================

describe('getUpcomingExercises()', () => {
  it('returns upcoming exercises in rotation order', () => {
    const config = createTestConfig(2);
    const state = createSupersetState();

    const upcoming = getUpcomingExercises(config, state, 4);

    expect(upcoming).toHaveLength(4);
    expect(upcoming[0].exercise.id).toBe('chest_press');
    expect(upcoming[1].exercise.id).toBe('cable_row');
    expect(upcoming[2].exercise.id).toBe('chest_press');
    expect(upcoming[3].exercise.id).toBe('cable_row');
  });

  it('stops at superset completion boundary', () => {
    const config = createTestConfig(2, { totalRounds: 1 });
    const state = createSupersetState();

    const upcoming = getUpcomingExercises(config, state, 10);

    expect(upcoming).toHaveLength(2);
  });

  it('includes round information', () => {
    const config = createTestConfig(2);
    const state = createSupersetState();

    const upcoming = getUpcomingExercises(config, state, 4);

    expect(upcoming[0].round).toBe(0);
    expect(upcoming[1].round).toBe(0);
    expect(upcoming[2].round).toBe(1);
    expect(upcoming[3].round).toBe(1);
  });
});

// =============================================================================
// getSupersetPlannedSet()
// =============================================================================

describe('getSupersetPlannedSet()', () => {
  it('returns planned set for current slot and round', () => {
    const config = createTestConfig();
    const state = createSupersetState();

    const planned = getSupersetPlannedSet(config, state);

    expect(planned).not.toBeNull();
    expect(planned!.weight).toBeGreaterThan(0);
  });

  it('returns null when round exceeds plan sets', () => {
    const config = createTestConfig(2, { totalRounds: 10 });
    const state = { currentSlotIndex: 0, currentRound: 9, totalSetsCompleted: 18 };

    const planned = getSupersetPlannedSet(config, state);

    expect(planned).toBeNull();
  });
});
