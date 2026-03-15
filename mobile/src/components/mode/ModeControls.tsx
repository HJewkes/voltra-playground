import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, PanResponder, TouchableOpacity, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import Slider from '@react-native-community/slider';
import { Section, SectionContent, Surface, getSemanticColors, alpha } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';
import type { WebStyle } from '@/utils/web-style';
import { TrainingMode } from '@/domain/device';
import type { TempoTarget } from '@/domain/workout';
import { ScrollDial } from '@/components/exercise';
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

const DEAD_ZONE = 12;
const MAX_STRETCH = 120;
const MIN_INTERVAL = 30;
const MAX_INTERVAL = 250;
const MAX_EXTRA_PAD = 60;
const BASE_PAD_H = 32;
const BASE_PAD_V = 10;

// Sigmoid decay: diminishing resistance like a real rubber band
function decay(value: number, max: number) {
  'worklet';
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry * 3)) - 0.5);
  return sigmoid * max;
}

// Returns [step, interval] — both ramp with displacement
function tickParams(d: number): [number, number] {
  const stretch = Math.min(Math.abs(d), MAX_STRETCH);
  if (stretch <= DEAD_ZONE) return [0, MAX_INTERVAL];
  const t = (stretch - DEAD_ZONE) / (MAX_STRETCH - DEAD_ZONE);
  const step = Math.max(1, Math.round(1 + t * 4));
  const interval = MAX_INTERVAL - (MAX_INTERVAL - MIN_INTERVAL) * t;
  return [step, interval];
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
  // Elastic jog-shuttle: horizontal displacement controls tick step size.
  // Drag right = increase, left = decrease. Further = bigger steps. Release to stop.
  const displacement = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pillStretch = useSharedValue(0); // -1..1 normalized displacement

  const stopTicking = useCallback(() => {
    if (tickTimer.current) { clearTimeout(tickTimer.current); tickTimer.current = null; }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    const schedule = () => {
      const [step, interval] = tickParams(displacement.current);
      tickTimer.current = setTimeout(() => {
        if (step > 0) {
          const direction = displacement.current > 0 ? 1 : -1;
          setLocalWeight((prev) => clampWeight(prev + direction * step));
        }
        schedule();
      }, interval);
    };
    const [step] = tickParams(displacement.current);
    if (step > 0) {
      const direction = displacement.current > 0 ? 1 : -1;
      setLocalWeight((prev) => clampWeight(prev + direction * step));
    }
    schedule();
  }, [stopTicking]);

  // Refs so PanResponder closure always sees current functions
  const startTickingRef = useRef(startTicking);
  startTickingRef.current = startTicking;
  const stopTickingRef = useRef(stopTicking);
  stopTickingRef.current = stopTicking;
  const setWeightRef = useRef(setWeight);
  setWeightRef.current = setWeight;

  const panResponder = useMemo(() =>
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
        if (!wasActive && Math.abs(g.dx) > DEAD_ZONE) startTickingRef.current();
      },
      onPanResponderRelease: () => {
        displacement.current = 0;
        stopTickingRef.current();
        pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
        setLocalWeight((prev) => { setWeightRef.current(prev); return prev; });
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  // Pill grows via padding in the drag direction — no scaleX, no counter-scale.
  // Parent centers the pill, so translateX compensates by half the extra padding
  // to keep the opposite edge pinned.
  const pillStyle = useAnimatedStyle(() => {
    const s = pillStretch.value; // -1..1
    const abs = Math.abs(s);
    const visual = decay(abs, 1);
    const extra = visual * MAX_EXTRA_PAD;
    const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
    const baseRadius = 28 - visual * 8;
    // Stretched side gets taller radius (visually tapers thinner)
    const taperRadius = baseRadius + visual * 20;
    return {
      borderTopLeftRadius: s < 0 ? baseRadius : taperRadius,
      borderBottomLeftRadius: s < 0 ? baseRadius : taperRadius,
      borderTopRightRadius: s > 0 ? baseRadius : taperRadius,
      borderBottomRightRadius: s > 0 ? baseRadius : taperRadius,
      paddingLeft: BASE_PAD_H + (s < 0 ? extra : 0),
      paddingRight: BASE_PAD_H + (s > 0 ? extra : 0),
      paddingTop: BASE_PAD_V,
      paddingBottom: BASE_PAD_V,
      transform: [{ translateX: sign * extra / 2 }, { scaleY: 1 - visual * 0.15 }],
    };
  });

  useEffect(() => stopTicking, [stopTicking]);

  const wheelHandler = useRef<(e: WheelEvent) => void>(undefined);
  const weightCallbackRef = useCallback((node: unknown) => {
    const el = node as HTMLElement | null;
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
          <Text className="mb-1 text-center text-[10px] font-medium text-text-tertiary">{label}</Text>
          <View className="mb-2 items-center select-none">
            <Animated.View
              ref={weightCallbackRef}
              {...panResponder.panHandlers}
              style={[{
                backgroundColor: alpha(t['brand-primary'], 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                ...Platform.select({
                  web: webStyle({
                    boxShadow: [
                      `0 4px 8px ${alpha('#000', 0.3)}`,
                      `0 1px 3px ${alpha('#000', 0.2)}`,
                    ].join(', '),
                    borderTop: `1px solid ${alpha('#fff', 0.1)}`,
                    borderBottom: `1px solid ${alpha('#000', 0.2)}`,
                  }),
                  default: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  },
                }),
              }, pillStyle]}
              accessibilityRole="adjustable"
              accessibilityLabel={`${localWeight} pounds`}
            >
              <Text
                className="text-center text-2xl font-bold"
                style={{
                  color: t['brand-primary'],
                  ...Platform.select({
                    web: webStyle({
                      textShadow: `0 -1px 0 ${alpha('#000', 0.5)}, 0 1px 0 ${alpha('#fff', 0.12)}`,
                    }),
                    default: {
                      textShadowColor: alpha('#000', 0.4),
                      textShadowOffset: { width: 0, height: -1 },
                      textShadowRadius: 1,
                    },
                  }),
                }}
              >
                {localWeight}
                <Text className="text-sm text-text-tertiary"> lbs</Text>
              </Text>
            </Animated.View>
          </View>

          {(showEccentric || showChains) && (
            <AdvancedAccordion
              showEccentric={showEccentric}
              showChains={showChains}
              eccentric={eccentric}
              setEccentric={setEccentric}
              chains={chains}
              inverseChains={inverseChains}
              setChains={setChains}
              setInverseChains={setInverseChains}
            />
          )}
        </Surface>
      </SectionContent>
    </Section>
  );
}

export function AdvancedAccordion({
  showEccentric, showChains,
  eccentric, setEccentric,
  chains, inverseChains, setChains, setInverseChains,
  tempoEnabled, targetTempo, onToggleTempo, onTempoChange,
}: {
  showEccentric: boolean; showChains: boolean;
  eccentric: number; setEccentric: (v: number) => Promise<void>;
  chains: number; inverseChains: number;
  setChains: (v: number) => Promise<void>;
  setInverseChains: (v: number) => Promise<void>;
  tempoEnabled?: boolean;
  targetTempo?: TempoTarget;
  onToggleTempo?: () => void;
  onTempoChange?: (key: keyof TempoTarget, value: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const hasTempo = onTempoChange != null;

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      rotation.value = withTiming(prev ? 0 : 1, { duration: 200 });
      return !prev;
    });
  }, [rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const hardwareControls = (
    <View style={{ flex: hasTempo ? 1 : undefined }}>
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
    </View>
  );

  return (
    <View className="mt-1">
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        className="flex-row items-center justify-center py-1"
      >
        <Text className="mr-1 text-[11px] font-medium text-text-disabled">Advanced</Text>
        <Animated.Text style={[{ fontSize: 10, color: t['text-disabled'] }, chevronStyle]}>
          ▼
        </Animated.Text>
      </TouchableOpacity>
      {expanded && (
        hasTempo ? (
          <View className="flex-row" style={{ gap: 8 }}>
            {hardwareControls}
            <TempoColumn
              enabled={tempoEnabled ?? false}
              tempo={targetTempo ?? { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 }}
              onToggle={onToggleTempo}
              onChange={onTempoChange}
            />
          </View>
        ) : (
          hardwareControls
        )
      )}
    </View>
  );
}

function TempoColumn({
  enabled, tempo, onToggle, onChange,
}: {
  enabled: boolean;
  tempo: TempoTarget;
  onToggle?: () => void;
  onChange?: (key: keyof TempoTarget, value: number) => void;
}) {
  const disabledColor = t['text-disabled'];

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {onToggle && (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 10,
            backgroundColor: enabled ? alpha(t['brand-primary'], 0.15) : '#1a1a1a',
            ...Platform.select({
              web: webStyle({
                boxShadow: enabled
                  ? [
                      `0 1px 2px ${alpha('#000', 0.4)}`,
                      `inset 0 1px 0 ${alpha(t['brand-primary'], 0.15)}`,
                    ].join(', ')
                  : [
                      `inset 0 1px 3px ${alpha('#000', 0.4)}`,
                      `0 1px 0 ${alpha('#fff', 0.04)}`,
                    ].join(', '),
              }),
              default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: enabled ? 1 : 0 },
                shadowOpacity: enabled ? 0.3 : 0,
                shadowRadius: enabled ? 2 : 0,
              },
            }),
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: enabled ? '700' : '500',
              color: enabled ? t['brand-primary'] : disabledColor,
              ...Platform.select({
                web: enabled ? webStyle({
                  textShadow: `0 0 8px ${alpha(t['brand-primary'], 0.4)}`,
                }) : webStyle({}),
                default: {},
              }),
            }}
          >
            Tempo
          </Text>
        </TouchableOpacity>
      )}
      <View className="mt-1.5 flex-row" style={{ gap: 4 }}>
        <ScrollDial
          value={tempo.concentric}
          min={0}
          max={10}
          onChange={(v: number) => onChange?.('concentric', v)}
          label="Con"
          width={32}
          formatValue={dashZero}
          activeColor={enabled && tempo.concentric > 0 ? t['status-success'] : disabledColor}
          disabled={!enabled}
        />
        <ScrollDial
          value={tempo.pauseTop}
          min={0}
          max={5}
          onChange={(v: number) => onChange?.('pauseTop', v)}
          label="Hold"
          width={32}
          formatValue={dashZero}
          activeColor={enabled && tempo.pauseTop > 0 ? t['brand-primary'] : disabledColor}
          disabled={!enabled}
        />
        <ScrollDial
          value={tempo.eccentric}
          min={0}
          max={10}
          onChange={(v: number) => onChange?.('eccentric', v)}
          label="Ecc"
          width={32}
          formatValue={dashZero}
          activeColor={enabled && tempo.eccentric > 0 ? t['status-warning'] : disabledColor}
          disabled={!enabled}
        />
        <ScrollDial
          value={tempo.pauseBottom}
          min={0}
          max={5}
          onChange={(v: number) => onChange?.('pauseBottom', v)}
          label="Pause"
          width={32}
          formatValue={dashZero}
          activeColor={enabled && tempo.pauseBottom > 0 ? t['text-secondary'] : disabledColor}
          disabled={!enabled}
        />
      </View>
    </View>
  );
}

