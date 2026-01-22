/**
 * Exercise Mappings Tests
 *
 * Tests for exercise-muscle group mappings and lookup functions.
 */

import { describe, it, expect } from 'vitest';
import {
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_TYPES,
  getExerciseName,
  getKnownExercises,
  getExercisesByMuscleGroup,
  getExerciseMuscleGroup,
  getExerciseType,
} from '../mappings';
import { MuscleGroup } from '../types';

// =============================================================================
// Constants Tests
// =============================================================================

describe('EXERCISE_MUSCLE_GROUPS', () => {
  it('contains common cable exercises', () => {
    expect(EXERCISE_MUSCLE_GROUPS.cable_row).toBeDefined();
    expect(EXERCISE_MUSCLE_GROUPS.lat_pulldown).toBeDefined();
    expect(EXERCISE_MUSCLE_GROUPS.cable_curl).toBeDefined();
  });

  it('maps back exercises to BACK muscle group', () => {
    expect(EXERCISE_MUSCLE_GROUPS.cable_row).toBe(MuscleGroup.BACK);
    expect(EXERCISE_MUSCLE_GROUPS.lat_pulldown).toBe(MuscleGroup.BACK);
  });

  it('maps chest exercises to CHEST muscle group', () => {
    expect(EXERCISE_MUSCLE_GROUPS.cable_chest_press).toBe(MuscleGroup.CHEST);
    expect(EXERCISE_MUSCLE_GROUPS.cable_fly).toBe(MuscleGroup.CHEST);
  });

  it('maps arm exercises to correct muscle groups', () => {
    expect(EXERCISE_MUSCLE_GROUPS.cable_curl).toBe(MuscleGroup.BICEPS);
    expect(EXERCISE_MUSCLE_GROUPS.cable_tricep_pushdown).toBe(MuscleGroup.TRICEPS);
  });
});

describe('EXERCISE_TYPES', () => {
  it('marks compound exercises correctly', () => {
    expect(EXERCISE_TYPES.cable_row).toBe('compound');
    expect(EXERCISE_TYPES.lat_pulldown).toBe('compound');
    expect(EXERCISE_TYPES.cable_squat).toBe('compound');
  });

  it('marks isolation exercises correctly', () => {
    expect(EXERCISE_TYPES.cable_curl).toBe('isolation');
    expect(EXERCISE_TYPES.cable_fly).toBe('isolation');
    expect(EXERCISE_TYPES.cable_lateral_raise).toBe('isolation');
  });
});

// =============================================================================
// getExerciseName() Tests
// =============================================================================

describe('getExerciseName()', () => {
  it('converts snake_case to Title Case', () => {
    expect(getExerciseName('cable_row')).toBe('Cable Row');
    expect(getExerciseName('lat_pulldown')).toBe('Lat Pulldown');
  });

  it('handles single word exercises', () => {
    expect(getExerciseName('bicep')).toBe('Bicep');
  });

  it('handles multiple underscores', () => {
    expect(getExerciseName('cable_tricep_pushdown')).toBe('Cable Tricep Pushdown');
  });
});

// =============================================================================
// getKnownExercises() Tests
// =============================================================================

describe('getKnownExercises()', () => {
  it('returns array of exercise IDs', () => {
    const exercises = getKnownExercises();

    expect(Array.isArray(exercises)).toBe(true);
    expect(exercises.length).toBeGreaterThan(0);
  });

  it('includes common exercises', () => {
    const exercises = getKnownExercises();

    expect(exercises).toContain('cable_row');
    expect(exercises).toContain('lat_pulldown');
    expect(exercises).toContain('cable_curl');
  });

  it('returns all mapped exercises', () => {
    const exercises = getKnownExercises();
    const mappedCount = Object.keys(EXERCISE_MUSCLE_GROUPS).length;

    expect(exercises.length).toBe(mappedCount);
  });
});

// =============================================================================
// getExercisesByMuscleGroup() Tests
// =============================================================================

describe('getExercisesByMuscleGroup()', () => {
  it('returns back exercises', () => {
    const exercises = getExercisesByMuscleGroup(MuscleGroup.BACK);

    expect(exercises).toContain('cable_row');
    expect(exercises).toContain('lat_pulldown');
  });

  it('returns bicep exercises', () => {
    const exercises = getExercisesByMuscleGroup(MuscleGroup.BICEPS);

    expect(exercises).toContain('cable_curl');
    expect(exercises).toContain('bicep_curl');
  });

  it('returns empty array for muscle group with no exercises', () => {
    // CALVES has no exercises in our mapping
    const exercises = getExercisesByMuscleGroup(MuscleGroup.CALVES);

    expect(exercises).toEqual([]);
  });

  it('returns array of strings', () => {
    const exercises = getExercisesByMuscleGroup(MuscleGroup.CHEST);

    expect(Array.isArray(exercises)).toBe(true);
    exercises.forEach((e) => expect(typeof e).toBe('string'));
  });
});

// =============================================================================
// getExerciseMuscleGroup() Tests
// =============================================================================

describe('getExerciseMuscleGroup()', () => {
  it('returns muscle group for known exercise', () => {
    expect(getExerciseMuscleGroup('cable_row')).toBe(MuscleGroup.BACK);
    expect(getExerciseMuscleGroup('cable_curl')).toBe(MuscleGroup.BICEPS);
  });

  it('returns undefined for unknown exercise', () => {
    expect(getExerciseMuscleGroup('unknown_exercise')).toBeUndefined();
  });
});

// =============================================================================
// getExerciseType() Tests
// =============================================================================

describe('getExerciseType()', () => {
  it('returns compound for compound exercises', () => {
    expect(getExerciseType('cable_row')).toBe('compound');
    expect(getExerciseType('cable_squat')).toBe('compound');
  });

  it('returns isolation for isolation exercises', () => {
    expect(getExerciseType('cable_curl')).toBe('isolation');
    expect(getExerciseType('cable_fly')).toBe('isolation');
  });

  it('defaults to compound for unknown exercise', () => {
    expect(getExerciseType('unknown_exercise')).toBe('compound');
  });
});
