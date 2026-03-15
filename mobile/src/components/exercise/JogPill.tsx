/**
 * JogPill — generic elastic jog-shuttle pill for numeric input.
 *
 * Drag to change value. Further from center = faster ticking.
 * Works vertically or horizontally. Elastic visual stretch with spring snap-back.
 *
 * Used for weight input (vertical) and rest time input (horizontal).
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
const MAX_EXTRA_PAD = 20;

function decay(value: number, max: number) {
  'worklet';
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry * 3)) - 0.5);
  return sigmoid * max;
}

function tickParams(d: number, stepSize: number): [number, number] {
  const stretch = Math.min(Math.abs(d), MAX_STRETCH);
  if (stretch <= DEAD_ZONE) return [0, MAX_INTERVAL];
  const ratio = (stretch - DEAD_ZONE) / (MAX_STRETCH - DEAD_ZONE);
  const step = Math.max(stepSize, Math.round(stepSize + ratio * stepSize * 3));
  const interval = MAX_INTERVAL - (MAX_INTERVAL - MIN_INTERVAL) * ratio;
  return [step, interval];
}

export interface JogPillProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  orientation?: 'vertical' | 'horizontal';
  formatValue?: (v: number) => string;
  label?: string;
  color?: string;
  disabled?: boolean;
  /** Pill dimensions */
  pillWidth?: number;
  pillHeight?: number;
  fontSize?: number;
}

