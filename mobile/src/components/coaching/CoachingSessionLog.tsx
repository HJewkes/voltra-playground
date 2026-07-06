/**
 * CoachingSessionLog
 *
 * Modal view showing chronological list of all coaching cues
 * interleaved with set completion markers during a session.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import type { CoachingLogEntry, CoachingCueType } from '@/stores';

const t = getSemanticColors('dark');

function getCueAccentColor(type: CoachingCueType): string {
  switch (type) {
    case 'informational':
      return t['brand-primary'] ?? '#3B82F6';
    case 'load_adjustment':
      return t['status-warning'] ?? '#F59E0B';
    case 'encouragement':
      return t['status-success'] ?? '#10B981';
  }
}

function getCueLabel(type: CoachingCueType): string {
  switch (type) {
    case 'informational':
      return 'Insight';
    case 'load_adjustment':
      return 'Load Adjustment';
    case 'encouragement':
      return 'Encouragement';
  }
}

export interface CoachingSessionLogProps {
  visible: boolean;
  entries: CoachingLogEntry[];
  onClose: () => void;
}

export function CoachingSessionLog({ visible, entries, onClose }: CoachingSessionLogProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View
          className="flex-row items-center justify-between border-b px-4 py-3"
          style={{ borderColor: t['border-subtle'] }}
        >
          <Text className="text-lg font-bold text-text-primary">Coaching Log</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={t['text-primary']} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-4 py-3" contentContainerStyle={{ paddingBottom: 24 }}>
          {entries.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={t['text-disabled']} />
              <Text className="mt-4 text-center text-text-disabled">
                No coaching cues yet.{'\n'}Cues will appear here between sets.
              </Text>
            </View>
          ) : (
            entries.map((entry, i) => <LogEntryRow key={i} entry={entry} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function LogEntryRow({ entry }: { entry: CoachingLogEntry }) {
  if (entry.kind === 'set_marker') {
    return (
      <View className="my-2 flex-row items-center">
        <View className="h-px flex-1" style={{ backgroundColor: t['border-subtle'] }} />
        <Text className="mx-3 text-xs font-medium text-text-disabled">
          Set {entry.setNumber} completed - {formatTime(entry.timestamp)}
        </Text>
        <View className="h-px flex-1" style={{ backgroundColor: t['border-subtle'] }} />
      </View>
    );
  }

  if (!entry.cue) return null;

  const { cue } = entry;
  const accent = getCueAccentColor(cue.type);

  return (
    <View className="mb-3 rounded-xl p-3" style={{ backgroundColor: alpha(accent, 0.08) }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase" style={{ color: accent }}>
          {getCueLabel(cue.type)}
        </Text>
        <Text className="text-xs text-text-disabled">{formatTime(cue.timestamp)}</Text>
      </View>
      <Text className="mt-1 text-sm text-text-primary">{cue.message}</Text>
      {cue.suggestedWeight != null && (
        <Text className="mt-1 text-xs font-medium" style={{ color: accent }}>
          Suggested: {cue.suggestedWeight} lbs
        </Text>
      )}
      {cue.reaction && (
        <View className="mt-2 flex-row items-center">
          <Ionicons
            name={cue.reaction === 'thumbs_up' ? 'thumbs-up' : 'thumbs-down'}
            size={14}
            color={cue.reaction === 'thumbs_up' ? t['status-success'] : t['status-error']}
          />
          <Text
            className="ml-1 text-xs"
            style={{
              color: cue.reaction === 'thumbs_up' ? t['status-success'] : t['status-error'],
            }}
          >
            {cue.reaction === 'thumbs_up' ? 'Helpful' : 'Not useful'}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
