/**
 * SetSummaryModal
 *
 * A bottom sheet modal showing workout set summary with stats.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Drawer, DrawerBody, DrawerFooter, HStack, Surface, Metric } from '@titan-design/react-ui';
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
    <Drawer isOpen={visible} onClose={onClose} title="Set Complete!" placement="bottom">
      <DrawerBody>
        {summary && (
          <>
            {/* Main Stats */}
            <HStack justify="around" style={{ marginBottom: 24 }}>
              <Metric value={String(repCount)} label="Reps" size="lg" />
              <Metric
                value={summary.rpe.toFixed(1)}
                label="RPE"
                size="lg"
              />
              <Metric value={summary.rir.toFixed(0)} label="RIR" size="lg" />
            </HStack>

            {/* Effort Bar */}
            <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
              <View className="p-5">
                <View className="mb-3 flex-row justify-between">
                  <Text className="font-bold text-content-secondary">Effort</Text>
                  <Text className="font-bold text-content-primary">
                    {getEffortLabel(summary.rpe)}
                  </Text>
                </View>
                <View className="overflow-hidden rounded-full" style={{ height: 6, backgroundColor: '#1C1C1C' }}>
                  <View className="h-full rounded-full" style={{ width: `${summary.rpe * 10}%`, backgroundColor: getRPEColor(summary.rpe) }} />
                </View>
                <Text className="mt-3 text-sm text-content-muted">
                  {getRIRDescription(summary.rir)}
                </Text>
              </View>
            </Surface>

            {/* Velocity Stats */}
            <HStack gap={2} style={{ marginBottom: 16 }}>
              <Surface
                elevation={0}
                className="rounded-xl bg-surface-input"
                style={{ flex: 1, padding: 16 }}
              >
                <Text className="text-xs font-medium text-content-muted">Velocity Loss</Text>
                <Text className="mt-1 text-xl font-bold text-content-primary">
                  {summary.velocityLossPct > 0 ? '-' : ''}
                  {Math.abs(summary.velocityLossPct).toFixed(0)}%
                </Text>
              </Surface>
              <Surface
                elevation={0}
                className="rounded-xl bg-surface-input"
                style={{ flex: 1, padding: 16 }}
              >
                <Text className="text-xs font-medium text-content-muted">Avg Velocity</Text>
                <Text className="mt-1 text-xl font-bold text-content-primary">
                  {summary.meanVelocity.toFixed(2)}
                </Text>
              </Surface>
            </HStack>

            {/* Tempo - only show if breakdown provided */}
            {tempoBreakdown && (
              <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 24 }}>
                <View className="p-5">
                  <View className="mb-3 flex-row justify-between">
                    <Text className="font-bold text-content-secondary">Avg Tempo</Text>
                    <Text className="font-bold text-content-primary">
                      {avgTempo ?? '0-0-0-0'}
                    </Text>
                  </View>
                  <HStack gap={1}>
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
                  </HStack>
                </View>
              </Surface>
            )}
          </>
        )}
      </DrawerBody>

      <DrawerFooter>
        <TouchableOpacity
          onPress={onClose}
          className="rounded-2xl py-5"
          style={{ backgroundColor: colors.primary[600] }}
          activeOpacity={0.8}
        >
          <Text className="text-center text-lg font-bold text-white">Continue</Text>
        </TouchableOpacity>
      </DrawerFooter>
    </Drawer>
  );
}
