/**
 * ModeSelectionScreen
 *
 * Training mode selection with per-mode configuration.
 * Uses granular Zustand selectors to minimize re-renders.
 */

import React, { useEffect, useState } from 'react';
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
  const disconnectAll = useConnectionStore((s) => s.disconnectAll);

  const mode = useStore(voltraStore!, (s) => s.mode);
  const setMode = useStore(voltraStore!, (s) => s.setMode);

  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  const handleDisconnect = async () => {
    setShowDisconnectMenu(false);
    await disconnectAll();
  };

  const showConfig = mode !== TrainingMode.Idle;

  return (
    <SafeAreaView className="flex-1 bg-surface-400">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <Text accessibilityRole="header" className="text-lg font-semibold text-text-primary">Training Mode</Text>
        <View className="relative">
          <TouchableOpacity
            onPress={() => setShowDisconnectMenu((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Device settings"
          >
            <Ionicons name="cog-outline" size={24} color={t['text-secondary']} />
          </TouchableOpacity>
          {showDisconnectMenu && (
            <View className="absolute right-0 top-8 z-10 rounded-lg bg-surface-300 p-1 shadow-lg">
              <TouchableOpacity
                onPress={handleDisconnect}
                className="flex-row items-center gap-2 rounded-md px-4 py-2.5"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Disconnect device"
              >
                <Ionicons name="bluetooth-outline" size={16} color={t['status-error']} />
                <Text style={{ color: t['status-error'] }} className="text-sm font-medium">
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
                        accessibilityState={{ selected: isSelected }}
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
          <ModeConfig mode={mode} voltraStore={voltraStore!} />

          {/* Start exercise button */}
          {showConfig && (
            <View className="mt-4 px-2 pb-4">
              <TouchableOpacity
                onPress={() => router.push('/exercise')}
                activeOpacity={0.8}
                className="items-center rounded-xl py-4"
                style={{ backgroundColor: t['brand-primary'] }}
                accessibilityRole="button"
                accessibilityLabel="Start Exercise"
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
