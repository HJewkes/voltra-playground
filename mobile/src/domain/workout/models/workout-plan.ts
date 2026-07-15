/**
 * Workout Plan - Coach-programmed workout structure.
 *
 * A WorkoutPlan represents a complete workout session designed by a coach.
 * It contains multiple exercises, each with prescribed sets.
 * The athlete loads a plan (e.g., via clipboard JSON) and follows it.
 */

export interface WorkoutPlan {
  id: string;
  name: string;
  /** Target date for this workout (YYYY-MM-DD) */
  date: string;
  coach?: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  /** Maps to exercise catalog ID */
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  /** Coaching cues to display during the exercise */
  cues?: string[];
  /** Exercise-level notes from the coach */
  notes?: string;
}

export interface WorkoutSet {
  /** Target weight in lbs. null = coach decides / auto-regulate */
  weight: number | null;
  reps: number;
  type: 'warmup' | 'ramp' | 'working' | 'backoff';
  rirTarget?: number;
  tempoTarget?: {
    eccentric: number;
    pauseBottom: number;
    concentric: number;
    pauseTop: number;
  };
  note?: string;
}

/**
 * Validate that an unknown object conforms to the WorkoutPlan shape.
 * Returns a descriptive error string or null if valid.
 */
export function validateWorkoutPlan(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Not an object';

  const plan = data as Record<string, unknown>;

  if (typeof plan.id !== 'string' || !plan.id) return 'Missing or invalid "id"';
  if (typeof plan.name !== 'string' || !plan.name) return 'Missing or invalid "name"';
  if (typeof plan.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) {
    return 'Missing or invalid "date" (expected YYYY-MM-DD)';
  }
  if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) {
    return 'Missing or empty "exercises" array';
  }

  for (let i = 0; i < plan.exercises.length; i++) {
    const ex = plan.exercises[i] as Record<string, unknown>;
    if (typeof ex.exerciseName !== 'string' || !ex.exerciseName) {
      return `exercises[${i}]: missing "exerciseName"`;
    }
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
      return `exercises[${i}]: missing or empty "sets"`;
    }
    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j] as Record<string, unknown>;
      if (typeof s.weight !== 'number' && s.weight !== null) {
        return `exercises[${i}].sets[${j}]: "weight" must be number or null`;
      }
      if (typeof s.reps !== 'number' || s.reps < 1) {
        return `exercises[${i}].sets[${j}]: "reps" must be a positive number`;
      }
      const validTypes = ['warmup', 'ramp', 'working', 'backoff'];
      if (!validTypes.includes(s.type as string)) {
        return `exercises[${i}].sets[${j}]: "type" must be one of ${validTypes.join(', ')}`;
      }
    }
  }

  return null;
}
