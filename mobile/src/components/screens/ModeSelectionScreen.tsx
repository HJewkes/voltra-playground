import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, Section, SectionContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { ModeControls } from '@/components/mode';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

type IconName = keyof typeof Ionicons.glyphMap;
const MODE_META: Partial<Record<TrainingMode, { desc: string; icon: IconName }>> = {
  [TrainingMode.WeightTraining]: { desc: 'Free weights & cables', icon: 'barbell-outline' },
  [TrainingMode.ResistanceBand]: { desc: 'Elastic resistance', icon: 'fitness-outline' },
  [TrainingMode.Rowing]: { desc: 'Row machine simulation', icon: 'boat-outline' },
  [TrainingMode.Damper]: { desc: 'Fluid resistance', icon: 'water-outline' },
  [TrainingMode.Isokinetic]: { desc: 'Constant velocity', icon: 'speedometer-outline' },
  [TrainingMode.Isometric]: { desc: 'Static holds', icon: 'hand-left-outline' },
};

const TRAINING_MODES = Object.keys(MODE_META).map(Number) as TrainingMode[];
export function ModeSelectionScreen() {
  const router = useRouter();
  const isConnected = useConnectionStore(selectIsConnected);
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());
  const disconnectAll = useConnectionStore((s) => s.disconnectAll);

  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  if (!voltraStore) return null;

  return <ModeSelectionInner voltraStore={voltraStore} disconnectAll={disconnectAll} />;
}

function ModeSelectionInner({ voltraStore, disconnectAll }: {
  voltraStore: VoltraStoreApi;
  disconnectAll: () => Promise<void>;
}) {
  const router = useRouter();
  const mode = useStore(voltraStore, (s) => s.mode);
  const setMode = useStore(voltraStore, (s) => s.setMode);
  const deviceName = useStore(voltraStore, (s) => s.deviceName) ?? 'Voltra';

  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);
  const isIdle = mode === TrainingMode.Idle;

  const handleDisconnect = async () => {
    setShowDisconnectMenu(false);
    await disconnectAll();
  };

  const handleIdleToggle = () => {
    setMode(isIdle ? TrainingMode.WeightTraining : TrainingMode.Idle);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-400">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <Text accessibilityRole="header" className="text-lg font-semibold text-text-primary">
          Training Mode
        </Text>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity
            onPress={handleIdleToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isIdle ? 'Exit idle mode' : 'Enter idle mode'}
            className="flex-row items-center rounded-lg px-3 py-1.5"
            style={{ backgroundColor: isIdle ? alpha(t['brand-primary'], 0.15) : t['background-subtle'] }}
          >
            <Ionicons
              name={isIdle ? 'pause-circle' : 'pause-circle-outline'}
              size={16}
              color={isIdle ? t['brand-primary'] : t['text-tertiary']}
            />
            <Text
              className="ml-1.5 text-xs font-medium"
              style={{ color: isIdle ? t['brand-primary'] : t['text-tertiary'] }}
            >
              Idle
            </Text>
          </TouchableOpacity>
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
      </View>

      <ScrollView className="flex-1">
        <View className="p-4">
          <View
            className="mb-4 flex-row items-center rounded-xl p-3"
            style={{ backgroundColor: alpha(t['status-success'], 0.08) }}
          >
            <View
              className="items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, backgroundColor: alpha(t['status-success'], 0.15) }}
            >
              <Ionicons name="bluetooth" size={18} color={t['status-success']} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-text-primary">{deviceName}</Text>
              <Text className="text-xs text-text-tertiary">Connected</Text>
            </View>
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: t['status-success'] }} />
          </View>

          <Section>
            <SectionContent>
              <View className="flex-row flex-wrap gap-3">
                {TRAINING_MODES.map((modeValue) => {
                  const isSelected = mode === modeValue;
                  const meta = MODE_META[modeValue]!;
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
                        <CardContent className="flex-row items-center gap-3 px-4">
                          <Ionicons
                            name={meta.icon}
                            size={20}
                            color={isSelected ? t['brand-primary'] : t['text-secondary']}
                          />
                          <View className="flex-1">
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: isSelected ? t['brand-primary'] : t['text-primary'] }}
                            >
                              {TrainingModeNames[modeValue]}
                            </Text>
                            <Text className="text-xs text-text-tertiary">{meta.desc}</Text>
                          </View>
                        </CardContent>
                      </Card>
                    </View>
                  );
                })}
              </View>
            </SectionContent>
          </Section>

          <ModeControls mode={mode} voltraStore={voltraStore!} />

          {!isIdle && (
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
