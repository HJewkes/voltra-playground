/**
 * RestScrubber — rest time between sets using a horizontal JogPill.
 *
 * States:
 * - **Editing**: Draggable pill showing rest time, drag left/right to adjust
 * - **Resting**: Progress bar with pill showing elapsed / target
 * - **Complete**: Muted pill showing final rest time
 */

import React from 'react';
import { View, Text } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { JogPill } from './JogPill';

const t = getSemanticColors('dark');

const MIN_REST_S = 15;
const MAX_REST_S = 300;
const STEP_S = 15;
const SCRUBBER_HEIGHT = 32;

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
  const progress = mode === 'resting'
    ? Math.min(1, elapsedMs / (restSeconds * 1000))
    : mode === 'complete' ? 1 : 0;

  const elapsedS = Math.round(elapsedMs / 1000);

  const trackColor = mode === 'resting'
    ? alpha(t['brand-primary'], 0.2)
    : alpha(t['text-disabled'], 0.08);

  const fillColor = mode === 'resting'
    ? t['brand-primary']
    : alpha(t['text-disabled'], 0.25);

  const label = mode === 'resting'
    ? `${formatTime(elapsedS)} / ${formatTime(restSeconds)}`
    : formatTime(restSeconds);

  return (
    <View style={{ height: SCRUBBER_HEIGHT, justifyContent: 'center', paddingHorizontal: 12 }}>
      {/* Track — always visible */}
      <View style={{ height: 3, borderRadius: 1.5, backgroundColor: trackColor, overflow: 'hidden' }}>
        {progress > 0 && (
          <View style={{
            height: '100%',
            width: `${progress * 100}%`,
            borderRadius: 1.5,
            backgroundColor: fillColor,
          }} />
        )}
      </View>

      {/* Pill overlay — draggable in editing mode, static label otherwise */}
      <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
        {mode === 'editing' ? (
          <JogPill
            value={restSeconds}
            onChange={onRestChange ?? (() => {})}
            min={MIN_REST_S}
            max={MAX_REST_S}
            step={STEP_S}
            orientation="horizontal"
            formatValue={formatTime}
            color={t['text-tertiary']}
            pillWidth={64}
            pillHeight={20}
            fontSize={11}
          />
        ) : (
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
        )}
      </View>
    </View>
  );
}