function dashZero(v: number): string {
  return v === 0 ? '\u2013' : String(v);
}

// Slider with a colored track that originates from the center rather than the left edge.
// Both native tracks are neutral; an overlay bar shows the active range from center to thumb.
function CenterSlider({ value, min, max, step, color, onValueChange, onSlidingComplete }: {
  value: number; min: number; max: number; step: number;
  color: string;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
}) {
  const center = (min + max) / 2;
  const thumbPct = ((value - min) / (max - min)) * 100;
  const centerPct = ((center - min) / (max - min)) * 100;
  const barLeft = Math.min(thumbPct, centerPct);
  const barWidth = Math.abs(thumbPct - centerPct);
  const isNeutral = value === center;

  return (
    <View style={{ position: 'relative', justifyContent: 'center', height: 40 }}>
      {/* Neumorphic inset track */}
      <View style={{
        position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3,
        backgroundColor: '#1a1a1a',
        ...Platform.select({
          web: webStyle({
            boxShadow: `inset 1px 2px 3px ${alpha('#000', 0.4)}, inset -1px -1px 2px ${alpha('#fff', 0.04)}`,
          }),
          default: {},
        }),
      }} />
      {/* Active bar from center to thumb */}
      {!isNeutral && (
        <View style={{
          position: 'absolute', left: `${barLeft}%`, width: `${barWidth}%`,
          height: 6, borderRadius: 3, backgroundColor: color,
          ...Platform.select({
            web: webStyle({
              boxShadow: `0 0 4px ${alpha(color, 0.4)}, inset 0 1px 0 ${alpha('#fff', 0.15)}`,
            }),
            default: {},
          }),
        }} />
      )}
      <Slider
        value={value}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={isNeutral ? '#3a3a3a' : color}
        {...Platform.select({
          web: { style: { filter: 'drop-shadow(0 2px 3px ' + alpha('#000', 0.4) + ')' } } as WebStyle,
          default: {},
        })}
      />
    </View>
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
    <View className="mt-1">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-text-tertiary">Eccentric</Text>
        <Text className="text-xs font-semibold" style={{ color }}>{eccLabel}</Text>
      </View>
      <CenterSlider
        value={slider}
        min={0}
        max={390}
        step={5}
        color={display > 0 ? t['brand-primary'] : t['status-error']}
        onValueChange={(v: number) => { sliding.current = true; setSlider(Math.round(v)); }}
        onSlidingComplete={(v: number) => { sliding.current = false; const r = Math.round(v); setSlider(r); onChange(r - ECC_OFFSET); }}
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
    <View className="mt-1">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-text-tertiary">Chains</Text>
        <Text className="text-xs font-semibold" style={{ color }}>{chainLabel}</Text>
      </View>
      <CenterSlider
        value={slider}
        min={0}
        max={200}
        step={1}
        color={display > 0 ? t['brand-primary'] : t['status-error']}
        onValueChange={(v: number) => { sliding.current = true; setSlider(Math.round(v)); }}
        onSlidingComplete={commit}
      />
    </View>
  );
}
