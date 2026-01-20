/**
 * ExerciseSessionActionButtons
 *
 * Context-aware action buttons for exercise sessions.
 * Shows different buttons based on session UI state.
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { ActionButton, Stack } from '@/components/ui';
import type { ExerciseSessionUIState } from '@/stores/exercise-session-store';

export interface ExerciseSessionActionButtonsProps {
  /** Current UI state */
  uiState: ExerciseSessionUIState;
  /** Called to start first set */
  onStart?: () => void;
  /** Called to skip rest */
  onSkipRest?: () => void;
  /** Called to stop and save */
  onStopAndSave?: () => void;
  /** Called to manually stop recording */
  onManualStop?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * ExerciseSessionActionButtons - renders appropriate buttons for current state.
 */
export function ExerciseSessionActionButtons({
  uiState,
  onStart,
  onSkipRest,
  onStopAndSave,
  onManualStop,
  disabled = false,
  style,
}: ExerciseSessionActionButtonsProps) {
  // Don't show buttons in certain states
  if (uiState === 'idle' || uiState === 'processing' || uiState === 'results') {
    return null;
  }

  return (
    <View style={style}>
      {/* Ready state - START button */}
      {uiState === 'ready' && onStart && (
        <ActionButton
          label="START"
          icon="play"
          variant="primary"
          size="lg"
          onPress={onStart}
          disabled={disabled}
        />
      )}

      {/* Countdown state - no actions (automatic) */}
      {uiState === 'countdown' && (
        <View className="h-16" /> // Placeholder to maintain layout
      )}

      {/* Recording state - manual stop + stop & save */}
      {uiState === 'recording' && (
        <Stack gap="sm">
          {onManualStop && (
            <ActionButton
              label="Done Set"
              icon="checkmark"
              variant="secondary"
              size="lg"
              onPress={onManualStop}
              disabled={disabled}
            />
          )}
          {onStopAndSave && (
            <ActionButton
              label="Stop & Save"
              icon="stop"
              variant="danger"
              size="md"
              onPress={onStopAndSave}
              disabled={disabled}
            />
          )}
        </Stack>
      )}

      {/* Preparing state - no actions (automatic) */}
      {uiState === 'preparing' && (
        <View className="h-16" /> // Placeholder
      )}

      {/* Resting state - skip rest + stop & save */}
      {uiState === 'resting' && (
        <Stack gap="sm">
          {onSkipRest && (
            <ActionButton
              label="Skip Rest"
              icon="play-forward"
              variant="secondary"
              size="lg"
              onPress={onSkipRest}
              disabled={disabled}
            />
          )}
          {onStopAndSave && (
            <ActionButton
              label="Stop & Save"
              icon="stop"
              variant="danger"
              size="md"
              onPress={onStopAndSave}
              disabled={disabled}
            />
          )}
        </Stack>
      )}
    </View>
  );
}
