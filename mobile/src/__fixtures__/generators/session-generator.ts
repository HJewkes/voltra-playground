/**
 * Session Generator
 *
 * Generates realistic StoredExerciseSession objects for testing and seeding.
 */

import { v4 as uuid } from 'uuid';
import type { TrainingGoal } from '@/domain/planning';
import type { StoredExerciseSession, StoredSessionSet, StoredExercisePlan } from '@/data/exercise-session';
import type { PlannedSet, StoredRep, RepMetrics } from '@/domain/workout';
import { generateSampleStream } from './sample-generator';

// =============================================================================
// Types
// =============================================================================

export interface GenerateSessionOptions {
  /** Exercise ID */
  exerciseId?: string;
  /** Exercise name */
  exerciseName?: string;
  /** Number of sets */
  setCount?: number;
  /** Training goal */
  goal?: TrainingGoal;
  /** Whether this is a discovery session */
  isDiscovery?: boolean;
  /** Days in the past to backdate */
  daysAgo?: number;
  /** Weight in lbs */
  weight?: number;
  /** Target reps per set */
  targetReps?: number;
  /** Include raw samples (debug mode simulation) */
  includeRawSamples?: boolean;
}

export interface GenerateSetOptions {
  /** Set index */
  setIndex?: number;
  /** Weight in lbs */
  weight?: number;
  /** Number of reps */
  repCount?: number;
  /** Starting velocity */
  startingVelocity?: number;
  /** Fatigue rate (velocity drop per rep) */
  fatigueRate?: number;
  /** Include raw samples */
  includeRawSamples?: boolean;
}

// =============================================================================
// Rep Generator
// =============================================================================

function generateRepMetrics(
  repNumber: number,
  velocity: number,
  force: number
): RepMetrics {
  const concentricDuration = 800 + Math.random() * 200;
  const eccentricDuration = 1500 + Math.random() * 300;
  const topPauseTime = 100 + Math.random() * 100;
  const bottomPauseTime = 200 + Math.random() * 200;
  const totalDuration = concentricDuration + eccentricDuration + topPauseTime + bottomPauseTime;

  // Generate tempo string (ecc-pause-con-pause in seconds)
  const eccSec = Math.round(eccentricDuration / 1000);
  const topSec = Math.round(topPauseTime / 1000);
  const conSec = Math.round(concentricDuration / 1000);
  const botSec = Math.round(bottomPauseTime / 1000);

  return {
    totalDuration,
    concentricDuration,
    eccentricDuration,
    topPauseTime,
    bottomPauseTime,
    tempo: `${eccSec}-${topSec}-${conSec}-${botSec}`,
    concentricMeanVelocity: velocity,
    concentricPeakVelocity: velocity * 1.3,
    eccentricMeanVelocity: velocity * 0.5,
    eccentricPeakVelocity: velocity * 0.7,
    peakForce: force,
    rangeOfMotion: 0.95 + Math.random() * 0.05,
  };
}

function generateStoredRep(repNumber: number, velocity: number, weight: number): StoredRep {
  const force = weight * 1.5;
  const metrics = generateRepMetrics(repNumber, velocity, force);
  const start = Date.now();
  return {
    repNumber,
    timestamp: { start, end: start + metrics.totalDuration },
    metrics,
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

  for (let i = 0; i < repCount; i++) {
    const velocity = startingVelocity - (i * fatigueRate);
    reps.push(generateStoredRep(i + 1, velocity, weight));
  }

  const velocityLoss = repCount > 1
    ? ((startingVelocity - (startingVelocity - (repCount - 1) * fatigueRate)) / startingVelocity) * 100
    : 0;

  const set: StoredSessionSet = {
    setIndex,
    weight,
    reps,
    startTime,
    endTime: startTime + 30000,
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

  const startTime = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);

  // Generate planned sets
  const plannedSets: PlannedSet[] = [];
  for (let i = 0; i < setCount; i++) {
    plannedSets.push({
      setNumber: i + 1,
      weight: isDiscovery ? weight + (i * 10) : weight,
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

  // Generate completed sets
  const completedSets: StoredSessionSet[] = [];
  for (let i = 0; i < setCount; i++) {
    const setWeight = isDiscovery ? weight + (i * 10) : weight;
    // Simulate some fatigue across sets
    const setFatigueMultiplier = 1 - (i * 0.05);
    completedSets.push(generateStoredSet({
      setIndex: i,
      weight: setWeight,
      repCount: targetReps - (isDiscovery ? i : 0), // Discovery has decreasing reps
      startingVelocity: 0.8 * setFatigueMultiplier,
      fatigueRate: 0.03,
      includeRawSamples,
    }));
  }

  return {
    id: uuid(),
    exerciseId,
    exerciseName,
    startTime,
    endTime: startTime + (setCount * 5 * 60 * 1000),
    plan,
    completedSets,
    status: 'completed',
    terminationReason: isDiscovery ? 'profile_complete' : 'plan_exhausted',
  };
}
