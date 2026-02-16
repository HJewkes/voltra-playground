/**
 * RecordingDisplay
 *
 * Main display area during active recording sessions.
 * Shows different content based on RecordingUIState:
 * - idle: Ready state with instructions
 * - countdown: 3-2-1 countdown before recording
 * - recording: Rep counter with velocity metrics
 * - resting: Rest countdown with skip button
 *
 * Uses Rep from domain/workout for phase-specific velocity metrics.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useStore } from 'zustand';
import { getSemanticColors } from '@titan-design/react-ui';
import type { RecordingUIState, RecordingStoreApi } from '@/stores';

const t = getSemanticColors('dark');

// =============================================================================
// Types
// =============================================================================

export interface RecordingDisplayViewProps {
  /** Current UI state */
  uiState: RecordingUIState;
  /** Main instruction text */
  instruction: string;
  /** Secondary instruction */
  subInstruction?: string;
  /** Target reps for current set */
  targetReps?: number;
  /** Rest countdown timer (seconds) */
  restCountdown?: number;
  /** Start countdown (3-2-1) */
  startCountdown?: number;
  /** Current rep count */
  repCount: number;
  /** Peak velocity of the last completed rep (m/s) */
  lastRepPeakVelocity: number | null;
  /** Called to skip rest */
  onSkipRest?: () => void;
}

// =============================================================================
// Helper: Background color per state
// =============================================================================

function getStateColor(uiState: RecordingUIState): string {
  switch (uiState) {
    case 'recording':
      return t['status-success'];
    case 'resting':
      return t['brand-primary-dark'];
    case 'countdown':
      return t['status-warning'];
    default:
      return t['brand-primary'];
  }
}

// =============================================================================
// Sub-displays
// =============================================================================

/**
 * IdleDisplay - ready state with instructions.
 */
function IdleDisplay({
  instruction,
  subInstruction,
}: {
  instruction: string;
  subInstruction?: string;
}) {
  return (
    <View className="items-center">
      <Text className="text-center text-5xl font-bold text-white">{instruction}</Text>
      {subInstruction && (
        <Text className="mt-5 text-center text-xl text-white/70">{subInstruction}</Text>
      )}
    </View>
  );
}

/**
 * RestingDisplay - rest countdown with skip button.
 */
function RestingDisplay({
  countdown,
  subInstruction,
  onSkip,
}: {
  countdown: number;
  subInstruction?: string;
  onSkip?: () => void;
}) {
  return (
    <View className="items-center">
      <Text className="mb-3 text-xl text-white/70">REST</Text>
      <Text className="text-9xl font-bold text-white">{countdown}</Text>
      {subInstruction && <Text className="mt-5 text-lg text-white/70">{subInstruction}</Text>}
      {onSkip && (
        <TouchableOpacity
          className="mt-8 rounded-2xl px-8 py-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text className="text-base font-bold text-white">Skip Rest</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * CountdownDisplay - 3-2-1 countdown.
 */
function CountdownDisplay({
  countdown,
  subInstruction,
}: {
  countdown: number;
  subInstruction?: string;
}) {
  return (
    <View className="items-center">
      <Text className="mb-3 text-xl text-white/70">GET READY</Text>
      <Text className="font-bold text-white" style={{ fontSize: 120 }}>
        {countdown}
      </Text>
      {subInstruction && <Text className="mt-5 text-lg text-white/70">{subInstruction}</Text>}
    </View>
  );
}

/**
 * ActiveRecordingDisplay - rep counter with velocity.
 */
function ActiveRecordingDisplay({
  repCount,
  targetReps,
  lastRepPeakVelocity,
}: {
  repCount: number;
  targetReps?: number;
  lastRepPeakVelocity: number | null;
}) {
  return (
    <View className="items-center">
      <Text className="mb-2 text-xl text-white/70">REPS</Text>
      <Text className="text-9xl font-bold text-white">{repCount}</Text>
      {targetReps !== undefined && <Text className="mt-2 text-3xl text-white">/ {targetReps}</Text>}
      {lastRepPeakVelocity !== null && (
        <View
          className="mt-8 rounded-2xl px-8 py-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          <Text className="text-xl font-bold text-white">
            {lastRepPeakVelocity.toFixed(2)} m/s
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// View Component (Presentational)
// =============================================================================

/**
 * RecordingDisplayView - presentational component for recording state display.
 *
 * @example
 * ```tsx
 * <RecordingDisplayView
 *   uiState="recording"
 *   instruction="Start lifting"
 *   repCount={5}
 *   lastRep={lastRep}
 *   targetReps={10}
 * />
 * ```
 */
export function RecordingDisplayView({
  uiState,
  instruction,
  subInstruction,
  targetReps,
  restCountdown = 0,
  startCountdown = 0,
  repCount,
  lastRepPeakVelocity,
  onSkipRest,
}: RecordingDisplayViewProps) {
  return (
    <View
      className="items-center justify-center rounded-3xl p-8"
      style={{ backgroundColor: getStateColor(uiState), minHeight: 350 }}
    >
      {uiState === 'idle' && (
        <IdleDisplay instruction={instruction} subInstruction={subInstruction} />
      )}
      {uiState === 'resting' && (
        <RestingDisplay
          countdown={restCountdown}
          subInstruction={subInstruction}
          onSkip={onSkipRest}
        />
      )}
      {uiState === 'countdown' && (
        <CountdownDisplay countdown={startCountdown} subInstruction={subInstruction} />
      )}
      {uiState === 'recording' && (
        <ActiveRecordingDisplay
          repCount={repCount}
          targetReps={targetReps}
          lastRepPeakVelocity={lastRepPeakVelocity}
        />
      )}
    </View>
  );
}

// =============================================================================
// Connected Component
// =============================================================================

export interface RecordingDisplayProps {
  /** Recording store to subscribe to */
  store: RecordingStoreApi;
  /** Main instruction text */
  instruction?: string;
  /** Secondary instruction */
  subInstruction?: string;
  /** Target reps for current set */
  targetReps?: number;
  /** Rest countdown timer (seconds) - managed by caller */
  restCountdown?: number;
  /** Start countdown (3-2-1) - managed by caller */
  startCountdown?: number;
  /** Called to skip rest */
  onSkipRest?: () => void;
}

/**
 * RecordingDisplay - connected component that subscribes to recording store.
 *
 * @example
 * ```tsx
 * <RecordingDisplay
 *   store={recordingStore}
 *   instruction="Lift with control"
 *   targetReps={10}
 * />
 * ```
 */
export function RecordingDisplay({
  store,
  instruction = 'Ready',
  subInstruction,
  targetReps,
  restCountdown,
  startCountdown,
  onSkipRest,
}: RecordingDisplayProps) {
  const uiState = useStore(store, (s) => s.uiState);
  const repCount = useStore(store, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(store, (s) => s.lastRepPeakVelocity);

  return (
    <RecordingDisplayView
      uiState={uiState}
      instruction={instruction}
      subInstruction={subInstruction}
      targetReps={targetReps}
      restCountdown={restCountdown}
      startCountdown={startCountdown}
      repCount={repCount}
      lastRepPeakVelocity={lastRepPeakVelocity}
      onSkipRest={onSkipRest}
    />
  );
}

// =============================================================================
// Legacy Export (for backward compatibility with DiscoveryScreen)
// =============================================================================

// Re-export view as the legacy interface expected by DiscoveryScreen
// This allows gradual migration - DiscoveryScreen can continue passing all props
export { RecordingDisplayView as RecordingDisplayLegacy };
