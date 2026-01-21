/**
 * ResumeSessionPrompt
 *
 * Modal prompt shown when an in-progress session is detected on app startup.
 * Allows user to resume or discard the session.
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Stack, ActionButton } from '@/components/ui';
import { colors } from '@/theme';
import type { StoredExerciseSession } from '@/data/exercise-session';

export interface ResumeSessionPromptProps {
  /** The in-progress session to resume */
  session: StoredExerciseSession;
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user chooses to resume */
  onResume: () => void;
  /** Called when user chooses to discard */
  onDiscard: () => void;
}

/**
 * Format time since last activity.
 */
function formatTimeSince(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * ResumeSessionPrompt - modal for resuming in-progress sessions.
 */
export function ResumeSessionPrompt({
  session,
  visible,
  onResume,
  onDiscard,
}: ResumeSessionPromptProps) {
  const setsCompleted = session.completedSets.length;
  const totalSets = session.plan.sets.length;
  const lastActivity = session.completedSets.length > 0
    ? session.completedSets[session.completedSets.length - 1].endTime
    : session.startTime;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDiscard}
    >
      <View
        className="flex-1 justify-center items-center px-6"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      >
        <Card elevation={2} padding="lg" className="w-full max-w-sm">
          {/* Header */}
          <View className="items-center mb-6">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: colors.warning.DEFAULT + '20' }}
            >
              <Ionicons
                name="pause-circle"
                size={36}
                color={colors.warning.DEFAULT}
              />
            </View>
            <Text className="text-xl font-bold text-content-primary text-center">
              Session In Progress
            </Text>
            <Text className="text-content-muted text-center mt-2">
              You have an unfinished workout
            </Text>
          </View>

          {/* Session Info */}
          <View
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <Text className="text-content-primary font-semibold text-lg mb-2">
              {session.exerciseName ?? 'Exercise'}
            </Text>
            <Stack gap="xs">
              <View className="flex-row justify-between">
                <Text className="text-content-muted">Progress</Text>
                <Text className="text-content-secondary font-medium">
                  {setsCompleted} of {totalSets} sets
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-content-muted">Last activity</Text>
                <Text className="text-content-secondary font-medium">
                  {formatTimeSince(lastActivity)}
                </Text>
              </View>
            </Stack>
          </View>

          {/* Actions */}
          <Stack gap="sm">
            <ActionButton
              label="Resume Workout"
              variant="primary"
              onPress={onResume}
              icon="play"
            />
            <ActionButton
              label="Discard Session"
              variant="secondary"
              onPress={onDiscard}
              icon="trash-outline"
            />
          </Stack>
        </Card>
      </View>
    </Modal>
  );
}
