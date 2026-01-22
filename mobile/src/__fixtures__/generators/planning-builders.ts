/**
 * Planning Builders
 *
 * Fluent builders for creating planning domain objects:
 * - HistoricalMetrics
 * - SessionMetrics
 * - PlanningContext
 * - DiscoverySetResult
 *
 * @example
 * // Fresh session metrics
 * sessionMetricsBuilder().fresh().build()
 *
 * // Experienced user historical metrics
 * historicalMetricsBuilder().experienced(100).build()
 *
 * // Full planning context
 * planningContextBuilder()
 *   .goal(TrainingGoal.HYPERTROPHY)
 *   .sessionMetrics(sessionMetricsBuilder().fatigued().build())
 *   .historicalMetrics(historicalMetricsBuilder().experienced(100).build())
 *   .completedSets([set1, set2])
 *   .build()
 */

import {
  type PlanningContext,
  type HistoricalMetrics,
  type PlanningOverrides,
  type DiscoverySetResult,
  type DiscoveryPhase,
  TrainingGoal,
  TrainingLevel,
  createEmptyHistoricalMetrics,
} from '@/domain/planning/types';
import {
  type SessionMetrics,
  type StrengthEstimate,
  type ReadinessEstimate,
  type FatigueEstimate,
} from '@/domain/workout/metrics/types';
import type { Set } from '@/domain/workout/models/set';
import { setBuilder, type SetTargets } from './set-builder';

// =============================================================================
// Planning Target Types
// =============================================================================

/**
 * Target configuration for HistoricalMetrics.
 */
export interface HistoricalMetricsTargets {
  recentEstimated1RM?: number | null;
  trend?: 'improving' | 'stable' | 'declining' | null;
  lastWorkingWeight?: number | null;
  avgRepsAtWeight?: number | null;
  sessionCount?: number;
  daysSinceLastSession?: number | null;
  velocityBaseline?: Record<number, number> | null;
}

/**
 * Target configuration for SessionMetrics.
 */
export interface SessionMetricsTargets {
  fatigueLevel?: number;
  isJunkVolume?: boolean;
  velocityRecoveryPercent?: number;
  repDropPercent?: number;
  estimated1RM?: number;
  strengthConfidence?: number;
  readinessZone?: 'green' | 'yellow' | 'red';
  volumeAccumulated?: number;
  effectiveVolume?: number;
}

/**
 * Target configuration for DiscoverySetResult.
 */
export interface DiscoverySetResultTargets {
  weight?: number;
  reps?: number;
  meanVelocity?: number;
  peakVelocity?: number;
  rpe?: number;
  failed?: boolean;
  notes?: string;
}

/**
 * Target configuration for PlanningContext.
 */
export interface PlanningContextTargets {
  exerciseId?: string;
  goal?: TrainingGoal;
  level?: TrainingLevel;
  exerciseType?: 'compound' | 'isolation';
  sessionMetrics?: SessionMetrics | SessionMetricsTargets;
  historicalMetrics?: HistoricalMetrics | HistoricalMetricsTargets;
  completedSets?: Set[];
  completedSetTargets?: SetTargets[];
  originalPlanSetCount?: number;
  overrides?: PlanningOverrides;
  isDiscovery?: boolean;
  discoveryPhase?: DiscoveryPhase;
  discoveryHistory?: DiscoverySetResult[] | DiscoverySetResultTargets[];
}

// =============================================================================
// Historical Metrics Builder
// =============================================================================

class HistoricalMetricsBuilder {
  private targets: HistoricalMetricsTargets = {};

  /** Set recent estimated 1RM. */
  recentEstimated1RM(v: number | null): this {
    this.targets.recentEstimated1RM = v;
    return this;
  }

  /** Set trend direction. */
  trend(t: 'improving' | 'stable' | 'declining' | null): this {
    this.targets.trend = t;
    return this;
  }

  /** Set last working weight. */
  lastWorkingWeight(w: number | null): this {
    this.targets.lastWorkingWeight = w;
    return this;
  }

  /** Set average reps at last weight. */
  avgRepsAtWeight(r: number | null): this {
    this.targets.avgRepsAtWeight = r;
    return this;
  }

