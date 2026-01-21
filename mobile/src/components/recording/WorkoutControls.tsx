/**
 * WorkoutControls
 *
 * Start/stop workout button.
 */

import React from 'react';
import { ActionButton } from '@/components/ui';

export interface WorkoutControlsProps {
  /** Whether workout is active */
  isActive: boolean;
  /** Called to start workout */
  onStart: () => void;
  /** Called to stop workout */
  onStop: () => void;
}

/**
 * WorkoutControls - start/stop workout button.
 */
export function WorkoutControls({ isActive, onStart, onStop }: WorkoutControlsProps) {
  return (
    <ActionButton
      label={isActive ? 'Stop Workout' : 'Start Workout'}
      icon={isActive ? 'stop' : 'play'}
      variant={isActive ? 'danger' : 'primary'}
      size="lg"
      onPress={isActive ? onStop : onStart}
    />
  );
}
