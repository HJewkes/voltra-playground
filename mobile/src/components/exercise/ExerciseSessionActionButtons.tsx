/**
 * ExerciseSessionActionButtons
 *
 * Context-aware action buttons for exercise sessions.
 * Shows different buttons based on session UI state.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ButtonText, VStack } from '@titan-design/react-ui';
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
  /** Called to cancel session before starting */
  onCancel?: () => void;
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
  onCancel,
  disabled = false,
  style,
}: ExerciseSessionActionButtonsProps) {
  if (uiState === 'idle' || uiState === 'processing' || uiState === 'results') {
    return null;
  }

  return (
    <View style={style}>
      {/* Ready state - START button + Cancel inline */}
      {uiState === 'ready' && (
        <View className="flex-row gap-2">
          {onStart && (
            <View style={{ flex: 3 }}>
              <Button
                variant="solid"
                color="primary"
                size="lg"
                fullWidth
                onPress={onStart}
                isDisabled={disabled}
                className="rounded-2xl"
              >
                <Ionicons name="play" size={24} color="white" style={{ marginRight: 8 }} />
                <ButtonText>START</ButtonText>
              </Button>
            </View>
          )}
          {onCancel && (
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                color="primary"
                size="lg"
                isIconButton
                fullWidth
                onPress={onCancel}
                isDisabled={disabled}
                className="rounded-2xl"
              >
                <Ionicons name="close" size={24} color="#f97316" />
              </Button>
            </View>
          )}
        </View>
      )}

      {/* Countdown state - no actions (automatic) */}
      {uiState === 'countdown' && <View className="h-16" />}

      {/* Recording state - manual stop + stop & save */}
      {uiState === 'recording' && (
        <VStack gap={2}>
          {onManualStop && (
            <Button
              variant="outline"
              color="primary"
              size="lg"
              fullWidth
              onPress={() => {
                console.log('[ActionButtons] Done Set pressed');
                onManualStop();
              }}
              isDisabled={disabled}
              className="rounded-2xl"
            >
              <Ionicons name="checkmark" size={24} color="#f97316" style={{ marginRight: 8 }} />
              <ButtonText>Done Set</ButtonText>
            </Button>
          )}
          {onStopAndSave && (
            <Button
              variant="solid"
              color="error"
              size="md"
              fullWidth
              onPress={onStopAndSave}
              isDisabled={disabled}
              className="rounded-2xl"
            >
              <Ionicons name="stop" size={20} color="white" style={{ marginRight: 8 }} />
              <ButtonText>Stop & Save</ButtonText>
            </Button>
          )}
        </VStack>
      )}

      {/* Preparing state - Cancel button */}
      {uiState === 'preparing' && onCancel && (
        <Button
          variant="outline"
          color="primary"
          size="md"
          fullWidth
          onPress={onCancel}
          isDisabled={disabled}
          className="rounded-2xl"
        >
          <Ionicons name="close" size={20} color="#f97316" style={{ marginRight: 8 }} />
          <ButtonText>Cancel</ButtonText>
        </Button>
      )}

      {/* Resting state - skip rest + stop & save */}
      {uiState === 'resting' && (
        <VStack gap={2}>
          {onSkipRest && (
            <Button
              variant="outline"
              color="primary"
              size="lg"
              fullWidth
              onPress={onSkipRest}
              isDisabled={disabled}
              className="rounded-2xl"
            >
              <Ionicons name="play-forward" size={24} color="#f97316" style={{ marginRight: 8 }} />
              <ButtonText>Skip Rest</ButtonText>
            </Button>
          )}
          {onStopAndSave && (
            <Button
              variant="solid"
              color="error"
              size="md"
              fullWidth
              onPress={onStopAndSave}
              isDisabled={disabled}
              className="rounded-2xl"
            >
              <Ionicons name="stop" size={20} color="white" style={{ marginRight: 8 }} />
              <ButtonText>Stop & Save</ButtonText>
            </Button>
          )}
        </VStack>
      )}
    </View>
  );
}
