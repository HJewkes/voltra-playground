/**
 * Exercise Session Converters
 *
 * Conversion functions between domain models and storage schemas.
 * These adapters create a clean boundary between domain logic and persistence.
 */

import type {
  Set,
  Rep,
  StoredRep,
  ExerciseSession,
  ExercisePlan,
  PlannedSet,
  WorkoutSample,
} from '@/domain/workout';
import { EXERCISE_CATALOG, createExercise } from '@/domain/exercise';
import { isDebugTelemetryEnabled } from '@/data/debug-config';
import type {
  StoredExerciseSession,
  StoredExercisePlan,
  StoredSessionSet,
  ExerciseSessionSummary,
  TerminationReason,
} from './exercise-session-schema';

// =============================================================================
// Domain → Storage
// =============================================================================

/**
 * Convert domain ExerciseSession to storage format.
 * @param session - The domain ExerciseSession
 * @param status - Session status
 * @param terminationReason - Optional termination reason
 * @param rawSamplesForLastSet - Optional raw samples to attach to the last set (debug mode)
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
        // Only pass raw samples for the last set (the one just completed)
        index === lastSetIndex ? rawSamplesForLastSet : undefined
      )
    ),
    status,
    terminationReason,
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
  // PlannedSet is already a plain object, just ensure we copy it
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
 * Convert domain Set to StoredSessionSet.
 * @param set - The domain Set object
 * @param setIndex - Index of the set within the session
 * @param rawSamples - Optional raw WorkoutSamples (only included if debug telemetry enabled)
 */
export function toStoredSessionSet(
  set: Set,
  setIndex: number,
  rawSamples?: WorkoutSample[]
): StoredSessionSet {
  const stored: StoredSessionSet = {
    setIndex,
    weight: set.weight,
    chains: set.chains,
    eccentric: set.eccentricOffset,
    reps: set.reps.map(toStoredRep),
    startTime: set.timestamp.start,
    endTime: set.timestamp.end ?? Date.now(),
    meanVelocity: set.metrics.velocity.concentricBaseline,
    estimatedRPE: set.metrics.effort.rpe,
    estimatedRIR: set.metrics.effort.rir,
    velocityLossPercent: Math.abs(set.metrics.velocity.concentricDelta),
  };

  // Only include raw samples if debug telemetry is enabled
  if (rawSamples && isDebugTelemetryEnabled()) {
    stored.rawSamples = rawSamples;
  }

  return stored;
}

/**
 * Convert Rep to StoredRep for persistence.
 */
function toStoredRep(rep: Rep): StoredRep {
  return {
    repNumber: rep.repNumber,
    timestamp: rep.timestamp,
    metrics: rep.metrics,
  };
}

// =============================================================================
// Storage → Domain
// =============================================================================

/**
 * Convert storage format back to domain ExerciseSession.
 */
