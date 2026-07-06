/**
 * BasicModeConfig
 *
 * Settings panel for training modes that use a simple weight slider
 * and optional eccentric control. Used by Resistance Band, Rowing,
 * Damper, Isokinetic, and Isometric modes.
 */

import React, { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useStore } from 'zustand';
import Slider from '@react-native-community/slider';
import {
  Section,
  SectionHeader,
  SectionContent,
  Surface,
  getSemanticColors,
} from '@titan-design/react-ui';
import { EccentricSlider } from './EccentricSlider';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

interface BasicModeConfigProps {
  voltraStore: VoltraStoreApi;
  showEccentric?: boolean;
}

export function BasicModeConfig({ voltraStore, showEccentric = false }: BasicModeConfigProps) {
  const weight = useStore(voltraStore, (s) => s.weight);
  const eccentric = useStore(voltraStore, (s) => s.eccentric);
  const setWeight = useStore(voltraStore, (s) => s.setWeight);
  const setEccentric = useStore(voltraStore, (s) => s.setEccentric);

  const [localWeight, setLocalWeight] = useState(weight);

  const handleWeightComplete = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      setLocalWeight(rounded);
      setWeight(rounded);
    },
    [setWeight]
  );

  return (
    <View>
      <Section>
        <SectionHeader title="Weight" />
        <SectionContent>
          <Surface elevation={1} className="rounded-xl p-6">
            <Text className="mb-4 text-center text-5xl font-bold text-text-primary">
              {localWeight} <Text className="text-2xl text-text-tertiary">lbs</Text>
            </Text>
            <Slider
              value={localWeight}
              onValueChange={(v: number) => setLocalWeight(Math.round(v))}
              onSlidingComplete={handleWeightComplete}
              minimumValue={5}
              maximumValue={200}
              step={1}
              minimumTrackTintColor={t['brand-primary']}
              maximumTrackTintColor={t['surface-elevated']}
              thumbTintColor={t['brand-primary']}
            />
            <View className="mt-1 flex-row justify-between">
              <Text className="text-xs text-text-disabled">5 lbs</Text>
              <Text className="text-xs text-text-disabled">200 lbs</Text>
            </View>
          </Surface>
        </SectionContent>
      </Section>

      {showEccentric && (
        <Section>
          <SectionHeader title="Eccentric" />
          <SectionContent>
            <Surface elevation={1} className="rounded-xl p-6">
              <EccentricSlider value={eccentric} onChange={setEccentric} />
            </Surface>
          </SectionContent>
        </Section>
      )}
    </View>
  );
}
