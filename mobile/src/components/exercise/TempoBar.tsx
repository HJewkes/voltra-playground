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

const t = getSemanticColors('dark');

interface TempoBarProps {
  currentPhase: MovementPhase;
  phaseElapsedMs: number;
  repPhaseDurations: { phase: MovementPhase; durationMs: number }[];
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

export function TempoBar({ currentPhase, phaseElapsedMs, repPhaseDurations }: TempoBarProps) {
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
                <View className="h-full flex-row items-center justify-center" style={{ backgroundColor: alpha(config.color, 0.3) }}>
                  <Text className="text-xs font-bold" style={{ color: config.color }}>
                    {formatDuration(phaseElapsedMs)}
                  </Text>
                </View>
              ) : isCompleted ? (
                <View className="h-full flex-row items-center justify-center" style={{ backgroundColor: alpha(config.color, 0.15) }}>
                  <Text className="text-xs font-medium" style={{ color: alpha(config.color, 0.7) }}>
                    {formatDuration(completedMs!)}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatDuration(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? s.toFixed(1) : Math.round(s).toString();
}
