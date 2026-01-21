/**
 * LiveMetrics
 *
 * Live workout metrics display that consumes domain objects (SetMetrics, WorkoutSample).
 * Provides both a presentational view and a connected version.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
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
  const _effortLabel = getEffortLabel(rpe);
  const _rirDescription = getRIRDescription(rir);

  if (compact) {
    return (
      <View className="flex-row items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-2">
        <View className="flex-row items-center">
          <Text className="text-xs text-zinc-400">RPE</Text>
          <Text className="ml-2 text-lg font-bold" style={{ color: rpeColor }}>
            {rpe.toFixed(1)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-xs text-zinc-400">RIR</Text>
          <Text className="ml-2 text-lg font-bold text-white">
            {rir >= 5 ? '5+' : `~${Math.round(rir)}`}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-xs text-zinc-400">VL</Text>
          <Text className="ml-2 text-lg font-bold text-white">{velocityLoss.toFixed(0)}%</Text>
        </View>
      </View>
    );
  }

  return (
    <Card elevation={1} padding="lg">
      {/* Header: Weight & Phase */}
      <View className="mb-5 flex-row items-center justify-between">
        {weight !== undefined && (
          <Text className="font-medium text-content-secondary">{weight} lbs</Text>
        )}
        <PhaseIndicator phase={currentSample?.phase ?? MovementPhase.IDLE} />
      </View>

      {/* Rep Counter & Live RPE */}
      <Stack direction="row" justify="space-around" align="center" style={{ marginBottom: 20 }}>
        <View className="items-center">
          <Text className="text-8xl font-bold" style={{ color: colors.primary[500] }}>
            {repCount}
          </Text>
          <Text className="text-lg text-content-tertiary">reps</Text>
        </View>

        <View className="h-24 w-px" style={{ backgroundColor: colors.surface.light }} />

        <View className="items-center">
          <Text className="text-6xl font-bold" style={{ color: rpeColor }}>
            {rpe.toFixed(1)}
          </Text>
          <Text className="text-lg text-content-tertiary">RPE</Text>
          <Text className="mt-1 text-sm text-content-muted">{rir.toFixed(0)} RIR</Text>
        </View>
      </Stack>

      {/* Status Message */}
      {statusMessage && (
        <View className="mb-5 rounded-2xl p-4" style={{ backgroundColor: rpeColor + '15' }}>
          <Text className="text-center text-base font-bold" style={{ color: rpeColor }}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Position Bar (if sample available) */}
      {currentSample && (
        <View className="mb-5">
          <View className="mb-2 flex-row justify-between">
            <Text className="text-sm text-content-tertiary">Position</Text>
            <Text className="text-sm font-medium text-content-secondary">
              {((currentSample.position ?? 0) * 100).toFixed(0)}%
            </Text>
          </View>
          <View
            className="h-3 overflow-hidden rounded-full"
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
          <Text className="mb-1 text-xs font-medium text-content-muted">Force</Text>
          <Text className="text-2xl font-bold text-content-primary">
            {Math.round(currentSample?.force ?? 0)}
          </Text>
        </Surface>
        <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
          <Text className="mb-1 text-xs font-medium text-content-muted">Velocity</Text>
          <Text className="text-2xl font-bold text-content-primary">
            {(currentSample?.velocity ?? 0).toFixed(2)}
          </Text>
        </Surface>
        <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
          <Text className="mb-1 text-xs font-medium text-content-muted">Vel Loss</Text>
          <Text className="text-2xl font-bold" style={{ color: rpeColor }}>
            {velocityLoss > 0 ? '-' : ''}
            {Math.round(velocityLoss)}%
          </Text>
        </Surface>
      </Stack>

      {/* Fatigue Progress Bar */}
      <View className="mt-4">
        <View className="h-2 overflow-hidden rounded-full bg-zinc-700">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(velocityLoss, 50) * 2}%`,
              backgroundColor:
                velocityLoss > 30 ? '#ef4444' : velocityLoss > 20 ? '#eab308' : '#22c55e',
            }}
          />
        </View>
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-zinc-500">Fresh</Text>
          <Text className="text-xs text-zinc-500">Fatigued</Text>
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
