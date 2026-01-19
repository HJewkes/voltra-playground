/**
 * Theme Utility Functions
 * 
 * Helper functions for dynamic color selection based on data.
 */

import { colors } from './colors';

/**
 * Get color based on RPE (Rate of Perceived Exertion) level.
 * Lower RPE = easier (green), higher RPE = harder (red).
 */
export function getRPEColor(rpe: number): string {
  if (rpe < 6) return colors.success;
  if (rpe < 7.5) return colors.successLight;
  if (rpe < 8.5) return colors.warning;
  if (rpe < 9.5) return colors.primary[500];
  return colors.danger;
}

/**
 * Get color based on velocity loss percentage.
 * Lower loss = better (green), higher loss = fatigued (red).
 */
export function getVelocityColor(velocityLoss: number): string {
  if (velocityLoss < 10) return colors.success;
  if (velocityLoss < 20) return colors.warning;
  if (velocityLoss < 30) return colors.primary[500];
  return colors.danger;
}

/**
 * Get color based on confidence level.
 */
export function getConfidenceColor(confidence: 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high': return colors.success;
    case 'medium': return colors.warning;
    case 'low': return colors.text.tertiary;
  }
}

/**
 * Get color based on connection state.
 */
export function getConnectionColor(isConnected: boolean): string {
  return isConnected ? colors.success : colors.text.muted;
}

/**
 * Get color for phase indicators in workout tracking.
 */
export function getPhaseColor(phase: 'concentric' | 'eccentric' | 'isometric'): string {
  switch (phase) {
    case 'concentric': return colors.success;
    case 'eccentric': return colors.warning;
    case 'isometric': return colors.info;
  }
}
