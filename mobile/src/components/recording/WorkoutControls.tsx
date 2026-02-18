/**
 * WorkoutControls
 *
 * Start/stop workout button.
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button, ButtonText } from '@titan-design/react-ui';

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
    <Button
      variant="solid"
      color={isActive ? 'error' : 'primary'}
      size="lg"
      fullWidth
      onPress={isActive ? onStop : onStart}
      className="rounded-2xl"
    >
      <Ionicons
        name={isActive ? 'stop' : 'play'}
        size={24}
        color="white"
        style={{ marginRight: 8 }}
      />
      <ButtonText>{isActive ? 'Stop Workout' : 'Start Workout'}</ButtonText>
    </Button>
  );
}
