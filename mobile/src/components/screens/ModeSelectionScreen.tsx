import React, { useEffect } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, Section, SectionContent, getSemanticColors } from '@titan-design/react-ui';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { TrainingMode, TrainingModeNames } from '@/domain/device';
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

  useEffect(() => {
    if (!isConnected) router.replace('/');
  }, [isConnected, router]);

  if (!voltraStore) return null;

  return <ModeSelectionInner voltraStore={voltraStore} />;
}

function ModeSelectionInner({ voltraStore }: { voltraStore: VoltraStoreApi }) {
  const router = useRouter();
  const mode = useStore(voltraStore, (s) => s.mode);
  const setMode = useStore(voltraStore, (s) => s.setMode);
  const deviceName = useStore(voltraStore, (s) => s.deviceName) ?? 'Voltra';
  const { width } = useWindowDimensions();
  const singleColumn = width < 400;

  const handleSelectMode = (modeValue: TrainingMode) => {
    setMode(modeValue);
    router.push('/exercise');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-400">
      <View className="px-4 pt-2 pb-1">
        <View className="flex-row items-center gap-3">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: t['status-success'] }} />
          <Text className="text-sm font-semibold text-text-primary">{deviceName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 pb-4">
          <Section>
            <SectionContent>
              <Text className="mb-3 text-center text-lg font-bold text-text-primary">
                Select Training Mode
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TRAINING_MODES.map((modeValue) => {
                  const isSelected = mode === modeValue;
                  const meta = MODE_META[modeValue]!;
                  return (
                    <View key={modeValue} style={{ width: singleColumn ? '100%' : '48%' }}>
                      <Card
                        variant={isSelected ? 'outline' : 'filled'}
                        elevation={isSelected ? 2 : 1}
                        isInteractive
                        onPress={() => handleSelectMode(modeValue)}
                        borderColor={isSelected ? t['brand-primary'] : undefined}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <CardContent className="flex-row items-center gap-3 px-4">
                          <Ionicons
                            name={meta.icon}
                            size={18}
                            color={isSelected ? t['brand-primary'] : t['text-secondary']}
                          />
                          <View className="flex-1">
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: isSelected ? t['brand-primary'] : t['text-primary'] }}
                            >
                              {TrainingModeNames[modeValue]}
                            </Text>
                            <Text className="text-[10px] text-text-tertiary">{meta.desc}</Text>
                          </View>
                        </CardContent>
                      </Card>
                    </View>
                  );
                })}
              </View>
            </SectionContent>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
