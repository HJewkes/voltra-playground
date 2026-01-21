/**
 * Recording Components
 *
 * Components for active recording sessions (live metrics, phase display, controls).
 *
 * Components follow a view + connected pattern:
 * - View components are presentational and take domain objects as props
 * - Connected components subscribe to recording-store for convenience
 */

// Live metrics display
export { LiveMetrics, LiveMetricsView } from './LiveMetrics';
export type { LiveMetricsProps, LiveMetricsViewProps } from './LiveMetrics';

// Phase indicator
export { PhaseIndicator, getPhaseColor } from './PhaseIndicator';
export type { PhaseIndicatorProps } from './PhaseIndicator';

// Rest timer
export { RestTimer } from './RestTimer';

// Workout controls
export { WorkoutControls } from './WorkoutControls';
export type { WorkoutControlsProps } from './WorkoutControls';

// Recording state display
export { RecordingDisplay, RecordingDisplayView } from './RecordingDisplay';
export type { RecordingDisplayProps, RecordingDisplayViewProps } from './RecordingDisplay';
