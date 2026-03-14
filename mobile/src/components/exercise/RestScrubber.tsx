/**
 * RestScrubber — horizontal rest time dial that doubles as a progress bar.
 *
 * States:
 * - **Editing**: User scrubs left/right to set rest time in 15s increments
 * - **Resting**: Shows progress bar filling toward target, elapsed/target labels
 * - **Complete**: Fully filled, muted
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, Platform } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

const MIN_REST_S = 15;
const MAX_REST_S = 300;
const STEP_S = 15;
const SCRUBBER_HEIGHT = 28;
const DRAG_PX_PER_STEP = 20;

type RestScrubberMode = 'editing' | 'resting' | 'complete';

interface RestScrubberProps {
  restSeconds: number;
  onRestChange?: (seconds: number) => void;
  mode: RestScrubberMode;
  elapsedMs?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RestScrubber({
  restSeconds,
  onRestChange,
  mode,
  elapsedMs = 0,
}: RestScrubberProps) {
  const startXRef = useRef(0);
  const startValueRef = useRef(restSeconds);
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback((e: { nativeEvent: { pageX: number } }) => {
    if (mode !== 'editing' || !onRestChange) return;
    draggingRef.current = true;
    startXRef.current = e.nativeEvent.pageX;
    startValueRef.current = restSeconds;
  }, [mode, onRestChange, restSeconds]);

  const handlePointerMove = useCallback((e: { nativeEvent: { pageX: number } }) => {
    if (!draggingRef.current || !onRestChange) return;
    const dx = e.nativeEvent.pageX - startXRef.current;
    const steps = Math.round(dx / DRAG_PX_PER_STEP);
    const newValue = Math.max(
      MIN_REST_S,
      Math.min(MAX_REST_S, startValueRef.current + steps * STEP_S),
    );
    onRestChange(newValue);
  }, [onRestChange]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const progress = mode === 'resting'
    ? Math.min(1, elapsedMs / (restSeconds * 1000))
    : mode === 'complete' ? 1 : 0;

  const trackColor = mode === 'resting'
    ? alpha(t['brand-primary'], 0.3)
    : mode === 'complete'
      ? alpha(t['text-disabled'], 0.15)
      : alpha('#fff', 0.06);

  const fillColor = mode === 'resting'
    ? t['brand-primary']
    : mode === 'complete'
      ? alpha(t['text-disabled'], 0.3)
      : 'transparent';

  const elapsedS = Math.round(elapsedMs / 1000);
  const label = mode === 'resting'
    ? `${formatTime(elapsedS)} / ${formatTime(restSeconds)}`
    : formatTime(restSeconds);

  const labelColor = mode === 'resting'
    ? t['text-secondary']
    : mode === 'complete'
      ? t['text-disabled']
      : t['text-tertiary'];

  const webPointerProps = Platform.OS === 'web' ? {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerUp,
    style: {
      cursor: mode === 'editing' ? 'ew-resize' as const : 'default' as const,
      userSelect: 'none' as const,
      touchAction: 'none' as const,
    },
  } : {};

  return (
    <View
      style={{
        height: SCRUBBER_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: 12,
      }}
      {...(webPointerProps as any)}
    >
      {/* Track */}
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}
      >
        {progress > 0 && (
          <View
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              borderRadius: 2,
              backgroundColor: fillColor,
            }}
          />
        )}
      </View>

      {/* Label pill */}
      <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
        <View style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          backgroundColor: mode === 'resting'
            ? alpha(t['brand-primary'], 0.25)
            : alpha('#000', 0.6),
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '600',
            color: mode === 'resting' ? t['brand-primary'] : t['text-secondary'],
            fontVariant: ['tabular-nums'],
          }}>
            {label}
          </Text>
        </View>
      </View>

      {/* Drag hint */}
      {mode === 'editing' && (
        <View style={{ position: 'absolute', right: 12 }}>
          <Text style={{ fontSize: 8, color: t['text-disabled'] }}>
            ← drag →
          </Text>
        </View>
      )}
    </View>
  );
}
