/**
 * Session Builder
 *
 * Fluent builder for creating ExerciseSession objects.
 *
 * @example
 * // Simple session with preset
 * sessionBuilder().standardWorkout().workingWeight(185).build()
 *
 * // Session with explicit plan and sets
 * sessionBuilder()
 *   .exercise(testExercises.compound)
 *   .plan(myPlan)
 *   .completedSets([set1, set2])
 *   .build()
 *
 * // Generate complete session from preset
 * sessionBuilder()
 *   .discoverySession()
 *   .workingWeight(100)
 *   .build()
 */

import type { Exercise } from '@/domain/exercise';
import { createExercise, MuscleGroup } from '@/domain/exercise';
import type { ExercisePlan } from '@/domain/workout/models/plan';
import type { ExerciseSession } from '@/domain/workout/models/session';
import type { Set } from '@/domain/workout/models/set';
import { TrainingGoal } from '@/domain/planning/types';
import { planBuilder, type PlanTargets } from './plan-builder';
import { setBuilder, SET_PRESETS, type SetTargets, type SetPreset, type RepBehavior } from './set-builder';

// =============================================================================
// Session-Level Types
// =============================================================================

/**
 * Specification for a set within a session composition.
 */
export interface SessionSetSpec {
  /** Weight as percentage of working weight (0-100) */
  weightPercent: number;
  /** Set composition (preset name or explicit behaviors) */
  composition: SetPreset | RepBehavior[];
}

/**
 * Session composition is an array of set specifications.
 */
export type SessionComposition = SessionSetSpec[];

/**
 * Target configuration for an exercise session.
 */
export interface SessionTargets {
  id?: string;
  exercise?: Exercise;
  exerciseId?: string;
  plan?: ExercisePlan;
  planTargets?: PlanTargets;
  completedSets?: Set[];
  completedSetTargets?: SetTargets[];
  restEndsAt?: number | null;
  startedAt?: number;
  composition?: SessionComposition;
  workingWeight?: number;
  goal?: TrainingGoal;
}

// =============================================================================
// Session Presets
// =============================================================================

export const SESSION_PRESETS = {
  standardWorkout: [
    { weightPercent: 50, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 75, composition: 'warmupModerate' as SetPreset },
    { weightPercent: 85, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 85, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 85, composition: 'toFailure' as SetPreset },
  ],
  discoverySession: [
    { weightPercent: 30, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 50, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 70, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 85, composition: 'toFailure' as SetPreset },
  ],
  strengthSession: [
    { weightPercent: 50, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 70, composition: 'warmupModerate' as SetPreset },
    { weightPercent: 85, composition: 'strengthSet' as SetPreset },
    { weightPercent: 90, composition: 'strengthSet' as SetPreset },
    { weightPercent: 95, composition: 'strengthSet' as SetPreset },
  ],
  highVolumeSession: [
    { weightPercent: 50, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 75, composition: 'warmupModerate' as SetPreset },
    { weightPercent: 80, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 80, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 80, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 80, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 80, composition: 'toFailure' as SetPreset },
  ],
  warmupOnly: [
    { weightPercent: 40, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 60, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 80, composition: 'warmupModerate' as SetPreset },
  ],
  junkVolumeSession: [
    { weightPercent: 85, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 85, composition: 'productiveWorking' as SetPreset },
    { weightPercent: 85, composition: 'junkVolume' as SetPreset },
  ],
  failedEarlySession: [
    { weightPercent: 50, composition: 'warmupEasy' as SetPreset },
    { weightPercent: 100, composition: 'tooHeavy' as SetPreset },
  ],
} as const;

export type SessionPreset = keyof typeof SESSION_PRESETS;

// =============================================================================
// Test Exercise Helper
// =============================================================================

/**
 * Create a test exercise with sensible defaults.
 */
export function createTestExercise(idOrOverrides?: string | Partial<Exercise>): Exercise {
  const defaults = {
    id: 'test_exercise',
    name: 'Test Exercise',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull' as const,
  };

  if (typeof idOrOverrides === 'string') {
    return createExercise({ ...defaults, id: idOrOverrides, name: idOrOverrides });
  }

  return createExercise({ ...defaults, ...idOrOverrides });
}

// =============================================================================
// Builder Class
// =============================================================================

class SessionBuilder {
  private targets: SessionTargets = {};
  private preset?: SessionPreset;

  // ===========================================================================
  // Identity
  // ===========================================================================

  /** Set the session ID. */
  id(id: string): this {
    this.targets.id = id;
    return this;
  }

  /** Set the exercise. */
  exercise(e: Exercise): this {
    this.targets.exercise = e;
    return this;
  }

  /** Set just the exercise ID (will create test exercise). */
  exerciseId(id: string): this {
    this.targets.exerciseId = id;
    return this;
  }

  // ===========================================================================
  // Plan
  // ===========================================================================

  /** Set a pre-built plan. */
  plan(p: ExercisePlan): this {
    this.targets.plan = p;
    return this;
  }

  /** Set plan targets (plan will be generated). */
  planTargets(t: PlanTargets): this {
    this.targets.planTargets = t;
    return this;
  }

  // ===========================================================================
  // Completed Sets
  // ===========================================================================

  /** Set pre-built completed sets. */
  completedSets(sets: Set[]): this {
    this.targets.completedSets = sets;
    return this;
  }

