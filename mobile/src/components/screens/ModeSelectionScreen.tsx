/**
 * ModeSelectionScreen
 *
 * Training mode selection and configuration.
 * Uses granular Zustand selectors to minimize re-renders.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { RadioGroup, Radio } from '@titan-design/react-ui';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { TrainingMode } from '@/domain/device';
import { Section } from '@/components/ui/layout';
import { Surface } from '@/components/ui';
import { ConnectionGuard } from '@/components/device';
import { WeightTrainingConfig } from '@/components/mode';

const MODE_OPTIONS = [
  { value: TrainingMode.Idle, label: 'Idle' },
  { value: TrainingMode.WeightTraining, label: 'Weight' },
  { value: TrainingMode.ResistanceBand, label: 'Band' },
  { value: TrainingMode.Rowing, label: 'Rowing' },
  { value: TrainingMode.Damper, label: 'Damper' },
  { value: TrainingMode.CustomCurves, label: 'Custom' },
  { value: TrainingMode.Isokinetic, label: 'Isokinetic' },
  { value: TrainingMode.Isometric, label: 'Isometric' },
] as const;

function ModeSelectionContent() {
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());

  // Granular selector - only re-renders when mode changes
  const mode = useStore(voltraStore!, (s) => s.mode);
  const setMode = useStore(voltraStore!, (s) => s.setMode);

  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        <Section title="Training Mode">
          <Surface elevation={1} radius="lg" border={false}>
            <View className="p-4">
              <RadioGroup
                value={String(mode)}
                onChange={(v) => setMode(v as TrainingMode)}
                orientation="vertical"
                gap="sm"
              >
                {MODE_OPTIONS.map((opt) => (
                  <Radio key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </Radio>
                ))}
              </RadioGroup>
            </View>
          </Surface>
        </Section>

        {mode === TrainingMode.WeightTraining && (
          <WeightTrainingConfig voltraStore={voltraStore!} />
        )}

        {mode !== TrainingMode.Idle && mode !== TrainingMode.WeightTraining && (
          <Section title="Configuration">
            <Surface elevation={1} radius="lg" border={false}>
              <View className="items-center p-6">
                <Text className="text-center text-content-muted">
                  Configuration for this mode is not yet available.
                </Text>
              </View>
            </Surface>
          </Section>
        )}
      </View>
    </ScrollView>
  );
}

export function ModeSelectionScreen() {
  return (
    <ConnectionGuard message="Connect to your Voltra to configure training modes">
      <ModeSelectionContent />
    </ConnectionGuard>
  );
}
