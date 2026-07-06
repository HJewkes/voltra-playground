/**
 * ScrollDial — a vertical scroll wheel for numeric input.
 *
 * Combination-lock style: drag up/down to change value, snaps to integers.
 * Neumorphic drum appearance — inset channel with a raised center slot,
 * top and bottom edges fade into shadow to suggest a curved drum surface.
 *
 * Tap top half to increment, bottom half to decrement.
 * Drag down = value goes up (pulling the drum surface downward).
 * Mouse wheel scrolls value with debounce.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, PanResponder, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

const t = getSemanticColors('dark');

const ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 3;
const DIAL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const SPRING_CONFIG = { damping: 18, stiffness: 280, mass: 0.5 };

/** Pixels of drag per step (higher = slower/more deliberate) */
const DRAG_PER_STEP = 28;

/** Minimum ms between wheel ticks */
const WHEEL_DEBOUNCE_MS = 180;

/** Max pixels moved to still count as a tap */
const TAP_THRESHOLD = 4;

interface ScrollDialProps {
  /** Current value */
  value: number;
  /** Minimum value (inclusive) */
  min: number;
  /** Maximum value (inclusive) */
  max: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Optional label shown below the dial */
  label?: string;
  /** Width of the dial column */
  width?: number;
  /** Format the display value (e.g. to show "–" for 0) */
  formatValue?: (v: number) => string;
  /** Color for the active (center) value */
  activeColor?: string;
  /** Disable interaction (grayed out) */
  disabled?: boolean;
}