  /** Set completed set targets (sets will be generated). */
  completedSetTargets(targets: SetTargets[]): this {
    this.targets.completedSetTargets = targets;
    return this;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  /** Set when rest ends. */
  restEndsAt(t: number | null): this {
    this.targets.restEndsAt = t;
    return this;
  }

  /** Set when session started. */
  startedAt(t: number): this {
    this.targets.startedAt = t;
    return this;
  }

  // ===========================================================================
  // Composition Options
  // ===========================================================================

  /** Set the working weight (used with presets). */
  workingWeight(w: number): this {
    this.targets.workingWeight = w;
    return this;
  }

  /** Set the training goal. */
  goal(g: TrainingGoal): this {
    this.targets.goal = g;
    return this;
  }

  // ===========================================================================
  // Preset Methods
  // ===========================================================================

  /** Standard workout (warmups + working sets). */
  standardWorkout(): this {
    this.preset = 'standardWorkout';
    return this;
  }

  /** Discovery session (progressive loading). */
  discoverySession(): this {
    this.preset = 'discoverySession';
    return this;
  }

  /** Strength-focused session. */
  strengthSession(): this {
    this.preset = 'strengthSession';
    return this;
  }

  /** High volume session. */
  highVolumeSession(): this {
    this.preset = 'highVolumeSession';
    return this;
  }

  /** Warmup only session. */
  warmupOnly(): this {
    this.preset = 'warmupOnly';
    return this;
  }

  /** Junk volume session (grinding from start). */
  junkVolumeSession(): this {
    this.preset = 'junkVolumeSession';
    return this;
  }

  /** Failed early session. */
  failedEarlySession(): this {
    this.preset = 'failedEarlySession';
    return this;
  }

  // ===========================================================================
  // Build
  // ===========================================================================

  /** Build the ExerciseSession object. */
  build(): ExerciseSession {
    // Resolve exercise
    const exercise =
      this.targets.exercise ??
      createTestExercise(this.targets.exerciseId ?? 'test_exercise');

    // Resolve plan
    let plan: ExercisePlan;
    if (this.targets.plan) {
      plan = this.targets.plan;
    } else if (this.targets.planTargets) {
      const pb = planBuilder();
      const t = this.targets.planTargets;
      if (t.exerciseId) pb.exerciseId(t.exerciseId);
      if (t.warmupSets !== undefined) pb.warmupSets(t.warmupSets);
      if (t.workingSets !== undefined) pb.workingSets(t.workingSets);
      if (t.workingWeight !== undefined) pb.workingWeight(t.workingWeight);
      if (t.targetReps !== undefined) pb.targetReps(t.targetReps);
      if (t.rirTarget !== undefined) pb.rirTarget(t.rirTarget);
      if (t.goal) pb.goal(t.goal);
      if (t.isDiscovery) pb.discovery();
      plan = pb.build();
    } else if (this.preset) {
      plan = this.buildPlanFromComposition(SESSION_PRESETS[this.preset]);
    } else {
      plan = planBuilder()
        .workingSets(3)
        .workingWeight(this.targets.workingWeight ?? 100)
        .exerciseId(exercise.id)
        .build();
    }

    // Resolve completed sets
    let completedSets: Set[] = [];
    if (this.targets.completedSets) {
      completedSets = this.targets.completedSets;
    } else if (this.targets.completedSetTargets) {
      completedSets = this.targets.completedSetTargets.map((t) => {
        const sb = setBuilder();
        if (t.id) sb.id(t.id);
        if (t.weight !== undefined) sb.weight(t.weight);
        if (t.exerciseId) sb.exerciseId(t.exerciseId);
        if (t.exerciseName) sb.exerciseName(t.exerciseName);
        if (t.repCount !== undefined) sb.repCount(t.repCount);
        if (t.composition) sb.composition(t.composition);
        if (t.reps) sb.reps(t.reps);
        return sb.build();
      });
    } else if (this.preset) {
      completedSets = this.buildSetsFromComposition(SESSION_PRESETS[this.preset]);
    }

    return {
      id: this.targets.id ?? `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      exercise,
      plan,
      completedSets,
      restEndsAt: this.targets.restEndsAt ?? null,
      startedAt: this.targets.startedAt ?? Date.now() - 600000, // 10 min ago
    };
  }

  private buildPlanFromComposition(composition: readonly SessionSetSpec[]): ExercisePlan {
    const workingWeight = this.targets.workingWeight ?? 100;
    const sets = composition.map((spec, i) => ({
      setNumber: i + 1,
      weight: Math.round((workingWeight * spec.weightPercent) / 100 / 5) * 5,
      targetReps: 8,
      rirTarget: 2,
      isWarmup: spec.weightPercent < 80,
    }));

    return {
      exerciseId: this.targets.exercise?.id ?? this.targets.exerciseId ?? 'test_exercise',
      sets,
      defaultRestSeconds: 120,
      goal: this.targets.goal ?? TrainingGoal.HYPERTROPHY,
      generatedAt: Date.now(),
      generatedBy: 'standard',
    };
  }

  private buildSetsFromComposition(composition: readonly SessionSetSpec[]): Set[] {
    const workingWeight = this.targets.workingWeight ?? 100;

    return composition.map((spec) => {
      const weight = Math.round((workingWeight * spec.weightPercent) / 100 / 5) * 5;
      const behaviors =
        typeof spec.composition === 'string'
          ? [...SET_PRESETS[spec.composition]]
          : [...spec.composition];

      return setBuilder().weight(weight).composition(behaviors).build();
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SessionBuilder.
 *
 * @example
 * const session = sessionBuilder()
 *   .standardWorkout()
 *   .workingWeight(185)
 *   .build();
 */
export function sessionBuilder(): SessionBuilder {
  return new SessionBuilder();
}

export type { SessionBuilder };

// Re-export for convenience
export { TrainingGoal };
