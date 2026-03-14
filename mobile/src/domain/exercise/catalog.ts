/**
 * Exercise Catalog
 *
 * Exercise definitions and lookup functions.
 * Contains the master catalog of all known exercises with their metadata.
 */

import type { TempoTarget } from '@/domain/workout';
import { MuscleGroup, type MovementPattern, type VoltrasSetup } from './types';

// =============================================================================
// Exercise Interface
// =============================================================================

/**
 * Exercise definition - metadata about an exercise.
 *
 * @example
 * const benchPress: Exercise = {
 *   id: 'bench_press',
 *   name: 'Bench Press',
 *   muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
 *   movementPattern: 'push',
 * };
 */
export interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  movementPattern: MovementPattern;
  equipmentSetup?: VoltrasSetup;
  defaultTempo?: TempoTarget;
  rangeOfMotionNotes?: string;
}

// =============================================================================
// Exercise Factory
// =============================================================================

/**
 * Create an exercise with sensible defaults.
 */
export function createExercise(base: Pick<Exercise, 'id' | 'name'> & Partial<Exercise>): Exercise {
  return {
    id: base.id,
    name: base.name,
    muscleGroups: base.muscleGroups ?? [MuscleGroup.BACK],
    movementPattern: base.movementPattern ?? 'pull',
    equipmentSetup: base.equipmentSetup,
    defaultTempo: base.defaultTempo,
    rangeOfMotionNotes: base.rangeOfMotionNotes,
  };
}

// =============================================================================
// Default Tempos
// =============================================================================

const COMPOUND_TEMPO: TempoTarget = {
  concentric: 1,
  eccentric: 3,
  pauseTop: 0,
  pauseBottom: 1,
};

const ISOLATION_TEMPO: TempoTarget = {
  concentric: 1,
  eccentric: 2,
  pauseTop: 1,
  pauseBottom: 1,
};

// =============================================================================
// Exercise Catalog
// =============================================================================

/**
 * Master catalog of all known exercises.
 * Future: Load from database or API.
 */
