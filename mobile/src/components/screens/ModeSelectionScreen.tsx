/**
 * ModeSelectionScreen
 *
 * Training mode selection and configuration.
 * Uses granular Zustand selectors to minimize re-renders.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { TrainingMode } from '@/domain/device';
import { Section } from '@/components/ui/layout';
import { Surface, OptionSelector } from '@/components/ui';
import { ConnectionGuard } from '@/components/device';
import { WeightTrainingConfig } from '@/components/mode';
import type { Option } from '@/components/ui';
import type { Ionicons } from '@expo/vector-icons';

// Mode options with icons
const MODE_OPTIONS: Option<TrainingMode>[] = [
  { value: TrainingMode.Idle, label: 'Idle', icon: 'pause-circle-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.WeightTraining, label: 'Weight', icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.ResistanceBand, label: 'Band', icon: 'fitness-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.Rowing, label: 'Rowing', icon: 'boat-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.Damper, label: 'Damper', icon: 'speedometer-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.CustomCurves, label: 'Custom', icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.Isokinetic, label: 'Isokinetic', icon: 'repeat-outline' as keyof typeof Ionicons.glyphMap },
  { value: TrainingMode.Isometric, label: 'Isometric', icon: 'lock-closed-outline' as keyof typeof Ionicons.glyphMap },
];

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
              <OptionSelector
                options={MODE_OPTIONS}
                selected={mode}
                onSelect={setMode}
                direction="column"
                gap="sm"
              />
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
