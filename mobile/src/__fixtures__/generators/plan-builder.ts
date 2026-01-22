/**
 * Plan Builder
 *
 * Fluent builder for creating ExercisePlan objects.
 *
 * @example
 * // Simple plan with 3 working sets
 * planBuilder().workingSets(3).workingWeight(185).build()
 *
 * // Plan with warmups
 * planBuilder()
 *   .warmupSets(2)
 *   .workingSets(3)
 *   .workingWeight(185)
 *   .targetReps(8)
 *   .build()
 *
 * // Discovery plan
 * planBuilder()
 *   .discovery()
 *   .workingWeight(100)
 *   .build()
 */

import type { ExercisePlan, PlannedSet, PlanSource } from '@/domain/workout/models/plan';
import { TrainingGoal } from '@/domain/planning/types';

// =============================================================================
// Plan-Level Types
// =============================================================================

/**
 * Target configuration for an exercise plan.
 */
export interface PlanTargets {
  exerciseId?: string;
  warmupSets?: number;
  workingSets?: number;
  sets?: PlannedSetTargets[];
  workingWeight?: number;
  targetReps?: number;
  rirTarget?: number;
  goal?: TrainingGoal;
  defaultRestSeconds?: number;
  generatedBy?: PlanSource;
  isDiscovery?: boolean;
}

/**
 * Target configuration for a planned set.
 */
export interface PlannedSetTargets {
  setNumber?: number;
  weight?: number;
  targetReps?: number;
  rirTarget?: number;
  isWarmup?: boolean;
}

// =============================================================================
// Builder Class
// =============================================================================

class PlanBuilder {
  private targets: PlanTargets = {};

  // ===========================================================================
  // Basic Properties
  // ===========================================================================

  /** Set the exercise ID. */
  exerciseId(id: string): this {
    this.targets.exerciseId = id;
    return this;
  }

  /** Set the training goal. */
  goal(g: TrainingGoal): this {
    this.targets.goal = g;
    return this;
  }

  /** Set the default rest between sets (seconds). */
  defaultRestSeconds(s: number): this {
    this.targets.defaultRestSeconds = s;
    return this;
  }

  /** Set how the plan was generated. */
  generatedBy(source: PlanSource): this {
    this.targets.generatedBy = source;
    return this;
  }

  // ===========================================================================
  // Set Configuration
  // ===========================================================================

  /** Set the number of warmup sets. */
  warmupSets(n: number): this {
    this.targets.warmupSets = n;
    return this;
  }

  /** Set the number of working sets. */
  workingSets(n: number): this {
    this.targets.workingSets = n;
    return this;
  }

  /** Set explicit per-set configuration. */
  sets(sets: PlannedSetTargets[]): this {
    this.targets.sets = sets;
    return this;
  }

  // ===========================================================================
  // Working Set Defaults
  // ===========================================================================

  /** Set the working weight. */
  workingWeight(w: number): this {
    this.targets.workingWeight = w;
    return this;
  }

  /** Set the target reps per set. */
  targetReps(r: number): this {
    this.targets.targetReps = r;
    return this;
  }

  /** Set the target RIR (reps in reserve). */
  rirTarget(r: number): this {
    this.targets.rirTarget = r;
    return this;
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /** Configure as a discovery plan. */
  discovery(): this {
    this.targets.isDiscovery = true;
    this.targets.generatedBy = 'discovery';
    return this;
  }

  // ===========================================================================
  // Build
  // ===========================================================================

  /** Build the ExercisePlan object. */
  build(): ExercisePlan {
    const {
      exerciseId = 'test_exercise',
      warmupSets = 0,
      workingSets = 3,
      workingWeight = 100,
      targetReps = 8,
      rirTarget = 2,
      goal = TrainingGoal.HYPERTROPHY,
      defaultRestSeconds = 120,
      generatedBy = 'standard',
      isDiscovery = false,
    } = this.targets;

    // Generate planned sets
    const sets: PlannedSet[] = [];
    let setNumber = 1;

    // Warmups at progressive percentages
    const warmupPercentages = [0.5, 0.75, 0.9];
    for (let i = 0; i < warmupSets; i++) {
      const percentage = warmupPercentages[Math.min(i, warmupPercentages.length - 1)];
      sets.push({
        setNumber: setNumber++,
        weight: Math.round((workingWeight * percentage) / 5) * 5,
        targetReps: 5,
        rirTarget: 4,
        isWarmup: true,
      });
    }

    // Working sets
    for (let i = 0; i < workingSets; i++) {
      sets.push({
        setNumber: setNumber++,
        weight: workingWeight,
        targetReps,
        rirTarget,
        isWarmup: false,
      });
    }

    // Apply explicit set targets if provided
    if (this.targets.sets) {
      for (let i = 0; i < this.targets.sets.length && i < sets.length; i++) {
        const explicit = this.targets.sets[i];
        if (explicit.setNumber !== undefined) sets[i].setNumber = explicit.setNumber;
        if (explicit.weight !== undefined) sets[i].weight = explicit.weight;
        if (explicit.targetReps !== undefined) sets[i].targetReps = explicit.targetReps;
        if (explicit.rirTarget !== undefined) sets[i].rirTarget = explicit.rirTarget;
        if (explicit.isWarmup !== undefined) sets[i].isWarmup = explicit.isWarmup;
      }
    }

    return {
      exerciseId,
      sets,
      defaultRestSeconds,
      goal,
      generatedAt: Date.now(),
      generatedBy: isDiscovery ? 'discovery' : generatedBy,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PlanBuilder.
 *
 * @example
 * const plan = planBuilder()
 *   .warmupSets(2)
 *   .workingSets(3)
 *   .workingWeight(185)
 *   .build();
 */
export function planBuilder(): PlanBuilder {
  return new PlanBuilder();
}

export type { PlanBuilder };

// Re-export for convenience
export { TrainingGoal };
