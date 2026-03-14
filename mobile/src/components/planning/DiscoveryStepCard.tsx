/**
 * DiscoveryStepCard
 *
 * Displays the current discovery step with adaptive instructions,
 * phase indicator, and velocity expectation.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  CardContent,
  HStack,
  Surface,
  getSemanticColors,
  alpha,
} from '@titan-design/react-ui';
import type { DiscoveryStep, DiscoveryPhase } from '@/domain/planning';

const t = getSemanticColors('dark');

// =============================================================================
// Types
// =============================================================================

export interface DiscoveryStepCardProps {
  /** Current discovery step */
  step: DiscoveryStep;
  /** Current phase of discovery */
  phase: DiscoveryPhase;
  /** Number of sets completed so far */
  completedCount: number;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// Helpers
// =============================================================================

const PHASE_CONFIG: Record<
  DiscoveryPhase,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  not_started: { label: 'Ready', color: t['text-disabled'], icon: 'ellipse-outline' },
  exploring: { label: 'Exploring', color: t['brand-primary'], icon: 'search' },
  dialing_in: { label: 'Dialing In', color: t['status-warning'], icon: 'locate' },
  complete: { label: 'Complete', color: t['status-success'], icon: 'checkmark-circle' },
};

// =============================================================================
// Component
// =============================================================================

export function DiscoveryStepCard({
  step,
  phase,
  completedCount,
  style,
}: DiscoveryStepCardProps) {
  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <Card elevation={2} className="mb-4" style={style}>
      <CardContent className="p-6">
        {/* Phase badge and step number */}
        <View className="mb-4 flex-row items-center justify-between">
          <View
            className="flex-row items-center rounded-full px-3 py-1"
            style={{ backgroundColor: alpha(phaseConfig.color, 0.12) }}
          >
            <Ionicons
              name={phaseConfig.icon}
              size={14}
              color={phaseConfig.color}
              style={{ marginRight: 4 }}
            />
            <Text className="text-sm font-bold" style={{ color: phaseConfig.color }}>
              {phaseConfig.label}
            </Text>
          </View>
          <Text className="font-semibold text-text-disabled">Step {step.stepNumber}</Text>
        </View>

        {/* Weight display */}
        <View className="items-center py-4">
          <Text className="text-7xl font-bold" style={{ color: t['brand-primary'] }}>
            {step.weight}
          </Text>
          <Text className="mt-1 text-2xl text-text-disabled">lbs</Text>
        </View>

        {/* Target details */}
        <Surface elevation={0} className="rounded-xl bg-surface-input">
          <HStack justify="between" style={{ padding: 16 }}>
            <View className="flex-1 items-center">
              <Ionicons name="repeat" size={20} color={t['text-disabled']} />
              <Text className="mt-1 text-sm text-text-disabled">Target Reps</Text>
              <Text className="mt-1 text-xl font-bold text-text-primary">
                {step.targetReps}
              </Text>
            </View>
            <View className="w-px bg-surface-100" />
            <View className="flex-1 items-center">
              <Ionicons name="layers" size={20} color={t['text-disabled']} />
              <Text className="mt-1 text-sm text-text-disabled">Sets Done</Text>
              <Text className="mt-1 text-xl font-bold text-text-primary">
                {completedCount}
              </Text>
            </View>
          </HStack>
        </Surface>

        {/* Purpose / instruction */}
        <View className="mt-4">
          <Text className="text-center text-sm font-medium text-text-secondary">
            {step.purpose}
          </Text>
        </View>

        {/* Velocity expectation */}
        {step.velocityExpectation && (
          <View
            className="mt-3 flex-row items-center justify-center rounded-xl px-4 py-2"
            style={{ backgroundColor: alpha(t['brand-primary'], 0.06) }}
          >
            <Ionicons
              name="speedometer"
              size={16}
              color={t['brand-primary']}
              style={{ marginRight: 6 }}
            />
            <Text className="text-sm" style={{ color: t['brand-primary'] }}>
              {step.velocityExpectation}
            </Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
