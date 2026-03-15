/**
 * TempoBar — live rep phase progression indicator.
 *
 * Shows a segmented bar (CON → HOLD → ECC) with the active segment
 * filling in real time. Completed phases show their duration in seconds.
 * When idle, displays a muted placeholder bar.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { MovementPhase } from '@voltras/workout-analytics';

import { type TempoTarget } from '@/domain/workout';

const t = getSemanticColors('dark');

export const TEMPO_PACING = {
  behindThresholdPct: 0.15,
  aheadThresholdPct: 0.20,
  minPhaseDurationMs: 500,
  colorTransitionMs: 300,
};

const TARGET_MAP: Record<number, keyof TempoTarget> = {
  [MovementPhase.CONCENTRIC]: 'concentric',
  [MovementPhase.HOLD]: 'pauseTop',
  [MovementPhase.ECCENTRIC]: 'eccentric',
};

export type PacingState = 'none' | 'on-pace' | 'behind';

export function getPacingState(elapsedMs: number, targetMs: number | null): PacingState {
  if (!targetMs || targetMs < TEMPO_PACING.minPhaseDurationMs) return 'none';
  const ratio = elapsedMs / targetMs;
  if (ratio > 1 + TEMPO_PACING.behindThresholdPct) return 'behind';
  return 'on-pace';
}

export function getFillPct(elapsedMs: number, targetMs: number | null): number {
  if (!targetMs) return 100;
  return Math.min(100, (elapsedMs / targetMs) * 100);
}

interface TempoBarProps {
  currentPhase: MovementPhase;
  phaseElapsedMs: number;
  repPhaseDurations: { phase: MovementPhase; durationMs: number }[];
  targetTempo?: TempoTarget;
}

const PHASE_ORDER = [
  MovementPhase.CONCENTRIC,
  MovementPhase.HOLD,
  MovementPhase.ECCENTRIC,
] as const;

const PHASE_CONFIG: Record<number, { label: string; color: string; flex: number }> = {
  [MovementPhase.CONCENTRIC]: { label: 'Con', color: t['status-success'], flex: 2 },
  [MovementPhase.HOLD]: { label: 'Hold', color: t['brand-primary'], flex: 1 },
  [MovementPhase.ECCENTRIC]: { label: 'Ecc', color: t['status-warning'], flex: 3 },
};

export function TempoBar({ currentPhase, phaseElapsedMs, repPhaseDurations, targetTempo }: TempoBarProps) {
  const isIdle = currentPhase === MovementPhase.IDLE;
  const completedPhases = new Map(repPhaseDurations.map((d) => [d.phase, d.durationMs]));

  return (
    <View>
      {/* Phase labels */}
      <View className="mb-1 flex-row">
        {PHASE_ORDER.map((phase) => {
          const config = PHASE_CONFIG[phase];
          return (
            <View key={phase} style={{ flex: config.flex }} className="items-center">
              <Text className="text-[10px] text-text-disabled">{config.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Segmented bar */}
      <View className="flex-row gap-0.5" style={{ height: 20 }}>
        {PHASE_ORDER.map((phase) => {
          const config = PHASE_CONFIG[phase];
          const isActive = currentPhase === phase;
          const isCompleted = completedPhases.has(phase);
          const completedMs = completedPhases.get(phase);
          const targetKey = TARGET_MAP[phase];
          const targetMs = targetTempo && targetKey ? targetTempo[targetKey] * 1000 : null;

          return (
            <View
              key={phase}
              style={{
                flex: config.flex,
                backgroundColor: alpha('#fff', 0.06),
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              {isActive && !isIdle ? (
                <ActiveSegment
                  config={config}
                  phaseElapsedMs={phaseElapsedMs}
                  targetMs={targetMs}
                />
              ) : isCompleted ? (
                <CompletedSegment
                  config={config}
                  completedMs={completedMs!}
                  targetMs={targetMs}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ActiveSegment({
  config,
  phaseElapsedMs,
  targetMs,
}: {
  config: { color: string };
  phaseElapsedMs: number;
  targetMs: number | null;
}) {
  const pacing = getPacingState(phaseElapsedMs, targetMs);
  const barColor = pacing === 'behind' ? t['status-error'] : config.color;
  const fillPct = getFillPct(phaseElapsedMs, targetMs);

  const label = targetMs
    ? `${formatDuration(phaseElapsedMs)} / ${formatDuration(targetMs)}`
    : formatDuration(phaseElapsedMs);

  return (
    <View className="h-full" style={{ position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${fillPct}%`,
          backgroundColor: alpha(barColor, 0.3),
          borderRadius: 4,
        }}
      />
      <View className="h-full flex-row items-center justify-center">
        <Text className="text-xs font-bold" style={{ color: barColor }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function CompletedSegment({
  config,
  completedMs,
  targetMs,
}: {
  config: { color: string };
  completedMs: number;
  targetMs: number | null;
}) {
  const pacing = getPacingState(completedMs, targetMs);
  const hitTarget = pacing !== 'behind';
  const indicator = targetMs && targetMs >= TEMPO_PACING.minPhaseDurationMs
    ? (hitTarget ? ' \u2713' : ' \u2717')
    : '';

  return (
    <View
      className="h-full flex-row items-center justify-center"
      style={{ backgroundColor: alpha(config.color, 0.15) }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: alpha(config.color, 0.7) }}
      >
        {formatDuration(completedMs)}{indicator}
      </Text>
    </View>
  );
}

function formatDuration(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? s.toFixed(1) : Math.round(s).toString();
}
