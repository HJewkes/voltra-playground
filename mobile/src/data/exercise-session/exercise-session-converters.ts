/**
 * Exercise Session Converters
 *
 * Conversion functions between domain models and storage schemas.
 * Supports both the new schema (v2: per-phase samples) and legacy schema
 * (v1: StoredRep with pre-computed metrics).
 */

import {
  type CompletedSet,
  type ExerciseSession,
  type ExercisePlan,
  type PlannedSet,
  createCompletedSet,
} from '@/domain/workout';
import {
  type Set as AnalyticsSet,
  type WorkoutSample,
  type Rep as AnalyticsRep,
  createSet,
  addSampleToSet,
  completeSet,
  getSetMeanVelocity,
  getSetVelocityLossPct,
  estimateSetRIR,
  getRepSamples,
} from '@voltras/workout-analytics';
import { EXERCISE_CATALOG, createExercise } from '@/domain/exercise';
import { isDebugTelemetryEnabled } from '@/data/debug-config';
import type {
  StoredExerciseSession,
  StoredExercisePlan,
  StoredSessionSet,
  StoredRep,
  ExerciseSessionSummary,
  TerminationReason,
  LegacyStoredRep,
  LegacyStoredSessionSet,
} from './exercise-session-schema';

// Current schema version
const SCHEMA_VERSION = 2;

// =============================================================================
// Domain → Storage
// =============================================================================

/**
 * Convert domain ExerciseSession to storage format.
 */