export const EXERCISE_CATALOG: Record<string, Exercise> = {
  // General / Testing
  general: createExercise({
    id: 'general',
    name: 'General Exercise',
    muscleGroups: [],
    movementPattern: 'pull',
  }),

  // Back exercises
  cable_row: createExercise({
    id: 'cable_row',
    name: 'Seated Cable Row',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'V-handle or straight bar',
      notes: 'Sit on floor or low bench for alignment at 7\'0". Low pulley provides better line of pull for seated rows.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  lat_pulldown: createExercise({
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'Wide bar',
      notes: 'Use Pegasus seat with knees under pad. High pulley required for proper overhead angle.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),

  // Chest exercises
  cable_chest_press: createExercise({
    id: 'cable_chest_press',
    name: 'Cable Chest Press',
    muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
    movementPattern: 'push',
    equipmentSetup: {
      cablePath: 'mid',
      attachment: 'D-handles',
      notes: 'Set pulleys at sternum height — higher than default for 7\'0". Stand back 2-3 feet from posts.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_fly: createExercise({
    id: 'cable_fly',
    name: 'Cable Fly',
    muscleGroups: [MuscleGroup.CHEST],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'D-handles',
      notes: 'Low-to-high fly. Start at 80% ROM — enormous wingspan at 7\'0" means full ROM risks overstretch.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_crossover: createExercise({
    id: 'cable_crossover',
    name: 'Cable Crossover',
    muscleGroups: [MuscleGroup.CHEST],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'D-handles',
      notes: 'High-to-low motion. Step forward for full stretch at top. Long arms benefit from slight forward lean.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),

  // Biceps exercises
  cable_curl: createExercise({
    id: 'cable_curl',
    name: 'Cable Bicep Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Straight bar or EZ bar attachment',
      notes: 'Stand upright with slight forward lean. Low pulley keeps tension through full ROM for long arms.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_hammer_curl: createExercise({
    id: 'cable_hammer_curl',
    name: 'Cable Hammer Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Rope attachment',
      notes: 'Neutral grip throughout. Keep elbows pinned at sides — long levers make cheating easy.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),

  // Triceps exercises
  cable_tricep_pushdown: createExercise({
    id: 'cable_tricep_pushdown',
    name: 'Cable Tricep Pushdown',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'Rope or straight bar',
      notes: 'Use highest pulley setting for proper angle at 7\'0". Lean slightly forward to maintain tension at lockout.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_tricep_extension: createExercise({
    id: 'cable_tricep_extension',
    name: 'Cable Tricep Extension',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Rope',
      notes: 'Face away from machine, overhead extension. Low pulley required. Long arms give excellent stretch.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),

  // Shoulder exercises
  cable_shoulder_press: createExercise({
    id: 'cable_shoulder_press',
    name: 'Cable Shoulder Press',
    muscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.TRICEPS],
    movementPattern: 'push',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'D-handles',
      notes: 'Press from low cables, seated or standing. Low pulley gives full pressing ROM for tall lifters.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_lateral_raise: createExercise({
    id: 'cable_lateral_raise',
    name: 'Cable Lateral Raise',
    muscleGroups: [MuscleGroup.SHOULDERS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'D-handle (single)',
      notes: 'Cross-body, one arm at a time. Stand beside the post. Long arms = more torque, use lighter weight.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_face_pull: createExercise({
    id: 'cable_face_pull',
    name: 'Cable Face Pull',
    muscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.BACK],
    movementPattern: 'pull',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'Rope',
      notes: 'Pull to forehead level. High pulley aligns with face at 7\'0" — may need highest setting.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),

  // Leg exercises
  cable_squat: createExercise({
    id: 'cable_squat',
    name: 'Cable Squat',
    muscleGroups: [MuscleGroup.QUADS, MuscleGroup.GLUTES],
    movementPattern: 'squat',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Belt or rope between legs',
      notes: 'Cable squat with constant tension. Belt attachment preferred for 7\'0" to keep load centered.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_lunge: createExercise({
    id: 'cable_lunge',
    name: 'Cable Lunge',
    muscleGroups: [MuscleGroup.QUADS, MuscleGroup.GLUTES],
    movementPattern: 'lunge',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'D-handles at sides',
      notes: 'Long stride for 7\'0" frame. Stand further from machine to maintain cable angle during lunge.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_leg_curl: createExercise({
    id: 'cable_leg_curl',
    name: 'Cable Leg Curl',
    muscleGroups: [MuscleGroup.HAMSTRINGS],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Ankle strap',
      notes: 'Prone or standing. Low pulley with ankle strap. Long legs benefit from standing variant.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_deadlift: createExercise({
    id: 'cable_deadlift',
    name: 'Cable Deadlift',
    muscleGroups: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.BACK],
    movementPattern: 'hinge',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Straight bar',
      notes: 'Cable RDL pattern. Low pulley. Stand back to maintain tension at top. Long limbs = great stretch.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_hip_thrust: createExercise({
    id: 'cable_hip_thrust',
    name: 'Cable Hip Thrust',
    muscleGroups: [MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
    movementPattern: 'hinge',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Belt or pad',
      notes: 'Setup on bench with low cable. Position bench far enough from post for full hip extension at 7\'0".',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
  cable_kickback: createExercise({
    id: 'cable_kickback',
    name: 'Cable Kickback',
    muscleGroups: [MuscleGroup.GLUTES],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'low',
      attachment: 'Ankle strap',
      notes: 'Glute kickback from low pulley. Hinge slightly at hips for longer range of motion.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),

  // Core exercises
  cable_crunch: createExercise({
    id: 'cable_crunch',
    name: 'Cable Crunch',
    muscleGroups: [MuscleGroup.CORE],
    movementPattern: 'isolation',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'Rope',
      notes: 'Kneeling cable crunch. High pulley. Long torso at 7\'0" gives excellent leverage for core loading.',
    },
    defaultTempo: ISOLATION_TEMPO,
  }),
  cable_woodchop: createExercise({
    id: 'cable_woodchop',
    name: 'Cable Woodchop',
    muscleGroups: [MuscleGroup.CORE],
    movementPattern: 'rotation',
    equipmentSetup: {
      cablePath: 'high',
      attachment: 'D-handle or rope',
      notes: 'High-to-low rotational. Can also do low-to-high by switching to low pulley. Wide stance for stability.',
    },
    defaultTempo: COMPOUND_TEMPO,
  }),
};

// =============================================================================
// Lookup Functions
// =============================================================================

/**
 * Get an exercise by ID.
 */
export function getExercise(exerciseId: string): Exercise | undefined {
  return EXERCISE_CATALOG[exerciseId];
}

/**
 * Get all available exercises.
 */
export function getAllExercises(): Exercise[] {
  return Object.values(EXERCISE_CATALOG);
}

/**
 * Check if an exercise exists in the catalog.
 */
export function hasExercise(exerciseId: string): boolean {
  return exerciseId in EXERCISE_CATALOG;
}
