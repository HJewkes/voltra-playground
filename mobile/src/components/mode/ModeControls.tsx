import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
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

const WEIGHT_MIN = 5;
const WEIGHT_MAX = 200;
const clampWeight = (v: number) => Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, v));

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

  const dragAccum = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => { dragAccum.current = 0; },
      onPanResponderMove: (_, g) => {
        const step = Math.abs(g.vy) > 1.5 ? 5 : 1;
        const ticks = Math.floor(-g.dy / 12) - Math.floor(-dragAccum.current / 12);
        if (ticks !== 0) {
          setLocalWeight((prev) => clampWeight(prev + ticks * step));
        }
        dragAccum.current = g.dy;
      },
      onPanResponderRelease: () => {
        setLocalWeight((prev) => { setWeight(prev); return prev; });
      },
    }),
  ).current;

  const setWeightRef = useRef(setWeight);
  setWeightRef.current = setWeight;
  const wheelHandler = useRef<(e: WheelEvent) => void>();
  const weightCallbackRef = useCallback((node: View | null) => {
    const el = node as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    if (wheelHandler.current) el.removeEventListener('wheel', wheelHandler.current);
    wheelHandler.current = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const step = e.shiftKey ? 10 : e.ctrlKey ? 5 : 1;
      setLocalWeight((prev) => {
        const next = clampWeight(prev + delta * step);
        setWeightRef.current(next);
        return next;
      });
    };
    el.addEventListener('wheel', wheelHandler.current, { passive: false });
  }, []);

  if (mode === TrainingMode.Idle) return null;

  const label = WEIGHT_LABEL[mode] ?? 'Weight';
  const showEccentric = SHOW_ECCENTRIC.has(mode);
  const showChains = SHOW_CHAINS.has(mode);

  return (
    <Section>
      <SectionContent>
        <Surface elevation={1} className="rounded-xl p-3">
          <View
            ref={weightCallbackRef}
            {...panResponder.panHandlers}
            className="mb-2 select-none"
            accessibilityRole="adjustable"
            accessibilityLabel={`${localWeight} pounds`}
          >
            <Text className="text-center text-[10px] font-medium text-text-tertiary">{label}</Text>
            <Text className="text-center text-3xl font-bold" style={{ color: t['brand-primary'] }}>
              {localWeight}
              <Text className="text-lg text-text-tertiary"> lbs</Text>
            </Text>
          </View>
          <IncrementRow value={localWeight} min={WEIGHT_MIN} max={WEIGHT_MAX} onChange={handleIncrement} />

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
    <View className="mt-3 border-t border-surface-300 pt-3">
      <View className="mb-1 flex-row items-center justify-between">
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
    <View className="mt-3 border-t border-surface-300 pt-3">
      <View className="mb-1 flex-row items-center justify-between">
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
