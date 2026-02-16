/**
 * Display Utility Functions
 *
 * Domain-specific color helpers for data visualization.
 * Uses hardcoded hex values for programmatic inline styles
 * (React Native inline styles can't use CSS variables).
 */

import { colors } from '@/theme';

/**
 * Get color based on velocity loss percentage.
 * Lower loss = better (green), higher loss = fatigued (red).
 */
export function getVelocityColor(velocityLoss: number): string {
  if (velocityLoss < 10) return colors.success.DEFAULT;
  if (velocityLoss < 20) return colors.warning.DEFAULT;
  if (velocityLoss < 30) return colors.primary[500];
  return colors.danger.DEFAULT;
}

/**
 * Get color based on confidence level.
 */
export function getConfidenceColor(confidence: 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high':
      return colors.success.DEFAULT;
    case 'medium':
      return colors.warning.DEFAULT;
    case 'low':
      return colors.text.tertiary;
  }
}

/**
 * Get color based on connection state.
 */
export function getConnectionColor(isConnected: boolean): string {
  return isConnected ? colors.success.DEFAULT : colors.text.muted;
}

/**
 * Get color for phase indicators in workout tracking.
 */
export function getPhaseColor(phase: 'concentric' | 'eccentric' | 'isometric'): string {
  switch (phase) {
    case 'concentric':
      return colors.success.DEFAULT;
    case 'eccentric':
      return colors.warning.DEFAULT;
    case 'isometric':
      return colors.info.DEFAULT;
  }
}
