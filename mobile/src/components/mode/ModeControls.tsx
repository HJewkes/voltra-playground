import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import Slider from '@react-native-community/slider';
import { Section, SectionContent, Surface, getSemanticColors } from '@titan-design/react-ui';
import { TrainingMode } from '@/domain/device';
import { IncrementRow } from './IncrementRow';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

const WEIGHT_LABEL: Partial<Record<TrainingMode, string>> = {
  [TrainingMode.Isokinetic]: 'Max Force',
  [TrainingMode.Isometric]: 'Hold Force',
};

const SHOW_ECCENTRIC = new Set([TrainingMode.WeightTraining, TrainingMode.ResistanceBand]);
const SHOW_CHAINS = new Set([TrainingMode.WeightTraining]);

interface ModeControlsProps {
  voltraStore: VoltraStoreApi;
  mode: TrainingMode;
}

export function ModeControls({ voltraStore, mode }: ModeControlsProps) {
  const weight = useStore(voltraStore, (s) => s.weight);
  const setWeight = useStore(voltraStore, (s) => s.setWeight);
  const eccentric = useStore(voltraStore, (s) => s.eccentric);
  const setEccentric = useStore(voltraStore, (s) => s.setEccentric);
  const { chains, inverseChains } = useStore(
    voltraStore,
    useShallow((s) => ({ chains: s.chains, inverseChains: s.inverseChains })),
  );
  const setChains = useStore(voltraStore, (s) => s.setChains);
  const setInverseChains = useStore(voltraStore, (s) => s.setInverseChains);

  const [localWeight, setLocalWeight] = useState(weight);
  const handleIncrement = useCallback(
    (value: number) => { setLocalWeight(value); setWeight(value); },
    [setWeight],
  );

  if (mode === TrainingMode.Idle) return null;

  const label = WEIGHT_LABEL[mode] ?? 'Weight';
  const showEccentric = SHOW_ECCENTRIC.has(mode);
  const showChains = SHOW_CHAINS.has(mode);

  return (
    <Section>
      <SectionContent>
        <Surface elevation={1} className="rounded-xl p-4">
          <Text className="mb-1 text-center text-xs font-medium text-text-tertiary">{label}</Text>
          <Text
            className="mb-3 text-center text-4xl font-bold"
            style={{ color: t['brand-primary'] }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${localWeight} pounds`}
          >
            {localWeight}
            <Text className="text-xl text-text-tertiary"> lbs</Text>
          </Text>
          <IncrementRow value={localWeight} min={5} max={200} onChange={handleIncrement} />

          {showEccentric && (
            <CompactEccentric value={eccentric} onChange={setEccentric} />
          )}

          {showChains && (
            <CompactChains
              chains={chains}
              inverseChains={inverseChains}
              onChainsChange={setChains}
              onInverseChainsChange={setInverseChains}
            />
          )}
        </Surface>
      </SectionContent>
    </Section>
  );
}

function CompactEccentric({ value, onChange }: { value: number; onChange: (v: number) => Promise<void> }) {
  const ECC_OFFSET = 195;
  const [slider, setSlider] = useState(Math.round(value) + ECC_OFFSET);
  const sliding = useRef(false);

  useEffect(() => { if (!sliding.current) setSlider(Math.round(value) + ECC_OFFSET); }, [value]);

  const display = slider - ECC_OFFSET;
  const eccLabel = display > 0 ? `+${display}% overload` : display < 0 ? `${display}% underload` : 'Balanced';
  const color = display > 0 ? t['status-success'] : display < 0 ? t['status-error'] : t['text-disabled'];

  return (
    <View className="mt-4 border-t border-surface-300 pt-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-text-tertiary">Eccentric</Text>
        <Text className="text-xs font-semibold" style={{ color }}>{eccLabel}</Text>
      </View>
      <Slider
        value={slider}
        onValueChange={(v: number) => { sliding.current = true; setSlider(Math.round(v)); }}
        onSlidingComplete={(v: number) => { sliding.current = false; const r = Math.round(v); setSlider(r); onChange(r - ECC_OFFSET); }}
        minimumValue={0}
        maximumValue={390}
        step={5}
        minimumTrackTintColor={display === 0 ? t['surface-elevated'] : display > 0 ? t['brand-primary'] : t['status-error']}
        maximumTrackTintColor={t['surface-elevated']}
        thumbTintColor={display === 0 ? t['text-disabled'] : display > 0 ? t['brand-primary'] : t['status-error']}
      />
    </View>
  );
}

function CompactChains({ chains, inverseChains, onChainsChange, onInverseChainsChange }: {
  chains: number; inverseChains: number;
  onChainsChange: (v: number) => Promise<void>;
  onInverseChainsChange: (v: number) => Promise<void>;
}) {
  const CHAIN_OFFSET = 100;
  const combined = inverseChains > 0 ? -inverseChains : chains;
  const [slider, setSlider] = useState(combined + CHAIN_OFFSET);
  const sliding = useRef(false);

  useEffect(() => { if (!sliding.current) setSlider(combined + CHAIN_OFFSET); }, [combined]);

  const commit = async (v: number) => {
    sliding.current = false;
    const rounded = Math.round(v);
    setSlider(rounded);
    const real = rounded - CHAIN_OFFSET;
    if (real >= 0) {
      if (inverseChains > 0) await onInverseChainsChange(0);
      await onChainsChange(real);
    } else {
      if (chains > 0) await onChainsChange(0);
      await onInverseChainsChange(-real);
    }
  };

  const display = slider - CHAIN_OFFSET;
  const chainLabel = display > 0 ? `+${display} lbs` : display < 0 ? `${display} lbs inverse` : 'Off';
  const color = display !== 0 ? t['brand-primary'] : t['text-disabled'];

  return (
    <View className="mt-4 border-t border-surface-300 pt-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-text-tertiary">Chains</Text>
        <Text className="text-xs font-semibold" style={{ color }}>{chainLabel}</Text>
      </View>
      <Slider
        value={slider}
        onValueChange={(v: number) => { sliding.current = true; setSlider(Math.round(v)); }}
        onSlidingComplete={commit}
        minimumValue={0}
        maximumValue={200}
        step={1}
        minimumTrackTintColor={display === 0 ? t['surface-elevated'] : display > 0 ? t['brand-primary'] : t['status-error']}
        maximumTrackTintColor={t['surface-elevated']}
        thumbTintColor={display === 0 ? t['text-disabled'] : display > 0 ? t['brand-primary'] : t['status-error']}
      />
    </View>
  );
}
