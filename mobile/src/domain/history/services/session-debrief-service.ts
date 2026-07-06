/**
 * Session Debrief Service
 *
 * Assembles post-workout debrief data from progression, training load,
 * suggestion, and termination services. Pure functions over stored session data.
 */

import type { StoredExerciseSession, TerminationReason } from '@/data/exercise-session';
import type { Exercise } from '@/domain/exercise/catalog';
import { computeExerciseProgression, type MetricComparison } from './progression-service';
import {
  computeTrainingLoad,
  computePRTimeline,
  type TrainingLoad,
  type PRTimelineEntry,
} from './cross-session-analytics';
import { suggestNextExercise, type ExerciseSuggestion } from './workout-suggestion-service';

// =============================================================================
// Types
// =============================================================================

/** A single progression arrow for one exercise in the debrief. */
export interface ProgressionArrow {
  exerciseName: string;
  velocity: MetricComparison;
  e1RM: MetricComparison;
  volume: MetricComparison;
}

/** PR badge detected during this session. */
export interface PRBadge {
  type: PRTimelineEntry['type'];
  exerciseName: string;
  value: number;
}

/** Recovery advisory based on how the session ended. */
export interface RecoveryNote {
  message: string;
  severity: 'info' | 'warning';
}

/** Full debrief data assembled from multiple services. */
export interface SessionDebriefData {
  progressionArrows: ProgressionArrow[];
  trainingLoad: TrainingLoad;
  suggestions: ExerciseSuggestion[];
  prBadges: PRBadge[];
  recoveryNote: RecoveryNote | null;
}

// =============================================================================
// Helpers
// =============================================================================

const FATIGUE_REASONS: Set<TerminationReason> = new Set([
  'velocity_grinding',
  'junk_volume',
  'failure',
]);

function buildRecoveryNote(currentSessions: StoredExerciseSession[]): RecoveryNote | null {
  const fatigueEnded = currentSessions.some(
    (s) => s.terminationReason && FATIGUE_REASONS.has(s.terminationReason)
  );

  if (!fatigueEnded) return null;

  const reasons = currentSessions
    .filter((s) => s.terminationReason && FATIGUE_REASONS.has(s.terminationReason))
    .map((s) => s.terminationReason!);

  const hasGrinding = reasons.includes('velocity_grinding');
  const hasJunk = reasons.includes('junk_volume');
  const hasFailure = reasons.includes('failure');

  if (hasFailure) {
    return {
      message: 'You reached failure this session. Consider extra rest before your next workout.',
      severity: 'warning',
    };
  }

  if (hasGrinding && hasJunk) {
    return {
      message: 'Velocity grinding and junk volume detected. Allow adequate recovery.',
      severity: 'warning',
    };
  }

  if (hasGrinding) {
    return {
      message: 'Near-max effort detected. Consider extra rest before your next session.',
      severity: 'warning',
    };
  }

  if (hasJunk) {
    return {
      message: 'Performance declined toward the end. Consider lighter volume next session.',
      severity: 'info',
    };
  }

  return null;
}

function detectSessionPRs(
  allHistory: StoredExerciseSession[],
  currentSessionIds: Set<string>
): PRBadge[] {
  const timeline = computePRTimeline(allHistory);
  const badges: PRBadge[] = [];

  const currentSessionTimestamps = new Set<number>();
  for (const s of allHistory) {
    if (currentSessionIds.has(s.id)) {
      for (const set of s.completedSets) {
        currentSessionTimestamps.add(set.startTime);
      }
    }
  }

  for (const entry of timeline) {
    if (currentSessionTimestamps.has(entry.date)) {
      badges.push({
        type: entry.type,
        exerciseName: entry.exerciseName,
        value: entry.value,
      });
    }
  }

  return badges;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Assemble the full debrief for a completed workout.
 *
 * @param currentSessions  The exercise sessions from this workout (may be multiple exercises).
 * @param allHistory       All stored sessions (including current) for progression + load.
 * @param catalog          Exercise catalog for suggestions.
 * @param now              Injectable timestamp for testing.
 */
export function assembleSessionDebrief(
  currentSessions: StoredExerciseSession[],
  allHistory: StoredExerciseSession[],
  catalog: Record<string, Exercise>,
  now: number = Date.now()
): SessionDebriefData {
  const progressionArrows = buildProgressionArrows(currentSessions, allHistory);
  const trainingLoad = computeTrainingLoad(allHistory);
  const suggestions = suggestNextExercise(allHistory, catalog, 2, now);

  const currentSessionIds = new Set(currentSessions.map((s) => s.id));
  const prBadges = detectSessionPRs(allHistory, currentSessionIds);
  const recoveryNote = buildRecoveryNote(currentSessions);

  return {
    progressionArrows,
    trainingLoad,
    suggestions,
    prBadges,
    recoveryNote,
  };
}

/**
 * Build progression arrows for each exercise in the current workout
 * by comparing against its most recent predecessor in history.
 */
function buildProgressionArrows(
  currentSessions: StoredExerciseSession[],
  allHistory: StoredExerciseSession[]
): ProgressionArrow[] {
  const arrows: ProgressionArrow[] = [];

  for (const current of currentSessions) {
    const previousForExercise = allHistory
      .filter(
        (s) =>
          s.exerciseId === current.exerciseId &&
          s.id !== current.id &&
          s.status === 'completed' &&
          s.startTime < current.startTime
      )
      .sort((a, b) => b.startTime - a.startTime);

    if (previousForExercise.length === 0) continue;

    const progression = computeExerciseProgression(current, previousForExercise[0]);
    if (!progression) continue;

    arrows.push({
      exerciseName: progression.exerciseName,
      velocity: progression.velocity,
      e1RM: progression.e1RM,
      volume: progression.volume,
    });
  }

  return arrows;
}
