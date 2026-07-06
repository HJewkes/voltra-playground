/**
 * WorkoutSummary
 *
 * Post-workout summary card showing consolidated stats across
 * all completed exercises in a session.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import { getSetMeanVelocity, estimateSetRIR } from '@voltras/workout-analytics';
import type { SetLogEntry } from '@/domain/workout';

const t = getSemanticColors('dark');

// =============================================================================
// Types
// =============================================================================

export interface WorkoutSummaryProps {
  exercises: {
    name: string;
    setCount: number;
    setLog: SetLogEntry[];
  }[];
  totalDuration?: string;
  onCopySummary: () => void;
  onNewWorkout: () => void;
}

// =============================================================================
// Per-exercise stat derivation
// =============================================================================

interface ExerciseStats {
  name: string;
  setCount: number;
  workingWeight: number | null;
  bestVelocity: number | null;
  rpeMin: number | null;
  rpeMax: number | null;
}

function deriveExerciseStats(exercise: WorkoutSummaryProps['exercises'][number]): ExerciseStats {
  const setsToAnalyze = exercise.setLog;

  let workingWeight: number | null = null;
  let bestVelocity: number | null = null;
  let rpeMin: number | null = null;
  let rpeMax: number | null = null;

  if (setsToAnalyze.length > 0) {
    workingWeight = findMostCommonWeight(setsToAnalyze);

    for (const entry of setsToAnalyze) {
      const mv = getSetMeanVelocity(entry.set.data);
      if (mv > 0 && (bestVelocity === null || mv > bestVelocity)) {
        bestVelocity = mv;
      }

      const { rpe } = estimateSetRIR(entry.set.data);
      if (rpe > 0) {
        rpeMin = rpeMin === null ? rpe : Math.min(rpeMin, rpe);
        rpeMax = rpeMax === null ? rpe : Math.max(rpeMax, rpe);
      }
    }
  }

  return {
    name: exercise.name,
    setCount: exercise.setCount,
    workingWeight,
    bestVelocity,
    rpeMin,
    rpeMax,
  };
}

function findMostCommonWeight(entries: SetLogEntry[]): number | null {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const w = entry.set.weight;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = 0;
  for (const [weight, count] of counts) {
    if (count > bestCount) {
      best = weight;
      bestCount = count;
    }
  }
  return best;
}

// =============================================================================
// Text summary for clipboard
// =============================================================================

export function buildTextSummary(
  exercises: WorkoutSummaryProps['exercises'],
  totalDuration?: string
): string {
  const stats = exercises.map(deriveExerciseStats);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.setCount, 0);

  const lines: string[] = [];
  lines.push('Workout Complete');
  lines.push(
    `${exercises.length} exercises | ${totalSets} sets${totalDuration ? ` | ${totalDuration}` : ''}`
  );
  lines.push('');

  for (const s of stats) {
    lines.push(`${s.name} - ${s.setCount} sets`);
    if (s.workingWeight !== null) {
      lines.push(`  Working weight: ${s.workingWeight} lbs`);
    }
    if (s.bestVelocity !== null) {
      lines.push(`  Best velocity: ${s.bestVelocity.toFixed(2)} m/s`);
    }
    if (s.rpeMin !== null && s.rpeMax !== null) {
      lines.push(
        s.rpeMin === s.rpeMax
          ? `  RPE: ${s.rpeMin.toFixed(1)}`
          : `  RPE range: ${s.rpeMin.toFixed(1)} - ${s.rpeMax.toFixed(1)}`
      );
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// =============================================================================
// Sub-components
// =============================================================================

function ExerciseRow({ stats }: { stats: ExerciseStats }) {
  const details: string[] = [];
  if (stats.workingWeight !== null) {
    details.push(`Working weight: ${stats.workingWeight} lbs`);
  }
  if (stats.bestVelocity !== null) {
    details.push(`Best velocity: ${stats.bestVelocity.toFixed(2)} m/s`);
  }
  if (stats.rpeMin !== null && stats.rpeMax !== null) {
    details.push(
      stats.rpeMin === stats.rpeMax
        ? `RPE: ${stats.rpeMin.toFixed(1)}`
        : `RPE range: ${stats.rpeMin.toFixed(1)} - ${stats.rpeMax.toFixed(1)}`
    );
  }

  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: t['text-primary'], flex: 1 }}>
          {stats.name}
        </Text>
        <Text style={{ fontSize: 13, color: t['text-tertiary'], fontVariant: ['tabular-nums'] }}>
          {stats.setCount} sets
        </Text>
      </View>
      {details.map((detail, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingLeft: 4 }}
        >
          <Text style={{ fontSize: 11, color: t['text-disabled'], marginRight: 6 }}>
            {i < details.length - 1 ? '\u251C' : '\u2514'}
          </Text>
          <Text style={{ fontSize: 12, color: t['text-secondary'] }}>{detail}</Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function WorkoutSummary({
  exercises,
  totalDuration,
  onCopySummary,
  onNewWorkout,
}: WorkoutSummaryProps) {
  const totalSets = exercises.reduce((sum, ex) => sum + ex.setCount, 0);
  const stats = exercises.map(deriveExerciseStats);

  const headerParts = [`${exercises.length} exercises`, `${totalSets} sets`];
  if (totalDuration) headerParts.push(totalDuration);

  return (
    <Surface elevation={1} className="mt-3 rounded-xl p-4">
      {/* Header */}
      <View style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Ionicons name="checkmark-circle" size={20} color={t['status-success']} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: t['text-primary'] }}>
            Workout Complete
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: t['text-tertiary'], paddingLeft: 28 }}>
          {headerParts.join(' \u00B7 ')}
        </Text>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: alpha('#fff', 0.06), marginVertical: 4 }} />

      {/* Exercise rows */}
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          <ExerciseRow stats={s} />
          {i < stats.length - 1 && (
            <View style={{ height: 1, backgroundColor: alpha('#fff', 0.04), marginLeft: 4 }} />
          )}
        </React.Fragment>
      ))}

      {/* Divider */}
      <View
        style={{ height: 1, backgroundColor: alpha('#fff', 0.06), marginTop: 4, marginBottom: 12 }}
      />

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={onCopySummary}
          activeOpacity={0.7}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: alpha(t['text-secondary'], 0.1),
          }}
          accessibilityRole="button"
          accessibilityLabel="Copy workout summary to clipboard"
        >
          <Ionicons name="copy-outline" size={16} color={t['text-secondary']} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: t['text-secondary'] }}>
            Copy Summary
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNewWorkout}
          activeOpacity={0.7}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: t['brand-primary'],
          }}
          accessibilityRole="button"
          accessibilityLabel="Start a new workout"
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Start New Workout</Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
}
