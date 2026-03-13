/**
 * RestScrubber — horizontal rest time dial that doubles as a progress bar.
 *
 * States:
 * - **Editing**: User scrubs left/right to set rest time in 15s increments (default 90s)
 * - **Resting**: Shows progress bar filling toward target, elapsed/target labels
 * - **Complete**: Fully filled, muted
 *
 * Sits between sets in the set list as a visual separator.
 */

import React, { useRef } from 'react';
import { View, Text, PanResponder, Platform } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

const MIN_REST_S = 15;
const MAX_REST_S = 300;
const STEP_S = 15;
const SCRUBBER_HEIGHT = 28;

type RestScrubberMode = 'editing' | 'resting' | 'complete';

interface RestScrubberProps {
  /** Rest time in seconds */
  restSeconds: number;
  /** Called when user scrubs to change rest time */
  onRestChange?: (seconds: number) => void;
  /** Current mode */
  mode: RestScrubberMode;
  /** Elapsed rest time in ms (only used in 'resting' mode) */
  elapsedMs?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export function RestScrubber({
  restSeconds,
  onRestChange,
  mode,
  elapsedMs = 0,
}: RestScrubberProps) {
  const startXRef = useRef(0);
  const startValueRef = useRef(restSeconds);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => mode === 'editing',
      onMoveShouldSetPanResponder: () => mode === 'editing',
      onPanResponderGrant: () => {
        startXRef.current = 0;
        startValueRef.current = restSeconds;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (!onRestChange) return;
        // Every 20px of horizontal drag = 1 step (15s)
        const steps = Math.round(gestureState.dx / 20);
        const newValue = Math.max(
          MIN_REST_S,
          Math.min(MAX_REST_S, startValueRef.current + steps * STEP_S),
        );
        if (newValue !== restSeconds) {
          onRestChange(newValue);
        }
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

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

  return (
    <View
      style={{
        height: SCRUBBER_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: 12,
      }}
      {...(mode === 'editing' ? panResponder.panHandlers : {})}
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
        {/* Fill */}
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

      {/* Label */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 10, color: labelColor, fontVariant: ['tabular-nums'] }}>
          {label}
        </Text>
      </View>

      {/* Scrub hint (editing mode only) */}
      {mode === 'editing' && (
        <View
          style={{
            position: 'absolute',
            right: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 8, color: t['text-disabled'] }}>
            {Platform.OS === 'web' ? '← drag →' : '◀ ▶'}
          </Text>
        </View>
      )}
    </View>
  );
}