export function fromStoredExerciseSession(stored: StoredExerciseSession): ExerciseSession {
  // Look up or create exercise
  const exercise =
    EXERCISE_CATALOG[stored.exerciseId] ??
    createExercise({
      id: stored.exerciseId,
      name: stored.exerciseName ?? stored.exerciseId,
    });

  return {
    id: stored.id,
    exercise,
    plan: fromStoredPlan(stored.plan),
    completedSets: stored.completedSets.map(fromStoredSessionSet),
    restEndsAt: null, // Not persisted
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
 * Convert StoredSessionSet to domain Set.
 */
export function fromStoredSessionSet(stored: StoredSessionSet): Set {
  const reps = stored.reps.map(fromStoredRep);

  // Calculate total duration
  const duration = (stored.endTime - stored.startTime) / 1000;

  // Calculate time under tension from reps
  const timeUnderTension = reps.reduce((sum, rep) => {
    return sum + rep.metrics.concentricDuration + rep.metrics.eccentricDuration;
  }, 0);

  return {
    id: `set_${stored.startTime}_${stored.setIndex}`,
    exerciseId: '', // Will be set from parent session
    weight: stored.weight,
    chains: stored.chains,
    eccentricOffset: stored.eccentric,
    reps,
    timestamp: {
      start: stored.startTime,
      end: stored.endTime,
    },
    metrics: {
      repCount: reps.length,
      totalDuration: duration,
      timeUnderTension,
      velocity: {
        concentricBaseline: stored.meanVelocity,
        eccentricBaseline: 0,
        concentricLast:
          reps.length > 0
            ? reps[reps.length - 1].metrics.concentricMeanVelocity
            : stored.meanVelocity,
        eccentricLast: 0,
        concentricDelta: -stored.velocityLossPercent,
        eccentricDelta: 0,
        concentricByRep: reps.map((r) => r.metrics.concentricMeanVelocity),
        eccentricByRep: reps.map((r) => r.metrics.eccentricMeanVelocity),
      },
      fatigue: {
        fatigueIndex: stored.velocityLossPercent,
        eccentricControlScore: 100,
        formWarning: null,
      },
      effort: {
        rpe: stored.estimatedRPE,
        rir: stored.estimatedRIR,
        confidence: 'medium',
      },
    },
  };
}

/**
 * Convert StoredRep to domain Rep.
 * Note: Phase objects are reconstructed with minimal data since storage doesn't preserve them.
 */
function fromStoredRep(stored: StoredRep): Rep {
  // Create placeholder phases - we don't have the raw sample data in storage
  const emptyPhase = (type: number) => ({
    type,
    timestamp: stored.timestamp,
    samples: [],
    metrics: {
      duration: stored.metrics.concentricDuration,
      meanVelocity: stored.metrics.concentricMeanVelocity,
      peakVelocity: stored.metrics.concentricPeakVelocity,
      meanForce: 0,
      peakForce: stored.metrics.peakForce,
      startPosition: 0,
      endPosition: stored.metrics.rangeOfMotion,
    },
  });

  return {
    repNumber: stored.repNumber,
    timestamp: stored.timestamp,
    // Reconstruct phases with available metrics (MovementPhase: 0=HOLD, 1=CONCENTRIC, 2=ECCENTRIC)
    concentric: {
      ...emptyPhase(1),
      metrics: {
        duration: stored.metrics.concentricDuration,
        meanVelocity: stored.metrics.concentricMeanVelocity,
        peakVelocity: stored.metrics.concentricPeakVelocity,
        meanForce: 0,
        peakForce: stored.metrics.peakForce,
        startPosition: 0,
        endPosition: stored.metrics.rangeOfMotion,
      },
    },
    eccentric: {
      ...emptyPhase(2),
      metrics: {
        duration: stored.metrics.eccentricDuration,
        meanVelocity: stored.metrics.eccentricMeanVelocity,
        peakVelocity: stored.metrics.eccentricPeakVelocity,
        meanForce: 0,
        peakForce: 0,
        startPosition: stored.metrics.rangeOfMotion,
        endPosition: 0,
      },
    },
    holdAtTop:
      stored.metrics.topPauseTime > 0
        ? {
            ...emptyPhase(0),
            metrics: {
              duration: stored.metrics.topPauseTime,
              meanVelocity: 0,
              peakVelocity: 0,
              meanForce: 0,
              peakForce: 0,
              startPosition: stored.metrics.rangeOfMotion,
              endPosition: stored.metrics.rangeOfMotion,
            },
          }
        : null,
    holdAtBottom:
      stored.metrics.bottomPauseTime > 0
        ? {
            ...emptyPhase(0),
            metrics: {
              duration: stored.metrics.bottomPauseTime,
              meanVelocity: 0,
              peakVelocity: 0,
              meanForce: 0,
              peakForce: 0,
              startPosition: 0,
              endPosition: 0,
            },
          }
        : null,
    metrics: stored.metrics,
  };
}

// =============================================================================
// Summary Conversion
// =============================================================================

/**
 * Convert a StoredExerciseSession to a lightweight summary for list display.
 */
export function toExerciseSessionSummary(session: StoredExerciseSession): ExerciseSessionSummary {
  const totalReps = session.completedSets.reduce((sum, set) => sum + set.reps.length, 0);

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