  /** Set session count. */
  sessionCount(c: number): this {
    this.targets.sessionCount = c;
    return this;
  }

  /** Set days since last session. */
  daysSinceLastSession(d: number | null): this {
    this.targets.daysSinceLastSession = d;
    return this;
  }

  /** Set velocity baseline data. */
  velocityBaseline(v: Record<number, number> | null): this {
    this.targets.velocityBaseline = v;
    return this;
  }

  // ===========================================================================
  // Presets
  // ===========================================================================

  /** New exercise (no history). */
  newExercise(): this {
    this.targets = {
      recentEstimated1RM: null,
      trend: null,
      lastWorkingWeight: null,
      avgRepsAtWeight: null,
      sessionCount: 0,
      daysSinceLastSession: null,
      velocityBaseline: null,
    };
    return this;
  }

  /** Experienced user with stable performance. */
  experienced(workingWeight: number = 100, estimated1RM?: number): this {
    const e1rm = estimated1RM ?? workingWeight * 1.5;
    this.targets = {
      recentEstimated1RM: e1rm,
      trend: 'stable',
      lastWorkingWeight: workingWeight,
      avgRepsAtWeight: 8,
      sessionCount: 20,
      daysSinceLastSession: 3,
      velocityBaseline: {
        [workingWeight * 0.8]: 0.65,
        [workingWeight * 0.9]: 0.55,
        [workingWeight]: 0.45,
      },
    };
    return this;
  }

  /** User showing improvement. */
  improving(workingWeight: number = 100): this {
    this.targets = {
      recentEstimated1RM: workingWeight * 1.5,
      trend: 'improving',
      lastWorkingWeight: workingWeight - 5,
      avgRepsAtWeight: 10,
      sessionCount: 8,
      daysSinceLastSession: 2,
      velocityBaseline: {
        [workingWeight * 0.8]: 0.7,
        [workingWeight * 0.9]: 0.6,
        [workingWeight]: 0.5,
      },
    };
    return this;
  }

  /** User showing decline. */
  declining(workingWeight: number = 100): this {
    this.targets = {
      recentEstimated1RM: workingWeight * 1.4,
      trend: 'declining',
      lastWorkingWeight: workingWeight + 5,
      avgRepsAtWeight: 5,
      sessionCount: 10,
      daysSinceLastSession: 7,
      velocityBaseline: {
        [workingWeight * 0.8]: 0.55,
        [workingWeight * 0.9]: 0.45,
        [workingWeight]: 0.35,
      },
    };
    return this;
  }

  /** Build the HistoricalMetrics object. */
  build(): HistoricalMetrics {
    // If nothing set, return empty metrics
    if (Object.keys(this.targets).length === 0) {
      return createEmptyHistoricalMetrics();
    }

    return {
      recentEstimated1RM: this.targets.recentEstimated1RM ?? 150,
      trend: this.targets.trend ?? 'stable',
      lastWorkingWeight: this.targets.lastWorkingWeight ?? 100,
      avgRepsAtWeight: this.targets.avgRepsAtWeight ?? 8,
      sessionCount: this.targets.sessionCount ?? 5,
      daysSinceLastSession: this.targets.daysSinceLastSession ?? 3,
      velocityBaseline: this.targets.velocityBaseline ?? { 80: 0.65, 90: 0.55, 100: 0.45 },
    };
  }
}

export function historicalMetricsBuilder(): HistoricalMetricsBuilder {
  return new HistoricalMetricsBuilder();
}

// =============================================================================
// Session Metrics Builder
// =============================================================================

class SessionMetricsBuilder {
  private targets: SessionMetricsTargets = {};

  /** Set fatigue level (0-1). */
  fatigueLevel(l: number): this {
    this.targets.fatigueLevel = l;
    return this;
  }

  /** Set whether this is junk volume. */
  isJunkVolume(v: boolean): this {
    this.targets.isJunkVolume = v;
    return this;
  }

  /** Set velocity recovery percentage. */
  velocityRecoveryPercent(p: number): this {
    this.targets.velocityRecoveryPercent = p;
    return this;
  }

