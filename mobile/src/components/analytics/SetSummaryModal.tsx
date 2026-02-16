/**
 * SetSummaryModal
 *
 * A bottom sheet modal showing workout set summary with stats.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomSheet, Stack, Surface, StatDisplay, ProgressBar } from '../ui';
import { getEffortLabel, getRIRDescription, getRPEColor } from '@/domain/workout';
import { colors } from '@/theme';

export interface SetSummaryData {
  rpe: number;
  rir: number;
  velocityLossPct: number;
  meanVelocity: number;
}

export interface SetSummaryModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** Number of reps completed */
  repCount: number;
  /** Set summary data */
  summary: SetSummaryData | null;
  /** Average tempo string (e.g., "2-0-1-0") */
  avgTempo?: string;
  /** Average phase timings in seconds */
  tempoBreakdown?: {
    eccentric: number;
    pauseTop: number;
    concentric: number;
    pauseBottom: number;
  };
}

/**
 * SetSummaryModal component - workout completion summary.
 */
export function SetSummaryModal({
  visible,
  onClose,
  repCount,
  summary,
  avgTempo,
  tempoBreakdown,
}: SetSummaryModalProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Set Complete!">
      {summary && (
        <>
          {/* Main Stats */}
          <Stack direction="row" justify="space-around" style={{ marginBottom: 24 }}>
            <StatDisplay value={repCount} label="Reps" size="lg" color={colors.primary[500]} />
            <StatDisplay
              value={summary.rpe.toFixed(1)}
              label="RPE"
              size="lg"
              color={getRPEColor(summary.rpe)}
            />
            <StatDisplay value={summary.rir.toFixed(0)} label="RIR" size="lg" />
          </Stack>

          {/* Effort Bar */}
          <Surface elevation="inset" radius="lg" border={false} style={{ marginBottom: 16 }}>
            <View className="p-5">
              <View className="mb-3 flex-row justify-between">
                <Text className="font-bold text-content-secondary">Effort</Text>
                <Text className="font-bold text-content-primary">
                  {getEffortLabel(summary.rpe)}
                </Text>
              </View>
              <ProgressBar progress={summary.rpe * 10} color={getRPEColor(summary.rpe)} />
              <Text className="mt-3 text-sm text-content-muted">
                {getRIRDescription(summary.rir)}
              </Text>
            </View>
          </Surface>

          {/* Velocity Stats */}
          <Stack direction="row" gap="sm" style={{ marginBottom: 16 }}>
            <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
              <Text className="text-xs font-medium text-content-muted">Velocity Loss</Text>
              <Text className="mt-1 text-xl font-bold text-content-primary">
                {summary.velocityLossPct > 0 ? '-' : ''}
                {Math.abs(summary.velocityLossPct).toFixed(0)}%
              </Text>
            </Surface>
            <Surface elevation="inset" radius="lg" border={false} style={{ flex: 1, padding: 16 }}>
              <Text className="text-xs font-medium text-content-muted">Avg Velocity</Text>
              <Text className="mt-1 text-xl font-bold text-content-primary">
                {summary.meanVelocity.toFixed(2)}
              </Text>
            </Surface>
          </Stack>

          {/* Tempo - only show if breakdown provided */}
          {tempoBreakdown && (
            <Surface elevation="inset" radius="lg" border={false} style={{ marginBottom: 24 }}>
              <View className="p-5">
                <View className="mb-3 flex-row justify-between">
                  <Text className="font-bold text-content-secondary">Avg Tempo</Text>
                  <Text className="font-bold text-content-primary">{avgTempo ?? '0-0-0-0'}</Text>
                </View>
                <Stack direction="row" gap="xs">
                  <View className="flex-1 items-center">
                    <Text className="font-bold" style={{ color: colors.info.DEFAULT }}>
                      {tempoBreakdown.eccentric.toFixed(1)}s
                    </Text>
                    <Text className="mt-1 text-xs text-content-muted">Ecc</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="font-bold" style={{ color: colors.warning.DEFAULT }}>
                      {tempoBreakdown.pauseTop.toFixed(1)}s
                    </Text>
                    <Text className="mt-1 text-xs text-content-muted">Top</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="font-bold" style={{ color: colors.success.DEFAULT }}>
                      {tempoBreakdown.concentric.toFixed(1)}s
                    </Text>
                    <Text className="mt-1 text-xs text-content-muted">Con</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="font-bold text-content-secondary">
                      {tempoBreakdown.pauseBottom.toFixed(1)}s
                    </Text>
                    <Text className="mt-1 text-xs text-content-muted">Bot</Text>
                  </View>
                </Stack>
              </View>
            </Surface>
          )}
        </>
      )}

      <TouchableOpacity
        onPress={onClose}
        className="rounded-2xl py-5"
        style={{ backgroundColor: colors.primary[600] }}
        activeOpacity={0.8}
      >
        <Text className="text-center text-lg font-bold text-white">Continue</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}
