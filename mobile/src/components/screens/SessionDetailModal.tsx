/**
 * SessionDetailModal
 *
 * Full-screen modal showing session details with expandable per-rep data.
 * Extracted from HistoryScreen to keep file sizes manageable.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  CardContent,
  Metric,
  MetricGroup,
  getSemanticColors,
  alpha,
} from '@titan-design/react-ui';
import type { StoredExerciseSession, StoredSessionSet } from '@/data/exercise-session';

const t = getSemanticColors('dark');

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function formatTerminationReason(reason: string): string {
  const labels: Record<string, string> = {
    failure: 'Reached failure',
    velocity_grinding: 'Near max effort',
    junk_volume: 'Performance declined',
    plan_exhausted: 'All sets completed',
    profile_complete: 'Discovery complete',
    user_stopped: 'Stopped by user',
  };
  return labels[reason] ?? reason;
}

// =============================================================================
// SessionDetailModal
// =============================================================================

export function SessionDetailModal({
  session,
  visible,
  onClose,
}: {
  session: StoredExerciseSession | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [expandedSet, setExpandedSet] = useState<number | null>(null);

  const toggleSetExpanded = (index: number) => {
    setExpandedSet(expandedSet === index ? null : index);
  };

  if (!session) return null;

  const totalReps = session.completedSets.reduce((sum, s) => sum + s.reps.length, 0);
  const totalVolume = session.completedSets.reduce((sum, s) => sum + s.weight * s.reps.length, 0);
  const isDiscovery = session.plan.generatedBy === 'discovery';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: t['background-default'] }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b px-5 py-5"
          style={{
            backgroundColor: t['surface-elevated'],
            borderColor: t['border-strong'],
          }}
        >
          <View className="flex-1">
            <Text className="text-xl font-bold text-text-primary">
              {session.exerciseName ?? 'Exercise'}
            </Text>
            <Text className="text-text-disabled">
              {new Date(session.startTime).toLocaleDateString()} -{' '}
              {isDiscovery ? 'Discovery' : 'Training'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: t['background-subtle'] }}
          >
            <Ionicons name="close" size={22} color={t['text-secondary']} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Summary stats */}
          <Card elevation={1} className="mb-4">
            <CardContent className="p-6">
              <MetricGroup>
                <Metric value={String(session.completedSets.length)} label="Sets" />
                <Metric value={String(totalReps)} label="Reps" />
                <Metric value={formatNumber(totalVolume)} label="Volume" />
              </MetricGroup>
            </CardContent>
          </Card>

          {/* Set breakdown with expandable rep data */}
          <Card elevation={1} className="mb-4">
            <CardContent className="p-6">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
                Set Breakdown
              </Text>
              <Text className="mb-4 text-xs text-text-disabled">Tap a set to see rep details</Text>
              {session.completedSets.map((set, i) => (
                <SetBreakdownItem
                  key={i}
                  set={set}
                  index={i}
                  planned={session.plan.sets[i]}
                  isLast={i === session.completedSets.length - 1}
                  isExpanded={expandedSet === i}
                  onToggle={() => toggleSetExpanded(i)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Termination reason */}
          {session.terminationReason && (
            <Card elevation={1} className="mb-4">
              <CardContent>
                <View className="flex-row items-center">
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={t['text-disabled']}
                    style={{ marginRight: 8 }}
                  />
                  <Text className="flex-1 text-text-disabled">
                    Session ended: {formatTerminationReason(session.terminationReason)}
                  </Text>
                </View>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// =============================================================================
// SetBreakdownItem (expandable with rep data)
// =============================================================================

function SetBreakdownItem({
  set,
  index,
  planned,
  isLast,
  isExpanded,
  onToggle,
}: {
  set: StoredSessionSet;
  index: number;
  planned?: { targetReps: number; weight: number };
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const repsDelta = planned ? set.reps.length - planned.targetReps : 0;

  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        className={`flex-row items-center justify-between py-3 ${
          !isLast && !isExpanded ? 'border-surface-100 border-b' : ''
        }`}
      >
        <View className="flex-row items-center">
          <View
            className="mr-4 h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: t['background-subtle'] }}
          >
            <Text className="font-bold text-text-secondary">{index + 1}</Text>
          </View>
          <View>
            <Text className="font-medium text-text-primary">
              {set.weight} lbs x {set.reps.length}
              {planned && (
                <Text
                  style={{
                    color: repsDelta >= 0 ? t['status-success'] : t['status-error'],
                  }}
                >
                  {' '}
                  ({repsDelta >= 0 ? '+' : ''}
                  {repsDelta})
                </Text>
              )}
            </Text>
            <Text className="text-xs text-text-disabled">
              {set.meanVelocity.toFixed(2)} m/s - RPE {Math.round(set.estimatedRPE)}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={t['text-disabled']}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View
          className="mb-3 rounded-xl p-4"
          style={{ backgroundColor: alpha(t['background-subtle'], 0.5) }}
        >
          <RepDataTable reps={set.reps} />
          <View className="border-surface-100 mt-3 flex-row justify-between border-t pt-3">
            <Text className="text-xs text-text-disabled">
              Vel. Loss: {set.velocityLossPercent.toFixed(0)}%
            </Text>
            <Text className="text-xs text-text-disabled">RIR: ~{Math.round(set.estimatedRIR)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// RepDataTable
// =============================================================================

function RepDataTable({ reps }: { reps: StoredSessionSet['reps'] }) {
  if (reps.length === 0) {
    return <Text className="text-xs text-text-disabled">No rep data</Text>;
  }

  return (
    <View>
      <View className="border-surface-100 mb-2 flex-row border-b pb-2">
        <Text className="w-8 text-xs font-medium text-text-disabled">#</Text>
        <Text className="flex-1 text-xs font-medium text-text-disabled">Con. Samples</Text>
        <Text className="w-20 text-right text-xs font-medium text-text-disabled">Ecc. Samples</Text>
      </View>

      {reps.map((rep) => (
        <View key={rep.repNumber} className="flex-row items-center py-2">
          <Text className="w-8 font-bold text-text-secondary">{rep.repNumber}</Text>
          <Text className="flex-1 text-sm text-text-primary">
            {rep.concentric.samples.length} samples
          </Text>
          <Text className="w-20 text-right text-sm text-text-tertiary">
            {rep.eccentric.samples.length} samples
          </Text>
        </View>
      ))}
    </View>
  );
}