  /** Set rep drop percentage. */
  repDropPercent(p: number): this {
    this.targets.repDropPercent = p;
    return this;
  }

  /** Set estimated 1RM. */
  estimated1RM(e: number): this {
    this.targets.estimated1RM = e;
    return this;
  }

  /** Set strength confidence (0-1). */
  strengthConfidence(c: number): this {
    this.targets.strengthConfidence = c;
    return this;
  }

  /** Set readiness zone. */
  readinessZone(z: 'green' | 'yellow' | 'red'): this {
    this.targets.readinessZone = z;
    return this;
  }

  /** Set volume accumulated. */
  volumeAccumulated(v: number): this {
    this.targets.volumeAccumulated = v;
    return this;
  }

  /** Set effective volume. */
  effectiveVolume(v: number): this {
    this.targets.effectiveVolume = v;
    return this;
  }

  // ===========================================================================
  // Presets
  // ===========================================================================

  /** Fresh session (early in workout). */
  fresh(): this {
    this.targets = {
      fatigueLevel: 0.1,
      isJunkVolume: false,
      velocityRecoveryPercent: 98,
      repDropPercent: 0,
      estimated1RM: 150,
      strengthConfidence: 0.6,
      readinessZone: 'green',
      volumeAccumulated: 500,
      effectiveVolume: 500,
    };
    return this;
  }

  /** Fatigued session (late in workout). */
  fatigued(): this {
    this.targets = {
      fatigueLevel: 0.7,
      isJunkVolume: false,
      velocityRecoveryPercent: 70,
      repDropPercent: 30,
      estimated1RM: 150,
      strengthConfidence: 0.85,
      readinessZone: 'yellow',
      volumeAccumulated: 3500,
      effectiveVolume: 3000,
    };
    return this;
  }

  /** Junk volume state. */
  junkVolume(): this {
    this.targets = {
      fatigueLevel: 0.9,
      isJunkVolume: true,
      velocityRecoveryPercent: 55,
      repDropPercent: 55,
      estimated1RM: 150,
      strengthConfidence: 0.9,
      readinessZone: 'red',
      volumeAccumulated: 4000,
      effectiveVolume: 2500,
    };
    return this;
  }

  /** Build the SessionMetrics object. */
  build(): SessionMetrics {
    const {
      fatigueLevel = 0.3,
      isJunkVolume = false,
      velocityRecoveryPercent = 85,
      repDropPercent = 10,
      estimated1RM = 150,
      strengthConfidence = 0.8,
      readinessZone = 'green',
      volumeAccumulated = 2000,
      effectiveVolume = 1800,
    } = this.targets;

    const strength: StrengthEstimate = {
      estimated1RM,
      confidence: strengthConfidence,
      source: 'session',
    };

    const readiness: ReadinessEstimate = {
      zone: readinessZone,
      velocityPercent: readinessZone === 'green' ? 100 : readinessZone === 'yellow' ? 92 : 82,
      confidence: 0.7,
      adjustments: {
        weight: readinessZone === 'green' ? 0 : readinessZone === 'yellow' ? -5 : -10,
        volume: readinessZone === 'green' ? 1.0 : readinessZone === 'yellow' ? 0.9 : 0.75,
      },
      message:
        readinessZone === 'green'
          ? 'Good to go'
          : readinessZone === 'yellow'
            ? 'Slightly fatigued'
            : 'Consider reducing load',
    };

    const fatigue: FatigueEstimate = {
      level: fatigueLevel,
      isJunkVolume,
      velocityRecoveryPercent,
      repDropPercent,
    };

    return {
      strength,
      readiness,
      fatigue,
      volumeAccumulated,
      effectiveVolume,
    };
  }
}

export function sessionMetricsBuilder(): SessionMetricsBuilder {
  return new SessionMetricsBuilder();
}

// =============================================================================
// Discovery Set Result Builder
// =============================================================================

class DiscoverySetResultBuilder {
  private targets: DiscoverySetResultTargets = {};

  /** Set weight. */
  weight(w: number): this {
    this.targets.weight = w;
    return this;
  }

  /** Set reps completed. */
  reps(r: number): this {
    this.targets.reps = r;
    return this;
  }

