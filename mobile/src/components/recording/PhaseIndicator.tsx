/**
 * PhaseIndicator
 *
 * A pill badge showing the current movement phase (concentric/eccentric/hold/idle).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MovementPhase, PhaseNames } from '@/domain/workout';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface PhaseIndicatorProps {
  /** Current movement phase */
  phase: MovementPhase;
}

/**
 * Get color for a movement phase.
 */
export function getPhaseColor(phase: MovementPhase): string {
  switch (phase) {
    case MovementPhase.CONCENTRIC:
      return t['status-success'];
    case MovementPhase.HOLD:
      return t['status-warning'];
    case MovementPhase.ECCENTRIC:
      return t['status-info'];
    default:
      return t['border-strong'];
  }
}

/**
 * PhaseIndicator component - colored pill showing movement phase.
 *
 * @example
 * ```tsx
 * <PhaseIndicator phase={currentSample?.phase ?? MovementPhase.IDLE} />
 * ```
 */
export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  const color = getPhaseColor(phase);

  return (
    <View className="rounded-full px-5 py-2" style={{ backgroundColor: color }}>
      <Text className="text-sm font-bold text-white">{PhaseNames[phase]}</Text>
    </View>
  );
}
