import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
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

  // Elastic jog-shuttle: horizontal displacement controls tick speed.
  // Drag right = increase, left = decrease. Further = faster. Release to stop.
  const DEAD_ZONE = 12;
  const MAX_STRETCH = 120;
  const MIN_INTERVAL = 30;
  const MAX_INTERVAL = 300;
  const displacement = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pillStretch = useSharedValue(0); // -1..1 normalized displacement

  const stopTicking = useCallback(() => {
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    const tick = () => {
      const d = displacement.current;
      if (Math.abs(d) <= DEAD_ZONE) return;
      const direction = d > 0 ? 1 : -1; // drag right = increase
      setLocalWeight((prev) => clampWeight(prev + direction));
    };
    const scheduleNext = () => {
      const stretch = Math.min(Math.abs(displacement.current), MAX_STRETCH);
      const interval = stretch <= DEAD_ZONE ? MAX_INTERVAL
        : MAX_INTERVAL - (MAX_INTERVAL - MIN_INTERVAL) * ((stretch - DEAD_ZONE) / (MAX_STRETCH - DEAD_ZONE));
      tickTimer.current = setTimeout(() => { tick(); scheduleNext(); }, interval);
    };
    tick();
    scheduleNext();
  }, [stopTicking]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > DEAD_ZONE,
      onPanResponderGrant: () => {
        displacement.current = 0;
        pillStretch.value = 0;
      },
      onPanResponderMove: (_, g) => {
        const wasActive = Math.abs(displacement.current) > DEAD_ZONE;
        displacement.current = g.dx;
        const clamped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, g.dx));
        pillStretch.value = clamped / MAX_STRETCH;
        if (!wasActive && Math.abs(g.dx) > DEAD_ZONE) startTicking();
      },
      onPanResponderRelease: () => {
        displacement.current = 0;
        stopTicking();
        // Bouncy snap-back: low damping = cartoony elastic wiggle
        pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
        setLocalWeight((prev) => { setWeight(prev); return prev; });
      },
    }),
  ).current;

  // Sigmoid decay: diminishing resistance like a real rubber band
  const decay = (value: number, max: number) => {
    'worklet';
    if (max === 0) return 0;
    const entry = value / max;
    const sigmoid = 2 * (1 / (1 + Math.exp(-entry * 3)) - 0.5);
    return sigmoid * max;
  };

  // Capsule: always visible, deforms from anchor edge like pulling taffy.
  const PILL_W = 72;
  const PILL_H = 40;
  const pillStyle = useAnimatedStyle(() => {
    const s = pillStretch.value; // -1..1
    const abs = Math.abs(s);
    // Sigmoid decay makes it resist more at extremes
    const visual = decay(abs, 1);
    // Stretch width: at rest 72px, at full pull ~250px
    const stretchW = PILL_W + visual * 180;
    // Squash height: compress vertically as it stretches
    const squashH = PILL_H * (1 - visual * 0.25);
    // Position: anchor near center, extend outward in drag direction
    // At rest: centered. Dragging right: left edge stays, right edge extends.
    const centerX = 0; // 0 = centered (via left:50% + marginLeft)
    const offsetX = s > 0
      ? (stretchW - PILL_W) / 2   // right: shift right so left edge holds
      : -(stretchW - PILL_W) / 2; // left: shift left so right edge holds
    return {
      width: stretchW,
      height: squashH,
      marginLeft: -stretchW / 2,
      marginTop: -(squashH - PILL_H) / 2,
      borderRadius: squashH / 2, // always fully rounded ends
      opacity: 0.22 + visual * 0.3,
      transform: [{ translateX: abs > 0.01 ? offsetX : centerX }],
    };
  });

  useEffect(() => stopTicking, [stopTicking]);

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
            className="relative mb-2 select-none"
            accessibilityRole="adjustable"
            accessibilityLabel={`${localWeight} pounds`}
          >
            <Animated.View
              style={[{
                position: 'absolute',
                left: '50%',
                top: 6,
                backgroundColor: t['brand-primary'],
              }, pillStyle]}
              pointerEvents="none"
            />
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
