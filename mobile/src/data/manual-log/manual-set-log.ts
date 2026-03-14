/**
 * ManualSetLog — a single manually logged set for free weight exercises.
 *
 * Stored per-day in AsyncStorage, completely independent from the
 * Voltra device session flow.
 */

export interface ManualSetLog {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
  timestamp: number;
}

export function createManualSetLog(
  data: Omit<ManualSetLog, 'id' | 'timestamp'>,
): ManualSetLog {
  return {
    ...data,
    id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };
}
