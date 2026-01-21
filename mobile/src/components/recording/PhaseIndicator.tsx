/**
 * PhaseIndicator
 *
 * A pill badge showing the current movement phase (concentric/eccentric/hold/idle).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MovementPhase, PhaseNames } from '@/domain/workout';
import { colors } from '@/theme';

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
      return colors.success.DEFAULT;
    case MovementPhase.HOLD:
      return colors.warning.DEFAULT;
    case MovementPhase.ECCENTRIC:
      return colors.info.DEFAULT;
    default:
      return colors.surface.light;
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
