/**
 * Session Generator
 *
 * Generates realistic StoredExerciseSession objects for testing and seeding.
 * Produces the new storage schema format with StoredRep containing
 * per-phase sample aggregates.
 */

import { v4 as uuid } from 'uuid';
import type { TrainingGoal } from '@/domain/planning';
import type {
  StoredExerciseSession,
  StoredSessionSet,
  StoredExercisePlan,
  StoredRep,
} from '@/data/exercise-session';
import type { PlannedSet } from '@/domain/workout';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';
import { generateSampleStream } from './sample-generator';

// =============================================================================
// Types
// =============================================================================

export interface GenerateSessionOptions {
  exerciseId?: string;
  exerciseName?: string;
  setCount?: number;
  goal?: TrainingGoal;
  isDiscovery?: boolean;
  daysAgo?: number;
  weight?: number;
  targetReps?: number;
  includeRawSamples?: boolean;
}

export interface GenerateSetOptions {
  setIndex?: number;
  weight?: number;
  repCount?: number;
  startingVelocity?: number;
  fatigueRate?: number;
  includeRawSamples?: boolean;
}

// =============================================================================
// Sample Helpers
// =============================================================================

function generatePhaseSamples(
  phase: MovementPhase,
  velocity: number,
  force: number,
  startTime: number,
  startSequence: number,
  sampleCount: number = 10,
): { samples: WorkoutSample[]; endSequence: number; endTime: number } {
  const samples: WorkoutSample[] = [];
  const sampleInterval = phase === MovementPhase.CONCENTRIC ? 80 : 150;
  let seq = startSequence;
  let time = startTime;

  for (let i = 0; i < sampleCount; i++) {
    const progress = i / (sampleCount - 1 || 1);
    const sampleVelocity = velocity * (0.7 + 0.6 * Math.sin(progress * Math.PI));
    const position = phase === MovementPhase.CONCENTRIC ? progress : 1 - progress;

    samples.push({
      sequence: seq++,
      timestamp: time,
      phase,
      position,
      velocity: sampleVelocity,
      force: force * (0.8 + 0.4 * progress),
    });
    time += sampleInterval;
  }

  return { samples, endSequence: seq, endTime: time };
}

// =============================================================================
// Rep Generator
// =============================================================================

function generateStoredRep(
  repNumber: number,
  velocity: number,
  weight: number,
  startTime: number,
  startSequence: number,
): { rep: StoredRep; endTime: number; endSequence: number } {
  const force = weight * 1.5;

  const conc = generatePhaseSamples(
    MovementPhase.CONCENTRIC,
    velocity,
    force,
    startTime,
    startSequence,
  );

  const ecc = generatePhaseSamples(
    MovementPhase.ECCENTRIC,
    velocity * 0.5,
    force * 0.8,
    conc.endTime,
    conc.endSequence,
  );

  return {
    rep: {
      repNumber,
      concentric: { samples: conc.samples },
      eccentric: { samples: ecc.samples },
    },
    endTime: ecc.endTime,
    endSequence: ecc.endSequence,
  };
}

// =============================================================================
// Set Generator
// =============================================================================

export function generateStoredSet(options: GenerateSetOptions = {}): StoredSessionSet {
  const {
    setIndex = 0,
    weight = 100,
    repCount = 8,
    startingVelocity = 0.8,
    fatigueRate = 0.03,
    includeRawSamples = false,
  } = options;

  const startTime = Date.now();
  const reps: StoredRep[] = [];
  let currentTime = startTime;
  let currentSequence = 0;

  for (let i = 0; i < repCount; i++) {
    const velocity = startingVelocity - i * fatigueRate;
    const result = generateStoredRep(i + 1, velocity, weight, currentTime, currentSequence);
    reps.push(result.rep);
    currentTime = result.endTime + 400;
    currentSequence = result.endSequence;
  }

  const velocityLoss =
    repCount > 1
      ? ((startingVelocity - (startingVelocity - (repCount - 1) * fatigueRate)) /
          startingVelocity) *
        100
      : 0;

  const set: StoredSessionSet = {
    setIndex,
    weight,
    reps,
    startTime,
    endTime: currentTime,
    meanVelocity: startingVelocity - (repCount / 2) * fatigueRate,
    estimatedRPE: 6 + velocityLoss / 10,
    estimatedRIR: Math.max(0, 5 - velocityLoss / 10),
    velocityLossPercent: velocityLoss,
  };

  if (includeRawSamples) {
    set.rawSamples = generateSampleStream({
      repCount,
      weight,
      startingVelocity,
      fatigueRate,
      startTime,
    });
  }

  return set;
}

// =============================================================================
// Session Generator
// =============================================================================

export function generateStoredSession(options: GenerateSessionOptions = {}): StoredExerciseSession {
  const {
    exerciseId = 'cable_row',
    exerciseName = 'Seated Cable Row',
    setCount = 4,
    goal = 'hypertrophy' as TrainingGoal,
    isDiscovery = false,
    daysAgo = 0,
    weight = 100,
    targetReps = 8,
    includeRawSamples = false,
  } = options;

  const startTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

  const plannedSets: PlannedSet[] = [];
  for (let i = 0; i < setCount; i++) {
    plannedSets.push({
      setNumber: i + 1,
      weight: isDiscovery ? weight + i * 10 : weight,
      targetReps,
      rirTarget: 2,
      isWarmup: false,
    });
  }

  const plan: StoredExercisePlan = {
    exerciseId,
    sets: plannedSets,
    defaultRestSeconds: 120,
    goal,
    generatedAt: startTime,
    generatedBy: isDiscovery ? 'discovery' : 'standard',
  };

  const completedSets: StoredSessionSet[] = [];
  for (let i = 0; i < setCount; i++) {
    const setWeight = isDiscovery ? weight + i * 10 : weight;
    const setFatigueMultiplier = 1 - i * 0.05;
    completedSets.push(
      generateStoredSet({
        setIndex: i,
        weight: setWeight,
        repCount: targetReps - (isDiscovery ? i : 0),
        startingVelocity: 0.8 * setFatigueMultiplier,
        fatigueRate: 0.03,
        includeRawSamples,
      }),
    );
  }

  return {
    id: uuid(),
    exerciseId,
    exerciseName,
    startTime,
    endTime: startTime + setCount * 5 * 60 * 1000,
    plan,
    completedSets,
    status: 'completed',
    terminationReason: isDiscovery ? 'profile_complete' : 'plan_exhausted',
  };
}
