/**
 * LiveMetrics
 *
 * Live workout metrics display that consumes domain objects (SetMetrics, WorkoutSample).
 * Provides both a presentational view and a connected version.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useStore } from 'zustand';
import {
  type SetMetrics,
  type WorkoutSample,
  MovementPhase,
  getEffortLabel,
  getRIRDescription,
} from '@/domain/workout';
import type { RecordingStoreApi } from '@/stores';
import { Card, Stack, Surface } from '@/components/ui';
import { PhaseIndicator } from './PhaseIndicator';
import { colors, getRPEColor } from '@/theme';

// =============================================================================
// View Component (Presentational)
// =============================================================================

export interface LiveMetricsViewProps {
  /** Set metrics containing RPE, RIR, velocity data */
  metrics: SetMetrics;
  /** Current workout sample for phase/position/velocity display */
  currentSample?: WorkoutSample | null;
  /** Current weight in lbs */
  weight?: number;
  /** Live status message */
  statusMessage?: string;
  /** Compact layout */
  compact?: boolean;
}

/**
 * LiveMetricsView - presentational component showing live workout metrics.
 *
 * Accepts domain objects directly (SetMetrics, WorkoutSample).
 */
export function LiveMetricsView({
  metrics,
  currentSample,
  weight,
  statusMessage,
  compact = false,
}: LiveMetricsViewProps) {
  const { repCount, effort, velocity } = metrics;
  const rpe = effort.rpe;
  const rir = effort.rir;
  const velocityLoss = Math.abs(velocity.concentricDelta);

  const rpeColor = getRPEColor(rpe);
  const effortLabel = getEffortLabel(rpe);
  const rirDescription = getRIRDescription(rir);

  if (compact) {
    return (
      <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-2">
        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">RPE</Text>
          <Text className="text-lg font-bold ml-2" style={{ color: rpeColor }}>
            {rpe.toFixed(1)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">RIR</Text>
          <Text className="text-lg font-bold text-white ml-2">
            {rir >= 5 ? '5+' : `~${Math.round(rir)}`}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">VL</Text>
          <Text className="text-lg font-bold text-white ml-2">
            {velocityLoss.toFixed(0)}%
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Card elevation={1} padding="lg">
      {/* Header: Weight & Phase */}
      <View className="flex-row items-center justify-between mb-5">
        {weight !== undefined && (
          <Text className="text-content-secondary font-medium">{weight} lbs</Text>
        )}
        <PhaseIndicator phase={currentSample?.phase ?? MovementPhase.IDLE} />
      </View>

      {/* Rep Counter & Live RPE */}
      <Stack direction="row" justify="space-around" align="center" style={{ marginBottom: 20 }}>
        <View className="items-center">
          <Text className="text-8xl font-bold" style={{ color: colors.primary[500] }}>
            {repCount}
          </Text>
          <Text className="text-content-tertiary text-lg">reps</Text>
        </View>

        <View className="w-px h-24" style={{ backgroundColor: colors.surface.light }} />

        <View className="items-center">
          <Text className="text-6xl font-bold" style={{ color: rpeColor }}>
            {rpe.toFixed(1)}
          </Text>
          <Text className="text-content-tertiary text-lg">RPE</Text>
          <Text className="text-content-muted text-sm mt-1">{rir.toFixed(0)} RIR</Text>
        </View>
      </Stack>

      {/* Status Message */}
      {statusMessage && (
        <View
          className="rounded-2xl p-4 mb-5"
          style={{ backgroundColor: rpeColor + '15' }}
        >
          <Text className="text-center font-bold text-base" style={{ color: rpeColor }}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Position Bar (if sample available) */}
      {currentSample && (
        <View className="mb-5">
          <View className="flex-row justify-between mb-2">
            <Text className="text-content-tertiary text-sm">Position</Text>
            <Text className="text-content-secondary text-sm font-medium">
              {((currentSample.position ?? 0) * 100).toFixed(0)}%
            </Text>
          </View>
          <View
            className="h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (currentSample.position ?? 0) * 100)}%`,
                backgroundColor: colors.primary[500],
              }}
            />
          </View>
        </View>
      )}

      {/* Quick Stats Grid */}
      <Stack direction="row" gap="sm">
        <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
          <Text className="text-content-muted text-xs font-medium mb-1">Force</Text>
          <Text className="text-2xl font-bold text-content-primary">
            {Math.round(currentSample?.force ?? 0)}
          </Text>
        </Surface>
        <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
          <Text className="text-content-muted text-xs font-medium mb-1">Velocity</Text>
          <Text className="text-2xl font-bold text-content-primary">
            {(currentSample?.velocity ?? 0).toFixed(2)}
          </Text>
        </Surface>
        <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
          <Text className="text-content-muted text-xs font-medium mb-1">Vel Loss</Text>
          <Text className="text-2xl font-bold" style={{ color: rpeColor }}>
            {velocityLoss > 0 ? '-' : ''}
            {Math.round(velocityLoss)}%
          </Text>
        </Surface>
      </Stack>

      {/* Fatigue Progress Bar */}
      <View className="mt-4">
        <View className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(velocityLoss, 50) * 2}%`,
              backgroundColor:
                velocityLoss > 30 ? '#ef4444' : velocityLoss > 20 ? '#eab308' : '#22c55e',
            }}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-zinc-500 text-xs">Fresh</Text>
          <Text className="text-zinc-500 text-xs">Fatigued</Text>
        </View>
      </View>
    </Card>
  );
}

// =============================================================================
// Connected Component
// =============================================================================

export interface LiveMetricsProps {
  /** Recording store to subscribe to */
  store: RecordingStoreApi;
  /** Current workout sample (from voltra-store) */
  currentSample?: WorkoutSample | null;
  /** Current weight */
  weight?: number;
  /** Compact layout */
  compact?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * LiveMetrics - connected component that subscribes to recording store.
 *
 * @example
 * ```tsx
 * <LiveMetrics
 *   store={recordingStore}
 *   currentSample={currentSample}
 *   weight={100}
 * />
 * ```
 */
export function LiveMetrics({ store, currentSample, weight, compact, style }: LiveMetricsProps) {
  const metrics = useStore(store, (s) => s.setMetrics);
  const liveMessage = useStore(store, (s) => s.liveMessage);

  return (
    <View style={style}>
      <LiveMetricsView
        metrics={metrics}
        currentSample={currentSample}
        weight={weight}
        statusMessage={liveMessage}
        compact={compact}
      />
    </View>
  );
}
