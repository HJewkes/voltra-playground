/**
 * Effort Labels and UI Helpers
 *
 * Functions for generating human-readable effort descriptions
 * and UI formatting for RPE/RIR values.
 */

/**
 * Get effort level description from RPE.
 */
export function getEffortLabel(rpe: number): string {
  if (rpe <= 5) return 'Easy';
  if (rpe <= 6) return 'Moderate';
  if (rpe <= 7) return 'Challenging';
  if (rpe <= 8) return 'Hard';
  if (rpe <= 9) return 'Very Hard';
  return 'Max Effort';
}

/**
 * Get RIR description.
 */
export function getRIRDescription(rir: number): string {
  if (rir >= 5) return '5+ reps left';
  if (rir >= 4) return '4 reps left';
  if (rir >= 3) return '3 reps left';
  if (rir >= 2) return '2 reps left';
  if (rir >= 1) return '1 rep left';
  return 'At failure';
}

/**
 * Generate effort bar visualization.
 * Returns a string like "████████░░" for 80% effort.
 */
export function getEffortBar(rpe: number, width: number = 10): string {
  const filled = Math.round((rpe / 10) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get color for RPE value (for UI feedback).
 */
export function getRPEColor(rpe: number): string {
  if (rpe <= 6) return '#22c55e'; // green
  if (rpe <= 7) return '#84cc16'; // lime
  if (rpe <= 8) return '#eab308'; // yellow
  if (rpe <= 9) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Get a motivational message based on current RPE and rep count.
 *
 * Used to provide real-time feedback during workouts.
 * Shows simple, encouraging messages that reflect current effort level.
 */
export function getLiveEffortMessage(rpe: number, repCount: number): string {
  if (repCount < 2) return 'Keep going...';
  if (rpe < 6) return 'Feeling light - maintain form';
  if (rpe < 7.5) return 'Good pace - controlled effort';
  if (rpe < 8.5) return 'Getting harder - stay focused';
  if (rpe < 9.5) return 'High effort - 1-2 reps left';
  return 'Maximum effort - consider stopping';
}