  /** Set mean velocity. */
  meanVelocity(v: number): this {
    this.targets.meanVelocity = v;
    return this;
  }

  /** Set peak velocity. */
  peakVelocity(v: number): this {
    this.targets.peakVelocity = v;
    return this;
  }

  /** Set RPE. */
  rpe(r: number): this {
    this.targets.rpe = r;
    return this;
  }

  /** Mark as failed. */
  failed(): this {
    this.targets.failed = true;
    return this;
  }

  /** Set notes. */
  notes(n: string): this {
    this.targets.notes = n;
    return this;
  }

  /** Build the DiscoverySetResult object. */
  build(): DiscoverySetResult {
    return {
      weight: this.targets.weight ?? 80,
      reps: this.targets.reps ?? 5,
      meanVelocity: this.targets.meanVelocity ?? 0.55,
      peakVelocity: this.targets.peakVelocity ?? 0.75,
      rpe: this.targets.rpe ?? 7,
      failed: this.targets.failed ?? false,
      notes: this.targets.notes,
    };
  }
}

export function discoverySetResultBuilder(): DiscoverySetResultBuilder {
  return new DiscoverySetResultBuilder();
}

// =============================================================================
// Planning Context Builder
// =============================================================================

class PlanningContextBuilder {
  private targets: PlanningContextTargets = {};

  /** Set exercise ID. */
  exerciseId(id: string): this {
    this.targets.exerciseId = id;
    return this;
  }

  /** Set training goal. */
  goal(g: TrainingGoal): this {
    this.targets.goal = g;
    return this;
  }

  /** Set training level. */
  level(l: TrainingLevel): this {
    this.targets.level = l;
    return this;
  }

  /** Set exercise type. */
  exerciseType(t: 'compound' | 'isolation'): this {
    this.targets.exerciseType = t;
    return this;
  }

  /** Set session metrics (can be full object or targets to generate). */
  sessionMetrics(m: SessionMetrics | SessionMetricsTargets): this {
    this.targets.sessionMetrics = m;
    return this;
  }

  /** Set historical metrics (can be full object or targets to generate). */
  historicalMetrics(m: HistoricalMetrics | HistoricalMetricsTargets): this {
    this.targets.historicalMetrics = m;
    return this;
  }

  /** Set completed sets. */
  completedSets(sets: Set[]): this {
    this.targets.completedSets = sets;
    return this;
  }

  /** Set completed set targets (sets will be generated). */
  completedSetTargets(targets: SetTargets[]): this {
    this.targets.completedSetTargets = targets;
    return this;
  }

  /** Set original plan set count. */
  originalPlanSetCount(n: number): this {
    this.targets.originalPlanSetCount = n;
    return this;
  }

  /** Set overrides. */
  overrides(o: PlanningOverrides): this {
    this.targets.overrides = o;
    return this;
  }

  /** Mark as discovery session. */
  discovery(): this {
    this.targets.isDiscovery = true;
    return this;
  }

  /** Set discovery phase. */
  discoveryPhase(p: DiscoveryPhase): this {
    this.targets.discoveryPhase = p;
    return this;
  }

  /** Set discovery history. */
  discoveryHistory(h: DiscoverySetResult[] | DiscoverySetResultTargets[]): this {
    this.targets.discoveryHistory = h;
    return this;
  }

