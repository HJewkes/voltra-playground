/**
 * Clipboard Import - Parse workout plan JSON from clipboard.
 *
 * Validates and converts a JSON string into ExercisePlan arrays
 * that can drive multi-exercise workout sessions.
 *
 * The JSON format supports multiple exercises, each with explicit set targets:
 * {
 *   "exercises": [
 *     { "exerciseId": "cable_row", "sets": [...], "restSeconds": 120 },
 *     { "exerciseId": "cable_curl", "sets": [...] }
 *   ]
 * }
 */

import type { ExercisePlan, PlannedSet } from '@/domain/workout/models/plan';
import { hasExercise, getExercise, type Exercise } from '@/domain/exercise/catalog';
import { TrainingGoal } from '@/domain/planning/types';

// =============================================================================
// JSON Schema Types (what comes from clipboard)
// =============================================================================

/** A single set in the imported JSON. */
export interface ImportedSetJson {
  weight: number;
  targetReps: number;
  rirTarget?: number;
  isWarmup?: boolean;
}

/** A single exercise entry in the imported JSON. */
export interface ImportedExerciseJson {
  exerciseId: string;
  sets: ImportedSetJson[];
  restSeconds?: number;
  goal?: string;
}

/** Top-level JSON structure for a workout plan. */
export interface WorkoutPlanJson {
  exercises: ImportedExerciseJson[];
}

// =============================================================================
// Import Result Types
// =============================================================================

/** Successfully imported exercise plan with resolved exercise metadata. */
export interface ImportedExercise {
  exercise: Exercise;
  plan: ExercisePlan;
}

/** Result of parsing clipboard JSON. */
export type ClipboardImportResult =
  | { success: true; exercises: ImportedExercise[] }
  | { success: false; error: string };

// =============================================================================
// Validation
// =============================================================================

function validateSetJson(set: unknown, index: number): ImportedSetJson {
  if (typeof set !== 'object' || set === null) {
    throw new Error(`Set ${index + 1}: must be an object`);
  }

  const s = set as Record<string, unknown>;

  if (typeof s.weight !== 'number' || s.weight <= 0) {
    throw new Error(`Set ${index + 1}: weight must be a positive number`);
  }

  if (typeof s.targetReps !== 'number' || s.targetReps <= 0 || !Number.isInteger(s.targetReps)) {
    throw new Error(`Set ${index + 1}: targetReps must be a positive integer`);
  }

  if (s.rirTarget !== undefined && (typeof s.rirTarget !== 'number' || s.rirTarget < 0)) {
    throw new Error(`Set ${index + 1}: rirTarget must be a non-negative number`);
  }

  if (s.isWarmup !== undefined && typeof s.isWarmup !== 'boolean') {
    throw new Error(`Set ${index + 1}: isWarmup must be a boolean`);
  }

  return {
    weight: s.weight,
    targetReps: s.targetReps,
    rirTarget: s.rirTarget as number | undefined,
    isWarmup: s.isWarmup as boolean | undefined,
  };
}

function validateExerciseJson(
  entry: unknown,
  index: number
): ImportedExerciseJson {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`Exercise ${index + 1}: must be an object`);
  }

  const e = entry as Record<string, unknown>;

  if (typeof e.exerciseId !== 'string' || e.exerciseId.trim() === '') {
    throw new Error(`Exercise ${index + 1}: exerciseId must be a non-empty string`);
  }

  if (!Array.isArray(e.sets) || e.sets.length === 0) {
    throw new Error(`Exercise ${index + 1} (${e.exerciseId}): sets must be a non-empty array`);
  }

  if (e.restSeconds !== undefined && (typeof e.restSeconds !== 'number' || e.restSeconds < 0)) {
    throw new Error(
      `Exercise ${index + 1} (${e.exerciseId}): restSeconds must be a non-negative number`
    );
  }

  if (e.goal !== undefined && typeof e.goal !== 'string') {
    throw new Error(`Exercise ${index + 1} (${e.exerciseId}): goal must be a string`);
  }

  const sets = (e.sets as unknown[]).map((s, i) => validateSetJson(s, i));

  return {
    exerciseId: e.exerciseId.trim(),
    sets,
    restSeconds: e.restSeconds as number | undefined,
    goal: e.goal as string | undefined,
  };
}

function validateWorkoutPlanJson(data: unknown): WorkoutPlanJson {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Plan must be a JSON object');
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.exercises) || d.exercises.length === 0) {
    throw new Error('Plan must contain a non-empty "exercises" array');
  }

  const exercises = (d.exercises as unknown[]).map((e, i) => validateExerciseJson(e, i));

  return { exercises };
}

// =============================================================================
// Conversion
// =============================================================================

function resolveGoal(goalStr: string | undefined): TrainingGoal {
  if (!goalStr) return TrainingGoal.HYPERTROPHY;

  const normalized = goalStr.toLowerCase();
  if (normalized === 'strength') return TrainingGoal.STRENGTH;
  if (normalized === 'endurance') return TrainingGoal.ENDURANCE;
  return TrainingGoal.HYPERTROPHY;
}

function convertToPlan(entry: ImportedExerciseJson): ExercisePlan {
  const sets: PlannedSet[] = entry.sets.map((s, i) => ({
    setNumber: i + 1,
    weight: s.weight,
    targetReps: s.targetReps,
    rirTarget: s.rirTarget ?? 2,
    isWarmup: s.isWarmup ?? false,
  }));

  return {
    exerciseId: entry.exerciseId,
    sets,
    defaultRestSeconds: entry.restSeconds ?? 90,
    goal: resolveGoal(entry.goal),
    generatedAt: Date.now(),
    generatedBy: 'manual',
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse and validate a workout plan JSON string from clipboard.
 *
 * Returns either a success result with resolved exercises and plans,
 * or a failure result with a descriptive error message.
 */
export function parseWorkoutPlanJson(jsonString: string): ClipboardImportResult {
  if (!jsonString || jsonString.trim() === '') {
    return { success: false, error: 'Clipboard is empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, error: 'Invalid JSON format' };
  }

  let validated: WorkoutPlanJson;
  try {
    validated = validateWorkoutPlanJson(parsed);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const unknownExercises: string[] = [];
  const importedExercises: ImportedExercise[] = [];

  for (const entry of validated.exercises) {
    if (!hasExercise(entry.exerciseId)) {
      unknownExercises.push(entry.exerciseId);
      continue;
    }

    const exercise = getExercise(entry.exerciseId)!;
    const plan = convertToPlan(entry);
    importedExercises.push({ exercise, plan });
  }

  if (importedExercises.length === 0 && unknownExercises.length > 0) {
    return {
      success: false,
      error: `No recognized exercises. Unknown: ${unknownExercises.join(', ')}`,
    };
  }

  if (importedExercises.length === 0) {
    return { success: false, error: 'No exercises to import' };
  }

  return { success: true, exercises: importedExercises };
}

/**
 * Check if a string looks like it could be workout plan JSON.
 * Used for quick pre-validation before full parse.
 */
export function looksLikeWorkoutPlan(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') && trimmed.includes('"exercises"');
}