export function JogPill({
  value,
  onChange,
  min,
  max,
  step = 1,
  orientation = 'vertical',
  formatValue = String,
  label,
  color = t['brand-primary'],
  disabled = false,
  pillWidth,
  pillHeight,
  fontSize = 16,
}: JogPillProps) {
  const isHorizontal = orientation === 'horizontal';
  const [localValue, setLocalValue] = useState(value);
  const displacement = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillStretch = useSharedValue(0);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => { setLocalValue(value); }, [value]);

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const stopTicking = useCallback(() => {
    if (tickTimer.current) { clearTimeout(tickTimer.current); tickTimer.current = null; }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    const schedule = () => {
      const [tickStep, interval] = tickParams(displacement.current, step);
      tickTimer.current = setTimeout(() => {
        if (tickStep > 0) {
          // For vertical: negative = up = increase. For horizontal: positive = right = increase.
          const direction = isHorizontal
            ? (displacement.current > 0 ? 1 : -1)
            : (displacement.current < 0 ? 1 : -1);
          setLocalValue((prev) => clamp(prev + direction * tickStep));
        }
        schedule();
      }, interval);
    };
    const [tickStep] = tickParams(displacement.current, step);
    if (tickStep > 0) {
      const direction = isHorizontal
        ? (displacement.current > 0 ? 1 : -1)
        : (displacement.current < 0 ? 1 : -1);
      setLocalValue((prev) => clamp(prev + direction * tickStep));
    }
    schedule();
  }, [stopTicking, step, isHorizontal, clamp]);

  const startTickingRef = useRef(startTicking);
  startTickingRef.current = startTicking;
  const stopTickingRef = useRef(stopTicking);
  stopTickingRef.current = stopTicking;

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, g) => {
        const d = isHorizontal ? Math.abs(g.dx) : Math.abs(g.dy);
        return !disabled && d > DEAD_ZONE;
      },
      onPanResponderGrant: () => {
        displacement.current = 0;
        pillStretch.value = 0;
      },
      onPanResponderMove: (_, g) => {
        const d = isHorizontal ? g.dx : g.dy;
        const wasActive = Math.abs(displacement.current) > DEAD_ZONE;
        displacement.current = d;
        const clamped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, d));
        pillStretch.value = clamped / MAX_STRETCH;
        if (!wasActive && Math.abs(d) > DEAD_ZONE) startTickingRef.current();
      },
      onPanResponderRelease: () => {
        displacement.current = 0;
        stopTickingRef.current();
        pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
        setLocalValue((prev) => { onChangeRef.current(prev); return prev; });
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [disabled, isHorizontal]);

  // Web pointer events
  const pillRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !pillRef.current) return;
    const el = (pillRef.current as unknown as HTMLElement);
    let startPos = 0;
    let active = false;

    const onDown = (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      startPos = isHorizontal ? e.clientX : e.clientY;
      active = true;
      displacement.current = 0;
      pillStretch.value = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!active || disabled) return;
      const d = isHorizontal ? e.clientX - startPos : e.clientY - startPos;
      const wasActive = Math.abs(displacement.current) > DEAD_ZONE;
      displacement.current = d;
      const clamped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, d));
      pillStretch.value = clamped / MAX_STRETCH;
      if (!wasActive && Math.abs(d) > DEAD_ZONE) startTickingRef.current();
    };

    const onUp = () => {
      active = false;
      displacement.current = 0;
      stopTickingRef.current();
      pillStretch.value = withSpring(0, { damping: 4, stiffness: 350, mass: 0.4 });
      setLocalValue((prev) => { onChangeRef.current(prev); return prev; });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (disabled) return;
      const delta = isHorizontal
        ? (e.deltaX > 0 ? 1 : e.deltaX < 0 ? -1 : e.deltaY > 0 ? -1 : 1)
        : (e.deltaY > 0 ? -1 : 1);
      setLocalValue((prev) => {
        const next = clamp(prev + delta * step);
        onChangeRef.current(next);
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
  }, [disabled, isHorizontal, pillStretch, step, clamp]);

  useEffect(() => stopTicking, [stopTicking]);

  const pillStyle = useAnimatedStyle(() => {
    const s = pillStretch.value;
    const abs = Math.abs(s);
    const visual = decay(abs, 1);
    const extra = visual * MAX_EXTRA_PAD;
    const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
    const baseRadius = 12 - visual * 3;
    const taperRadius = baseRadius + visual * 8;

    if (isHorizontal) {
      return {
        borderTopLeftRadius: s < 0 ? baseRadius : taperRadius,
        borderBottomLeftRadius: s < 0 ? baseRadius : taperRadius,
        borderTopRightRadius: s > 0 ? baseRadius : taperRadius,
        borderBottomRightRadius: s > 0 ? baseRadius : taperRadius,
        paddingLeft: 12 + (s < 0 ? extra : 0),
        paddingRight: 12 + (s > 0 ? extra : 0),
        paddingTop: 6,
        paddingBottom: 6,
        transform: [{ translateX: sign * extra / 2 }, { scaleY: 1 - visual * 0.08 }],
      };
    }
    return {
      borderTopLeftRadius: s < 0 ? baseRadius : taperRadius,
      borderTopRightRadius: s < 0 ? baseRadius : taperRadius,
      borderBottomLeftRadius: s > 0 ? baseRadius : taperRadius,
      borderBottomRightRadius: s > 0 ? baseRadius : taperRadius,
      paddingTop: 10 + (s < 0 ? extra : 0),
      paddingBottom: 10 + (s > 0 ? extra : 0),
      paddingLeft: 14,
      paddingRight: 14,
      transform: [{ translateY: sign * extra / 2 }, { scaleX: 1 - visual * 0.08 }],
    };
  });

  const cursor = isHorizontal ? 'ew-resize' : 'ns-resize';

  return (
    <View style={{ alignItems: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Animated.View
        ref={pillRef}
        {...panResponder.panHandlers}
        style={[{
          backgroundColor: alpha(color, 0.15),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: isHorizontal ? 'row' : 'column',
          minWidth: pillWidth ?? (isHorizontal ? 80 : 60),
          minHeight: pillHeight ?? (isHorizontal ? 28 : 48),
          ...Platform.select({
            web: webStyle({
              boxShadow: [
                `0 2px 4px ${alpha('#000', 0.3)}`,
                `inset 0 1px 0 ${alpha('#fff', 0.08)}`,
              ].join(', '),
              cursor: disabled ? 'default' : cursor,
              touchAction: 'none',
              userSelect: 'none',
            }),
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            },
          }),
        }, pillStyle]}
      >
        <Text
          style={{
            fontSize,
            fontWeight: '700',
            color,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatValue(localValue)}
        </Text>
      </Animated.View>
      {label && (
        <Text style={{
          marginTop: 3,
          fontSize: 9,
          fontWeight: '600',
          color: t['text-disabled'],
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {label}
        </Text>
      )}
    </View>
  );
}