export function toStoredExerciseSession(
  session: ExerciseSession,
  status: 'in_progress' | 'completed' | 'abandoned',
  terminationReason?: TerminationReason,
  rawSamplesForLastSet?: WorkoutSample[]
): StoredExerciseSession {
  const lastSetIndex = session.completedSets.length - 1;

  return {
    id: session.id,
    exerciseId: session.exercise.id,
    exerciseName: session.exercise.name,
    startTime: session.startedAt,
    endTime: status === 'in_progress' ? null : Date.now(),
    plan: toStoredPlan(session.plan),
    completedSets: session.completedSets.map((set, index) =>
      toStoredSessionSet(
        set,
        index,
        index === lastSetIndex ? rawSamplesForLastSet : undefined
      )
    ),
    status,
    terminationReason,
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * Convert ExercisePlan to storage format.
 */
export function toStoredPlan(plan: ExercisePlan): StoredExercisePlan {
  return {
    exerciseId: plan.exerciseId,
    sets: plan.sets.map(toStoredPlannedSet),
    defaultRestSeconds: plan.defaultRestSeconds,
    goal: plan.goal,
    generatedAt: plan.generatedAt,
    generatedBy: plan.generatedBy,
  };
}

/**
 * Convert PlannedSet to storage format.
 */
function toStoredPlannedSet(set: PlannedSet): PlannedSet {
  return {
    setNumber: set.setNumber,
    weight: set.weight,
    targetReps: set.targetReps,
    repRange: set.repRange,
    rirTarget: set.rirTarget,
    isWarmup: set.isWarmup,
    targetTempo: set.targetTempo,
    targetROM: set.targetROM,
  };
}

/**
 * Convert CompletedSet to StoredSessionSet.
 */
export function toStoredSessionSet(
  set: CompletedSet,
  setIndex: number,
  rawSamples?: WorkoutSample[]
): StoredSessionSet {
  const analyticsSet = set.data;
  const rirEstimate = estimateSetRIR(analyticsSet);

  const stored: StoredSessionSet = {
    setIndex,
    weight: set.weight,
    chains: set.chains,
    eccentric: set.eccentricOffset,
    reps: analyticsSet.reps.map((rep) => toStoredRep(rep)),
    startTime: set.timestamp.start,
    endTime: set.timestamp.end,
    meanVelocity: getSetMeanVelocity(analyticsSet),
    estimatedRPE: rirEstimate.rpe,
    estimatedRIR: rirEstimate.rir,
    velocityLossPercent: Math.abs(getSetVelocityLossPct(analyticsSet)),
  };

  if (rawSamples && isDebugTelemetryEnabled()) {
    stored.rawSamples = rawSamples;
  }

  return stored;
}

/**
 * Convert library Rep to StoredRep (per-phase samples).
 */
function toStoredRep(rep: AnalyticsRep): StoredRep {
  return {
    repNumber: rep.repNumber,
    concentric: { samples: [...rep.concentric.samples] },
    eccentric: { samples: [...rep.eccentric.samples] },
  };
}

// =============================================================================
// Storage → Domain
// =============================================================================

/**
 * Convert storage format back to domain ExerciseSession.
 * Handles both v2 (new) and v1 (legacy) schema formats.
 */
export function fromStoredExerciseSession(stored: StoredExerciseSession): ExerciseSession {
  const exercise =
    EXERCISE_CATALOG[stored.exerciseId] ??
    createExercise({
      id: stored.exerciseId,
      name: stored.exerciseName ?? stored.exerciseId,
    });

  const isLegacy = !stored.schemaVersion || stored.schemaVersion < SCHEMA_VERSION;
  const completedSets = isLegacy
    ? stored.completedSets.map((s) => fromLegacyStoredSessionSet(s as unknown as LegacyStoredSessionSet))
    : stored.completedSets.map(fromStoredSessionSet);

  return {
    id: stored.id,
    exercise,
    plan: fromStoredPlan(stored.plan),
    completedSets,
    restEndsAt: null,
    startedAt: stored.startTime,
  };
}

/**
 * Convert StoredExercisePlan to domain ExercisePlan.
 */
export function fromStoredPlan(stored: StoredExercisePlan): ExercisePlan {
  return {
    exerciseId: stored.exerciseId,
    sets: stored.sets,
    defaultRestSeconds: stored.defaultRestSeconds,
    goal: stored.goal,
    generatedAt: stored.generatedAt,
    generatedBy: stored.generatedBy,
  };
}

/**
 * Convert StoredSessionSet (v2) to CompletedSet.
 * Reconstructs library Set from stored per-phase samples.
 */
export function fromStoredSessionSet(stored: StoredSessionSet): CompletedSet {
  // Reconstruct library Set by replaying samples
  let analyticsSet = createSet();

  for (const storedRep of stored.reps) {
    // Play concentric samples
    for (const sample of storedRep.concentric.samples) {
      analyticsSet = addSampleToSet(analyticsSet, sample);
    }
    // Play eccentric samples
    for (const sample of storedRep.eccentric.samples) {
      analyticsSet = addSampleToSet(analyticsSet, sample);
    }
  }

  analyticsSet = completeSet(analyticsSet);

  return createCompletedSet(analyticsSet, {
    exerciseId: '',
    weight: stored.weight,
    chains: stored.chains,
    eccentricOffset: stored.eccentric,
    startTime: stored.startTime,
    endTime: stored.endTime,
  });
}

/**
 * Convert LegacyStoredSessionSet (v1) to CompletedSet.
 * Legacy format has pre-computed metrics but no raw phase samples,
 * so we create a minimal CompletedSet with an empty analytics Set.
 * Summary values are preserved but full analytics are limited.
 */
export function fromLegacyStoredSessionSet(stored: LegacyStoredSessionSet): CompletedSet {
  // If raw samples are available (debug mode), reconstruct fully
  if (stored.rawSamples && stored.rawSamples.length > 0) {
    let analyticsSet = createSet();
    for (const sample of stored.rawSamples) {
      analyticsSet = addSampleToSet(analyticsSet, sample);
    }
    analyticsSet = completeSet(analyticsSet);

    return createCompletedSet(analyticsSet, {
      exerciseId: '',
      weight: stored.weight,
      chains: stored.chains,
      eccentricOffset: stored.eccentric,
      startTime: stored.startTime,
      endTime: stored.endTime,
    });
  }

  // No raw samples - create empty analytics set (legacy data)
  // Summary values (meanVelocity, RPE, RIR) are stored on StoredSessionSet
  // and can be read directly for list/summary displays
  const emptySet = createSet();

  return createCompletedSet(emptySet, {
    exerciseId: '',
    weight: stored.weight,
    chains: stored.chains,
    eccentricOffset: stored.eccentric,
    startTime: stored.startTime,
    endTime: stored.endTime,
  });
}

// =============================================================================
// Summary Conversion
// =============================================================================

/**
 * Convert a StoredExerciseSession to a lightweight summary for list display.
 */
export function toExerciseSessionSummary(session: StoredExerciseSession): ExerciseSessionSummary {
  const totalReps = session.completedSets.reduce((sum, set) => set.reps.length + sum, 0);

  return {
    id: session.id,
    exerciseId: session.exerciseId,
    exerciseName: session.exerciseName,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    isDiscovery: session.plan.generatedBy === 'discovery',
    totalSets: session.completedSets.length,
    plannedSets: session.plan.sets.length,
    totalReps,
    terminationReason: session.terminationReason,
  };
}
