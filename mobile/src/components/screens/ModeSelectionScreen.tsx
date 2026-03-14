/**
 * ModeSelectionScreen
 *
 * Training mode selection with per-mode configuration.
 * Uses granular Zustand selectors to minimize re-renders.
 */

import React, { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  CardContent,
  Section,
  SectionContent,
  getSemanticColors,
} from '@titan-design/react-ui';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { WeightTrainingConfig, BasicModeConfig } from '@/components/mode';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

const MODE_DESCRIPTIONS: Record<TrainingMode, string> = {
  [TrainingMode.Idle]: 'Standby mode',
  [TrainingMode.WeightTraining]: 'Free weights & cables',
  [TrainingMode.ResistanceBand]: 'Elastic resistance',
  [TrainingMode.Rowing]: 'Row machine simulation',
  [TrainingMode.Damper]: 'Fluid resistance',
  [TrainingMode.CustomCurves]: 'User-defined profiles',
  [TrainingMode.Isokinetic]: 'Constant velocity',
  [TrainingMode.Isometric]: 'Static holds',
};

const MODE_LIST = [
  TrainingMode.WeightTraining,
  TrainingMode.ResistanceBand,
  TrainingMode.Rowing,
  TrainingMode.Damper,
  TrainingMode.Isokinetic,
  TrainingMode.Isometric,
  TrainingMode.Idle,
] as const;

const ECCENTRIC_MODES = new Set<TrainingMode>([TrainingMode.ResistanceBand]);

function ModeConfig({ mode, voltraStore }: { mode: TrainingMode; voltraStore: VoltraStoreApi }) {
  if (mode === TrainingMode.WeightTraining) {
    return <WeightTrainingConfig voltraStore={voltraStore} />;
  }

  if (mode === TrainingMode.Idle) {
    return null;
  }

  return (
    <BasicModeConfig
      voltraStore={voltraStore}
      showEccentric={ECCENTRIC_MODES.has(mode)}
    />
  );
}

export function ModeSelectionScreen() {
  const router = useRouter();
  const isConnected = useConnectionStore(selectIsConnected);
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());

  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  if (!voltraStore) return null;

  return <ModeSelectionContent voltraStore={voltraStore} />;
}

function ModeSelectionContent({ voltraStore }: { voltraStore: VoltraStoreApi }) {
  const router = useRouter();
  const mode = useStore(voltraStore, (s) => s.mode);
  const setMode = useStore(voltraStore, (s) => s.setMode);

  const showConfig = mode !== TrainingMode.Idle;

  return (
    <SafeAreaView className="flex-1 bg-background-base">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <Text className="text-lg font-semibold text-text-primary">Training Mode</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="cog-outline" size={24} color={t['text-secondary']} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4">
          {/* Mode grid */}
          <Section>
            <SectionContent>
              <View className="flex-row flex-wrap gap-3">
                {MODE_LIST.map((modeValue) => {
                  const isSelected = mode === modeValue;
                  return (
                    <View key={modeValue} className="w-[48%]">
                      <Card
                        variant={isSelected ? 'outline' : 'filled'}
                        elevation={isSelected ? 2 : 1}
                        isInteractive
                        onPress={() => setMode(modeValue)}
                        borderColor={isSelected ? t['brand-primary'] : undefined}
                      >
                        <CardContent>
                          <Text
                            className="text-base font-semibold"
                            style={{ color: isSelected ? t['brand-primary'] : t['text-primary'] }}
                          >
                            {TrainingModeNames[modeValue]}
                          </Text>
                          <Text className="mt-1 text-xs text-text-tertiary">
                            {MODE_DESCRIPTIONS[modeValue]}
                          </Text>
                        </CardContent>
                      </Card>
                    </View>
                  );
                })}
              </View>
            </SectionContent>
          </Section>

          {/* Per-mode config */}
          <ModeConfig mode={mode} voltraStore={voltraStore} />

          {/* Start exercise button */}
          {showConfig && (
            <View className="mt-4 px-2 pb-4">
              <TouchableOpacity
                onPress={() => router.push('/exercise')}
                activeOpacity={0.8}
                className="items-center rounded-xl py-4"
                style={{ backgroundColor: t['brand-primary'] }}
              >
                <Text className="text-base font-bold text-white">Start Exercise</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