  /** Build the PlanningContext object. */
  build(): PlanningContext {
    // Resolve session metrics
    let sessionMetrics: SessionMetrics | null = null;
    if (this.targets.sessionMetrics) {
      if ('strength' in this.targets.sessionMetrics) {
        sessionMetrics = this.targets.sessionMetrics as SessionMetrics;
      } else {
        const builder = sessionMetricsBuilder();
        const t = this.targets.sessionMetrics as SessionMetricsTargets;
        if (t.fatigueLevel !== undefined) builder.fatigueLevel(t.fatigueLevel);
        if (t.isJunkVolume !== undefined) builder.isJunkVolume(t.isJunkVolume);
        if (t.velocityRecoveryPercent !== undefined) builder.velocityRecoveryPercent(t.velocityRecoveryPercent);
        if (t.repDropPercent !== undefined) builder.repDropPercent(t.repDropPercent);
        if (t.estimated1RM !== undefined) builder.estimated1RM(t.estimated1RM);
        if (t.strengthConfidence !== undefined) builder.strengthConfidence(t.strengthConfidence);
        if (t.readinessZone !== undefined) builder.readinessZone(t.readinessZone);
        if (t.volumeAccumulated !== undefined) builder.volumeAccumulated(t.volumeAccumulated);
        if (t.effectiveVolume !== undefined) builder.effectiveVolume(t.effectiveVolume);
        sessionMetrics = builder.build();
      }
    }

    // Resolve historical metrics
    let historicalMetrics: HistoricalMetrics | null = null;
    if (this.targets.historicalMetrics) {
      if ('sessionCount' in this.targets.historicalMetrics && 'recentEstimated1RM' in this.targets.historicalMetrics) {
        historicalMetrics = this.targets.historicalMetrics as HistoricalMetrics;
      } else {
        const builder = historicalMetricsBuilder();
        const t = this.targets.historicalMetrics as HistoricalMetricsTargets;
        if (t.recentEstimated1RM !== undefined) builder.recentEstimated1RM(t.recentEstimated1RM);
        if (t.trend !== undefined) builder.trend(t.trend);
        if (t.lastWorkingWeight !== undefined) builder.lastWorkingWeight(t.lastWorkingWeight);
        if (t.avgRepsAtWeight !== undefined) builder.avgRepsAtWeight(t.avgRepsAtWeight);
        if (t.sessionCount !== undefined) builder.sessionCount(t.sessionCount);
        if (t.daysSinceLastSession !== undefined) builder.daysSinceLastSession(t.daysSinceLastSession);
        if (t.velocityBaseline !== undefined) builder.velocityBaseline(t.velocityBaseline);
        historicalMetrics = builder.build();
      }
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
    }

    // Resolve discovery history
    let discoveryHistory: DiscoverySetResult[] | undefined;
    if (this.targets.discoveryHistory) {
      discoveryHistory = this.targets.discoveryHistory.map((item) => {
        if ('meanVelocity' in item && typeof item.meanVelocity === 'number') {
          return item as DiscoverySetResult;
        }
        const builder = discoverySetResultBuilder();
        const t = item as DiscoverySetResultTargets;
        if (t.weight !== undefined) builder.weight(t.weight);
        if (t.reps !== undefined) builder.reps(t.reps);
        if (t.meanVelocity !== undefined) builder.meanVelocity(t.meanVelocity);
        if (t.peakVelocity !== undefined) builder.peakVelocity(t.peakVelocity);
        if (t.rpe !== undefined) builder.rpe(t.rpe);
        if (t.failed) builder.failed();
        if (t.notes !== undefined) builder.notes(t.notes);
        return builder.build();
      });
    }

    const context: PlanningContext = {
      exerciseId: this.targets.exerciseId ?? 'test_exercise',
      goal: this.targets.goal ?? TrainingGoal.HYPERTROPHY,
      level: this.targets.level ?? TrainingLevel.INTERMEDIATE,
      exerciseType: this.targets.exerciseType ?? 'compound',
      sessionMetrics,
      historicalMetrics,
      completedSets,
      isDiscovery: this.targets.isDiscovery ?? false,
    };

    if (this.targets.originalPlanSetCount !== undefined) {
      context.originalPlanSetCount = this.targets.originalPlanSetCount;
    }

    if (this.targets.overrides) {
      context.overrides = this.targets.overrides;
    }

    if (this.targets.discoveryPhase) {
      context.discoveryPhase = this.targets.discoveryPhase;
    }

    if (discoveryHistory) {
      context.discoveryHistory = discoveryHistory;
    }

    return context;
  }
}

export function planningContextBuilder(): PlanningContextBuilder {
  return new PlanningContextBuilder();
}

// =============================================================================
// Export Types and Builders
// =============================================================================

export type { HistoricalMetricsBuilder, SessionMetricsBuilder, DiscoverySetResultBuilder, PlanningContextBuilder };
export { TrainingGoal, TrainingLevel };
