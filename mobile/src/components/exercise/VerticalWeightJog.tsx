/**
 * VerticalWeightJog — vertical elastic jog-shuttle for weight input.
 *
 * Same mechanics as the horizontal weight pill in ModeControls but oriented
 * vertically to sit inline with ScrollDials. Drag up to increase, down to
 * decrease. Further from center = faster ticking.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

const t = getSemanticColors('dark');

const DEAD_ZONE = 8;
const MAX_STRETCH = 80;
const MIN_INTERVAL = 30;
const MAX_INTERVAL = 250;
const MAX_EXTRA_PAD = 28;
const BASE_PAD_V = 14;
const BASE_PAD_H = 18;

const WEIGHT_MIN = 5;
const WEIGHT_MAX = 200;
const clampWeight = (v: number) => Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, v));

function decay(value: number, max: number) {
  'worklet';
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry * 3)) - 0.5);
  return sigmoid * max;
}

function tickParams(d: number): [number, number] {
  const stretch = Math.min(Math.abs(d), MAX_STRETCH);
  if (stretch <= DEAD_ZONE) return [0, MAX_INTERVAL];
  const ratio = (stretch - DEAD_ZONE) / (MAX_STRETCH - DEAD_ZONE);
  const step = Math.max(1, Math.round(1 + ratio * 4));
  const interval = MAX_INTERVAL - (MAX_INTERVAL - MIN_INTERVAL) * ratio;
  return [step, interval];
}

interface VerticalWeightJogProps {
  weight: number;
  onWeightChange: (w: number) => void;
  disabled?: boolean;
}

export function VerticalWeightJog({ weight, onWeightChange, disabled = false }: VerticalWeightJogProps) {
  const [localWeight, setLocalWeight] = useState(weight);
  const displacement = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillStretch = useSharedValue(0);

  const onWeightChangeRef = useRef(onWeightChange);
  onWeightChangeRef.current = onWeightChange;

  // Sync external weight changes
  useEffect(() => { setLocalWeight(weight); }, [weight]);

  const stopTicking = useCallback(() => {
    if (tickTimer.current) { clearTimeout(tickTimer.current); tickTimer.current = null; }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    const schedule = () => {
      const [step, interval] = tickParams(displacement.current);
      tickTimer.current = setTimeout(() => {
        if (step > 0) {
          // Negative dy (drag up) = increase weight
          const direction = displacement.current < 0 ? 1 : -1;
          setLocalWeight((prev) => clampWeight(prev + direction * step));
        }
        schedule();
      }, interval);
    };
    const [step] = tickParams(displacement.current);
    if (step > 0) {
      const direction = displacement.current < 0 ? 1 : -1;
      setLocalWeight((prev) => clampWeight(prev + direction * step));
    }
    schedule();
  }, [stopTicking]);

  const startTickingRef = useRef(startTicking);
  startTickingRef.current = startTicking;
  const stopTickingRef = useRef(stopTicking);
  stopTickingRef.current = stopTicking;

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dy) > DEAD_ZONE,
      onPanResponderGrant: () => {
        displacement.current = 0;
        pillStretch.value = 0;
      },
      onPanResponderMove: (_, g) => {
        const wasActive = Math.abs(displacement.current) > DEAD_ZONE;
        displacement.current = g.dy;
        const clamped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, g.dy));
        pillStretch.value = clamped / MAX_STRETCH;
        if (!wasActive && Math.abs(g.dy) > DEAD_ZONE) startTickingRef.current();
      },
      onPanResponderRelease: () => {
        displacement.current = 0;
        stopTickingRef.current();
        pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
        setLocalWeight((prev) => { onWeightChangeRef.current(prev); return prev; });
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [disabled]);

  // Web: pointer events for drag + wheel
  const pillRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !pillRef.current) return;
    const el = (pillRef.current as unknown as HTMLElement);
    let startY = 0;
    let active = false;

    const onDown = (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      startY = e.clientY;
      active = true;
      displacement.current = 0;
      pillStretch.value = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!active || disabled) return;
      const dy = e.clientY - startY;
      const wasActive = Math.abs(displacement.current) > DEAD_ZONE;
      displacement.current = dy;
      const clamped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, dy));
      pillStretch.value = clamped / MAX_STRETCH;
      if (!wasActive && Math.abs(dy) > DEAD_ZONE) startTickingRef.current();
    };

    const onUp = () => {
      active = false;
      displacement.current = 0;
      stopTickingRef.current();
      pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
      setLocalWeight((prev) => { onWeightChangeRef.current(prev); return prev; });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (disabled) return;
      const delta = e.deltaY > 0 ? -1 : 1;
      const step = e.shiftKey ? 10 : e.ctrlKey ? 5 : 1;
      setLocalWeight((prev) => {
        const next = clampWeight(prev + delta * step);
        onWeightChangeRef.current(next);
        return next;
      });
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [disabled, pillStretch]);

  useEffect(() => stopTicking, [stopTicking]);

  const pillStyle = useAnimatedStyle(() => {
    const s = pillStretch.value; // -1..1
    const abs = Math.abs(s);
    const visual = decay(abs, 1);
    const extra = visual * MAX_EXTRA_PAD;
    const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
    const baseRadius = 16 - visual * 4;
    const taperRadius = baseRadius + visual * 10;
    return {
      borderTopLeftRadius: s < 0 ? baseRadius : taperRadius,
      borderTopRightRadius: s < 0 ? baseRadius : taperRadius,
      borderBottomLeftRadius: s > 0 ? baseRadius : taperRadius,
      borderBottomRightRadius: s > 0 ? baseRadius : taperRadius,
      paddingTop: BASE_PAD_V + (s < 0 ? extra : 0),
      paddingBottom: BASE_PAD_V + (s > 0 ? extra : 0),
      paddingLeft: BASE_PAD_H,
      paddingRight: BASE_PAD_H,
      transform: [{ translateY: sign * extra / 2 }, { scaleX: 1 - visual * 0.1 }],
    };
  });

  const disabledOpacity = disabled ? 0.35 : 1;

  // Match ScrollDial layout: 96px drum height, then 4px gap + 9px label
  const DRUM_HEIGHT = 96;

  return (
    <View style={{ alignItems: 'center', opacity: disabledOpacity }}>
      {/* Container matching the drum height so the pill centers with adjacent dials */}
      <View style={{ height: DRUM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View
          ref={pillRef}
          {...panResponder.panHandlers}
          style={[{
            backgroundColor: alpha(t['brand-primary'], 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 72,
            minHeight: 60,
            ...Platform.select({
              web: webStyle({
                boxShadow: [
                  `0 3px 6px ${alpha('#000', 0.3)}`,
                  `0 1px 2px ${alpha('#000', 0.2)}`,
                  `inset 0 1px 0 ${alpha('#fff', 0.08)}`,
                ].join(', '),
                cursor: disabled ? 'default' : 'ns-resize',
                touchAction: 'none',
                userSelect: 'none',
              }),
              default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4,
              },
            }),
          }, pillStyle]}
        >
          <Text
            style={{
              fontSize: 30,
              fontWeight: '800',
              color: t['brand-primary'],
              textAlign: 'center',
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
          </Text>
        </Animated.View>
      </View>
      {/* Label aligned with ScrollDial labels (same marginTop, fontSize, style) */}
      <Text
        style={{
          marginTop: 4,
          fontSize: 9,
          fontWeight: '600',
          color: t['text-disabled'],
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        lbs
      </Text>
    </View>
  );
}