export function ScrollDial({
  value,
  min,
  max,
  onChange,
  label,
  width = 40,
  formatValue,
  activeColor = t['text-primary'],
  disabled = false,
}: ScrollDialProps) {
  const offsetY = useSharedValue(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const nudge = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = clamp(valueRef.current + delta);
      if (next !== valueRef.current) {
        onChangeRef.current(next);
        offsetY.value = -delta * ITEM_HEIGHT * 0.3;
        offsetY.value = withSpring(0, SPRING_CONFIG);
      }
    },
    [clamp, offsetY, disabled]
  );

  // ── Drag state ──
  const dragState = useRef({ startY: 0, cumulative: 0, active: false, moved: false });

  const applyDrag = useCallback(
    (dy: number) => {
      if (disabled) return;
      offsetY.value = dy * 0.5;

      const steps = Math.round(dy / DRAG_PER_STEP);
      const prev = dragState.current.cumulative;
      if (steps !== prev) {
        const delta = steps - prev;
        const newVal = clamp(valueRef.current + delta);
        if (newVal !== valueRef.current) onChangeRef.current(newVal);
        dragState.current.cumulative = steps;
        offsetY.value = (dy - steps * DRAG_PER_STEP) * 0.5;
      }
    },
    [clamp, offsetY, disabled]
  );

  // Native PanResponder (non-web)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Platform.OS !== 'web' && !disabled,
        onMoveShouldSetPanResponder: (_, g) =>
          Platform.OS !== 'web' && !disabled && Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          dragState.current = { startY: 0, cumulative: 0, active: true, moved: false };
          offsetY.value = 0;
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dy) > TAP_THRESHOLD) dragState.current.moved = true;
          applyDrag(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (!dragState.current.moved) {
            // Tap: top half = increment, bottom half = decrement
            const localY = g.y0;
            nudge(localY < DIAL_HEIGHT / 2 ? 1 : -1);
          }
          dragState.current.active = false;
          offsetY.value = withSpring(0, SPRING_CONFIG);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyDrag, nudge, disabled]
  );

  // Web: pointer-based drag + tap detection + wheel
  const drumRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !drumRef.current) return;
    const el = drumRef.current as unknown as HTMLElement;

    let moved = false;

    const onDown = (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      moved = false;
      dragState.current = { startY: e.clientY, cumulative: 0, active: true, moved: false };
      offsetY.value = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!dragState.current.active || disabled) return;
      const dy = e.clientY - dragState.current.startY;
      if (Math.abs(dy) > TAP_THRESHOLD) moved = true;
      applyDrag(dy);
    };

    const onUp = (e: PointerEvent) => {
      if (disabled) return;
      if (!moved) {
        // Tap: determine zone from click position relative to element
        const rect = el.getBoundingClientRect();
        const localY = e.clientY - rect.top;
        nudge(localY < DIAL_HEIGHT / 2 ? 1 : -1);
      }
      dragState.current.active = false;
      offsetY.value = withSpring(0, SPRING_CONFIG);
    };

    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (disabled) return;
      const now = Date.now();
      if (now - lastWheel < WHEEL_DEBOUNCE_MS) return;
      lastWheel = now;

      const direction = e.deltaY > 0 ? -1 : 1;
      const next = clamp(valueRef.current + direction);
      if (next !== valueRef.current) {
        onChangeRef.current(next);
        offsetY.value = direction * ITEM_HEIGHT * 0.25;
        offsetY.value = withSpring(0, SPRING_CONFIG);
      }
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
  }, [min, max, offsetY, clamp, applyDrag, nudge, disabled]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
  }));

  const fmt = formatValue ?? String;
  const prev2 = disabled ? '' : value + 2 <= max ? fmt(value + 2) : '';
  const prev = disabled ? '' : value + 1 <= max ? fmt(value + 1) : '';
  const current = disabled ? '–' : fmt(value);
  const next = disabled ? '' : value - 1 >= min ? fmt(value - 1) : '';
  const next2 = disabled ? '' : value - 2 >= min ? fmt(value - 2) : '';

  const disabledOpacity = disabled ? 0.35 : 1;

  return (
    <View style={{ width, alignItems: 'center', opacity: disabledOpacity }}>
      {/* Outer drum — inset neumorphic channel */}
      <View
        ref={drumRef}
        style={{
          height: DIAL_HEIGHT,
          width,
          overflow: 'hidden',
          borderRadius: 12,
          backgroundColor: '#0d0d0d',
          ...Platform.select({
            web: webStyle({
              boxShadow: [
                `inset 0 6px 10px ${alpha('#000', 0.5)}`,
                `inset 0 -6px 10px ${alpha('#000', 0.5)}`,
                `inset 0 2px 4px ${alpha('#000', 0.4)}`,
                `0 1px 0 ${alpha('#fff', 0.03)}`,
              ].join(', '),
              cursor: disabled ? 'default' : 'ns-resize',
              touchAction: 'none',
              userSelect: 'none',
            }),
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 4,
            },
          }),
        }}
        {...panResponder.panHandlers}
      >
        {/* Scrolling strip — offset so current value sits in center slot */}
        <Animated.View
          style={[
            { alignItems: 'center', justifyContent: 'center', marginTop: -ITEM_HEIGHT },
            stripStyle,
          ]}
        >
          <DialSlot text={prev2} height={ITEM_HEIGHT} opacity={0.08} />
          <DialSlot text={prev} height={ITEM_HEIGHT} opacity={0.25} />

          {/* Center = current value — raised slot */}
          <View
            style={{
              height: ITEM_HEIGHT,
              width: width - 4,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: alpha('#fff', 0.1),
              ...Platform.select({
                web: webStyle({
                  boxShadow: [
                    `0 2px 4px ${alpha('#000', 0.5)}`,
                    `0 -1px 2px ${alpha('#000', 0.4)}`,
                    `inset 0 1px 0 ${alpha('#fff', 0.12)}`,
                    `inset 0 -1px 0 ${alpha('#000', 0.2)}`,
                  ].join(', '),
                }),
                default: {},
              }),
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '800',
                color: activeColor,
                textAlign: 'center',
                ...Platform.select({
                  web: webStyle({
                    textShadow: `0 1px 2px ${alpha('#000', 0.5)}`,
                  }),
                  default: {
                    textShadowColor: alpha('#000', 0.4),
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  },
                }),
              }}
            >
              {current}
            </Text>
          </View>

          <DialSlot text={next} height={ITEM_HEIGHT} opacity={0.25} />
          <DialSlot text={next2} height={ITEM_HEIGHT} opacity={0.08} />
        </Animated.View>

        {/* Top fade overlay */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: ITEM_HEIGHT,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            ...Platform.select({
              web: webStyle({
                background: `linear-gradient(to bottom, ${alpha('#0d0d0d', 0.85)} 0%, transparent 100%)`,
              }),
              default: {},
            }),
          }}
        />

        {/* Bottom fade overlay */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: ITEM_HEIGHT,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            ...Platform.select({
              web: webStyle({
                background: `linear-gradient(to top, ${alpha('#0d0d0d', 0.85)} 0%, transparent 100%)`,
              }),
              default: {},
            }),
          }}
        />

        {/* Subtle horizontal grooves */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: ITEM_HEIGHT - 0.5,
            left: 4,
            right: 4,
            height: 1,
            backgroundColor: alpha('#fff', 0.03),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: ITEM_HEIGHT - 0.5,
            left: 4,
            right: 4,
            height: 1,
            backgroundColor: alpha('#fff', 0.03),
          }}
        />
      </View>

      {label && (
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
          {label}
        </Text>
      )}
    </View>
  );
}

function DialSlot({ text, height, opacity }: { text: string; height: number; opacity: number }) {
  return (
    <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: alpha(t['text-disabled'], opacity),
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
