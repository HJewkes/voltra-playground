/**
 * SessionDebrief
 *
 * Rich post-workout debrief showing progression arrows, training load
 * status, next-session recommendations, PR badges, and recovery notes.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import type { TrendDirection } from '@/domain/history/services/progression-service';
import type {
  SessionDebriefData,
  ProgressionArrow,
  PRBadge,
  RecoveryNote,
} from '@/domain/history/services/session-debrief-service';
import type { TrainingLoad } from '@/domain/history/services/cross-session-analytics';
import type { ExerciseSuggestion } from '@/domain/history/services/workout-suggestion-service';

const t = getSemanticColors('dark');

// =============================================================================
// Props
// =============================================================================

export interface SessionDebriefProps {
  debrief: SessionDebriefData;
}

// =============================================================================
// Helpers
// =============================================================================

function getTrendIcon(direction: TrendDirection): keyof typeof Ionicons.glyphMap {
  switch (direction) {
    case 'up':
      return 'trending-up';
    case 'down':
      return 'trending-down';
    case 'flat':
      return 'remove-outline';
  }
}

function getTrendColor(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return t['status-success'];
    case 'down':
      return t['status-error'];
    case 'flat':
      return t['text-tertiary'];
  }
}

function formatDeltaPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getLoadStatusColor(status: TrainingLoad['status']): string {
  switch (status) {
    case 'optimal':
      return t['status-success'];
    case 'undertraining':
      return t['status-warning'];
    case 'caution':
      return t['status-warning'];
    case 'danger':
      return t['status-error'];
  }
}

function getLoadStatusLabel(status: TrainingLoad['status']): string {
  switch (status) {
    case 'optimal':
      return 'Optimal';
    case 'undertraining':
      return 'Undertraining';
    case 'caution':
      return 'Caution';
    case 'danger':
      return 'High Risk';
  }
}

function getPRLabel(type: PRBadge['type']): string {
  switch (type) {
    case 'max_weight':
      return 'Max Weight';
    case 'max_reps':
      return 'Max Reps';
    case 'max_velocity':
      return 'Max Velocity';
    case 'max_volume':
      return 'Max Volume';
  }
}

function getPRUnit(type: PRBadge['type']): string {
  switch (type) {
    case 'max_weight':
      return 'lbs';
    case 'max_reps':
      return 'reps';
    case 'max_velocity':
      return 'm/s';
    case 'max_volume':
      return 'lbs';
  }
}

function formatPRValue(type: PRBadge['type'], value: number): string {
  if (type === 'max_velocity') return value.toFixed(2);
  return String(Math.round(value));
}

// =============================================================================
// Sub-components
// =============================================================================

function ProgressionSection({ arrows }: { arrows: ProgressionArrow[] }) {
  if (arrows.length === 0) return null;

  return (
    <View>
      <SectionHeader icon="trending-up" title="Progression" />
      {arrows.map((arrow, i) => (
        <View key={i} style={{ marginTop: i > 0 ? 8 : 4 }}>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: t['text-primary'], marginBottom: 2 }}
          >
            {arrow.exerciseName}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 4 }}>
            <MetricPill
              label="Velocity"
              direction={arrow.velocity.direction}
              delta={arrow.velocity.deltaPercent}
            />
            <MetricPill
              label="e1RM"
              direction={arrow.e1RM.direction}
              delta={arrow.e1RM.deltaPercent}
            />
            <MetricPill
              label="Volume"
              direction={arrow.volume.direction}
              delta={arrow.volume.deltaPercent}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function MetricPill({
  label,
  direction,
  delta,
}: {
  label: string;
  direction: TrendDirection;
  delta: number;
}) {
  const color = getTrendColor(direction);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={getTrendIcon(direction)} size={12} color={color} />
      <Text style={{ fontSize: 11, color: t['text-secondary'] }}>{label}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>
        {formatDeltaPercent(delta)}
      </Text>
    </View>
  );
}

function TrainingLoadSection({ load }: { load: TrainingLoad }) {
  const statusColor = getLoadStatusColor(load.status);
  const statusLabel = getLoadStatusLabel(load.status);

  return (
    <View>
      <SectionHeader icon="fitness-outline" title="Training Load" />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, marginTop: 4 }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
        <Text style={{ fontSize: 13, color: t['text-primary'] }}>ACWR {load.acwr.toFixed(2)}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
      </View>
    </View>
  );
}

function SuggestionsSection({ suggestions }: { suggestions: ExerciseSuggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <View>
      <SectionHeader icon="bulb-outline" title="Next Session" />
      {suggestions.map((s, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 4,
            marginTop: 4,
          }}
        >
          <Ionicons name="arrow-forward" size={12} color={t['brand-primary']} />
          <Text style={{ fontSize: 13, color: t['text-primary'] }}>{s.exerciseName}</Text>
          <Text style={{ fontSize: 11, color: t['text-tertiary'] }}>{s.reason}</Text>
        </View>
      ))}
    </View>
  );
}

function PRBadgesSection({ badges }: { badges: PRBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <View>
      <SectionHeader icon="trophy-outline" title="Personal Records" />
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 4, marginTop: 4 }}
      >
        {badges.map((badge, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: alpha(t['status-warning'], 0.15),
            }}
          >
            <Ionicons name="trophy" size={12} color={t['status-warning']} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: t['status-warning'] }}>
              {getPRLabel(badge.type)}
            </Text>
            <Text style={{ fontSize: 11, color: t['text-secondary'] }}>
              {formatPRValue(badge.type, badge.value)} {getPRUnit(badge.type)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecoverySection({ note }: { note: RecoveryNote }) {
  const isWarning = note.severity === 'warning';
  const iconColor = isWarning ? t['status-warning'] : t['text-tertiary'];
  const bgColor = isWarning ? alpha(t['status-warning'], 0.08) : alpha('#fff', 0.03);

  return (
    <View style={{ backgroundColor: bgColor, borderRadius: 8, padding: 10, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="bed-outline" size={14} color={iconColor} />
        <Text style={{ fontSize: 12, color: t['text-secondary'], flex: 1 }}>{note.message}</Text>
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <Ionicons name={icon} size={14} color={t['text-tertiary']} />
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: t['text-tertiary'],
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SessionDebrief({ debrief }: SessionDebriefProps) {
  const { progressionArrows, trainingLoad, suggestions, prBadges, recoveryNote } = debrief;
  const hasContent =
    progressionArrows.length > 0 ||
    suggestions.length > 0 ||
    prBadges.length > 0 ||
    recoveryNote !== null;

  if (!hasContent) {
    return (
      <Surface elevation={1} className="mt-3 rounded-xl p-4">
        <TrainingLoadSection load={trainingLoad} />
      </Surface>
    );
  }

  return (
    <Surface elevation={1} className="mt-3 rounded-xl p-4">
      <View style={{ gap: 14 }}>
        {prBadges.length > 0 && <PRBadgesSection badges={prBadges} />}
        {progressionArrows.length > 0 && <ProgressionSection arrows={progressionArrows} />}
        <TrainingLoadSection load={trainingLoad} />
        {suggestions.length > 0 && <SuggestionsSection suggestions={suggestions} />}
        {recoveryNote && <RecoverySection note={recoveryNote} />}
      </View>
    </Surface>
  );
}
