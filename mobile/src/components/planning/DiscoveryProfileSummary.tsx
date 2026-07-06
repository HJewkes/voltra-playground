/**
 * DiscoveryProfileSummary
 *
 * Displays the load-velocity profile built during discovery.
 * Shows data points, regression line info, and estimated 1RM.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Card, CardContent, HStack, Surface, getSemanticColors } from '@titan-design/react-ui';
import type { DiscoverySetResult } from '@/domain/planning';

const t = getSemanticColors('dark');

// =============================================================================
// Types
// =============================================================================

export interface DiscoveryProfileSummaryProps {
  /** Completed discovery sets */
  completedSets: DiscoverySetResult[];
  /** Estimated 1RM from the profile */
  estimated1RM?: number;
  /** Profile confidence */
  confidence?: 'high' | 'medium' | 'low';
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// Helpers
// =============================================================================

function getConfidenceDisplay(confidence: string): { color: string; label: string } {
  switch (confidence) {
    case 'high':
      return { color: t['status-success'], label: 'High' };
    case 'medium':
      return { color: t['status-warning'], label: 'Medium' };
    default:
      return { color: t['text-tertiary'], label: 'Low' };
  }
}

function getVelocityColor(velocity: number): string {
  if (velocity >= 0.75) return t['status-success'];
  if (velocity >= 0.5) return t['brand-primary'];
  if (velocity >= 0.3) return t['status-warning'];
  return t['status-error'];
}

// =============================================================================
// Component
// =============================================================================

export function DiscoveryProfileSummary({
  completedSets,
  estimated1RM,
  confidence = 'medium',
  style,
}: DiscoveryProfileSummaryProps) {
  if (completedSets.length === 0) return null;

  const confidenceDisplay = getConfidenceDisplay(confidence);
  const maxVelocity = Math.max(...completedSets.map((s) => s.meanVelocity));

  return (
    <View style={style}>
      {/* Profile stats */}
      {estimated1RM != null && estimated1RM > 0 && (
        <Card elevation={1} className="mb-4">
          <CardContent className="p-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
              Profile Summary
            </Text>
            <Surface elevation={0} className="rounded-xl bg-surface-input">
              <HStack justify="between" style={{ padding: 16 }}>
                <View className="flex-1 items-center">
                  <Text className="text-sm text-text-disabled">Est. 1RM</Text>
                  <Text className="mt-1 text-2xl font-bold" style={{ color: t['brand-primary'] }}>
                    {Math.round(estimated1RM)}
                  </Text>
                  <Text className="text-xs text-text-disabled">lbs</Text>
                </View>
                <View className="bg-surface-100 w-px" />
                <View className="flex-1 items-center">
                  <Text className="text-sm text-text-disabled">Data Points</Text>
                  <Text className="mt-1 text-2xl font-bold text-text-primary">
                    {completedSets.length}
                  </Text>
                </View>
                <View className="bg-surface-100 w-px" />
                <View className="flex-1 items-center">
                  <Text className="text-sm text-text-disabled">Confidence</Text>
                  <Text
                    className="mt-1 text-lg font-bold"
                    style={{ color: confidenceDisplay.color }}
                  >
                    {confidenceDisplay.label}
                  </Text>
                </View>
              </HStack>
            </Surface>
          </CardContent>
        </Card>
      )}

      {/* Data points visualization */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-text-disabled">
            Load-Velocity Data
          </Text>

          {completedSets.map((set, i) => {
            const barWidth = maxVelocity > 0 ? (set.meanVelocity / maxVelocity) * 100 : 0;

            return (
              <View key={i} className="mb-3">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-text-secondary">{set.weight} lbs</Text>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: getVelocityColor(set.meanVelocity) }}
                  >
                    {set.meanVelocity.toFixed(2)} m/s
                  </Text>
                </View>
                <View
                  className="h-3 overflow-hidden rounded-full"
                  style={{ backgroundColor: t['background-subtle'] }}
                >
                  <View
                    className="h-3 rounded-full"
                    style={{
                      width: `${Math.max(5, barWidth)}%`,
                      backgroundColor: getVelocityColor(set.meanVelocity),
                    }}
                  />
                </View>
                <Text className="mt-1 text-xs text-text-disabled">
                  {set.reps} reps{set.failed ? ' (failed)' : ''}
                </Text>
              </View>
            );
          })}

          {/* Legend */}
          <View className="mt-4 flex-row flex-wrap gap-3">
            <LegendItem color={t['status-success']} label="Fast" />
            <LegendItem color={t['brand-primary']} label="Moderate" />
            <LegendItem color={t['status-warning']} label="Slow" />
            <LegendItem color={t['status-error']} label="Grinding" />
          </View>
        </CardContent>
      </Card>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center">
      <View className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-text-disabled">{label}</Text>
    </View>
  );
}
