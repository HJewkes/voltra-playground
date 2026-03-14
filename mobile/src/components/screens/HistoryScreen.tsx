/**
 * HistoryScreen
 *
 * Exercise session history with list, calendar, and analytics views.
 * Shows personal records, aggregate stats, training log calendar,
 * and cross-session analytics dashboard.
 * Detail view is handled by SessionDetailModal.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, VStack, Metric, MetricGroup, EmptyState, getSemanticColors, alpha } from '@titan-design/react-ui';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  computeStoredAggregateStats,
  computeStoredPersonalRecords,
  type StoredPersonalRecord,
} from '@/domain/history';
import { SessionDetailModal } from './SessionDetailModal';
import { TrainingLogScreen } from './TrainingLogScreen';
import { AnalyticsDashboard } from './AnalyticsDashboard';

const t = getSemanticColors('dark');

type HistoryView = 'list' | 'calendar' | 'analytics';


function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function formatPRType(type: StoredPersonalRecord['type']): string {
  const labels: Record<string, string> = {
    max_weight: 'Heaviest',
    max_reps: 'Most Reps',
    max_velocity: 'Fastest',
    max_volume: 'Most Volume',
  };
  return labels[type] ?? type;
}

function formatPRValue(record: StoredPersonalRecord): string {
  switch (record.type) {
    case 'max_weight':
      return `${record.value} lbs`;
    case 'max_reps':
      return `${record.value} reps`;
    case 'max_velocity':
      return `${record.value.toFixed(2)} m/s`;
    case 'max_volume':
      return `${formatNumber(record.value)} lbs`;
    default:
      return String(record.value);
  }
}

function getPRIcon(type: StoredPersonalRecord['type']): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    max_weight: 'barbell',
    max_reps: 'repeat',
    max_velocity: 'flash',
    max_volume: 'trending-up',
  };
  return icons[type] ?? 'trophy';
}

/**
 * Segmented control for switching between list and calendar views.
 */
function ViewToggle({
  activeView,
  onChangeView,
}: {
  activeView: HistoryView;
  onChangeView: (view: HistoryView) => void;
}) {
  return (
    <View
      className="mb-4 flex-row rounded-lg p-1"
      style={{ backgroundColor: t['surface-elevated'] }}
    >
      <TouchableOpacity
        onPress={() => onChangeView('list')}
        className="flex-1 items-center rounded-md py-2"
        style={activeView === 'list' ? { backgroundColor: t['brand-primary'] } : undefined}
      >
        <Text
          style={{
            color: activeView === 'list' ? '#FFFFFF' : t['text-secondary'],
            fontWeight: '600',
            fontSize: 13,
          }}
        >
          List
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChangeView('calendar')}
        className="flex-1 items-center rounded-md py-2"
        style={activeView === 'calendar' ? { backgroundColor: t['brand-primary'] } : undefined}
      >
        <Text
          style={{
            color: activeView === 'calendar' ? '#FFFFFF' : t['text-secondary'],
            fontWeight: '600',
            fontSize: 13,
          }}
        >
          Calendar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * HistoryScreen - exercise session history with view toggle.
 */
export function HistoryScreen() {
  const [activeView, setActiveView] = useState<HistoryView>('list');
  const [sessions, setSessions] = useState<StoredExerciseSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<StoredExerciseSession | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const recent = await getSessionRepository().getRecent(100);
      const completed = recent.filter((s) => s.status === 'completed');
      setSessions(completed);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRefresh = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  const handleViewDetails = (session: StoredExerciseSession) => {
    setSelectedSession(session);
    setShowDetails(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Session', 'Are you sure you want to delete this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await getSessionRepository().delete(id);
          await loadSessions();
        },
      },
    ]);
  };

  const aggregateStats = useMemo(() => computeStoredAggregateStats(sessions), [sessions]);
  const personalRecords = useMemo(() => computeStoredPersonalRecords(sessions), [sessions]);

  if (activeView === 'calendar') {
    return (
      <View className="flex-1 bg-surface-400">
        <View className="px-4 pt-4">
          <ViewToggle activeView={activeView} onChangeView={setActiveView} />
        </View>
        <TrainingLogScreen />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-base"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefresh}
          tintColor={t['brand-primary']}
        />
      }
    >
      <View className="p-4">
        {/* View Toggle */}
        <ViewToggle activeView={activeView} onChangeView={setActiveView} />

        {/* Aggregate Stats */}
        <Card elevation={1} style={{ marginBottom: 24 }}>
          <CardContent className="p-6">
            <Text className="mb-4 font-bold text-text-secondary">All Time Stats</Text>
            <MetricGroup>
              <Metric value={String(sessions.length)} label="Workouts" />
              <Metric value={formatNumber(aggregateStats.totalReps)} label="Total Reps" />
              <Metric value={formatNumber(aggregateStats.totalVolume)} label="Volume (lbs)" />
            </MetricGroup>
          </CardContent>
        </Card>

        {personalRecords.length > 0 && <PersonalRecordsCard records={personalRecords} />}

        <Text className="mb-4 text-lg font-bold text-text-primary">Past Sessions</Text>

        {sessions.length === 0 ? (
          <EmptyState
            icon={(props) => <Ionicons name="fitness-outline" size={props.size} />}
            title="No Sessions Yet"
            description="Complete your first session to see it here"
          />
        ) : (
          <VStack gap={2}>
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                onPress={() => handleViewDetails(session)}
                onLongPress={() => handleDelete(session.id)}
              />
            ))}
          </VStack>
        )}

        {sessions.length > 0 && (
          <Text className="mt-6 text-center text-xs text-text-disabled">
            Long press a session to delete it
          </Text>
        )}
      </View>

      <SessionDetailModal
        session={selectedSession}
        visible={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </ScrollView>
  );
}

/**
 * PersonalRecordsCard - displays all-time personal records.
 */
function PersonalRecordsCard({ records }: { records: StoredPersonalRecord[] }) {
  return (
    <Card elevation={1} style={{ marginBottom: 16 }}>
      <CardContent className="p-6">
        <Text className="mb-4 font-bold text-text-secondary">Personal Records</Text>
        <View className="flex-row flex-wrap">
          {records.map((record) => (
            <View key={record.type} className="mb-3 w-1/2 pr-2">
              <View className="flex-row items-center">
                <View
                  className="mr-2 h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: alpha(t['status-warning'], 0.12) }}
                >
                  <Ionicons name={getPRIcon(record.type)} size={16} color={t['status-warning']} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-text-primary">
                    {formatPRValue(record)}
                  </Text>
                  <Text className="text-xs text-text-disabled">{formatPRType(record.type)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

/**
 * SessionListItem - displays a single session entry.
 */
function SessionListItem({
  session,
  onPress,
  onLongPress,
}: {
  session: StoredExerciseSession;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const formattedDate = new Date(session.startTime).toLocaleDateString();
  const totalReps = session.completedSets.reduce((sum, s) => sum + s.reps.length, 0);
  const isDiscovery = session.plan.generatedBy === 'discovery';

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <Card elevation={1} className="mb-4">
        <CardContent>
          <View className="flex-row items-center">
            <View
              className="mr-4 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: alpha(t['brand-primary-dark'], 0.12) }}
            >
              <Ionicons
                name={isDiscovery ? 'compass' : 'fitness'}
                size={24}
                color={t['brand-primary']}
              />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-text-primary">
                {session.exerciseName ?? 'Exercise'}
              </Text>
              <Text className="text-sm text-text-disabled">
                {formattedDate} - {isDiscovery ? 'Discovery' : 'Training'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-base font-bold text-brand-primary">
                {session.completedSets.length} sets
              </Text>
              <Text className="text-sm text-text-disabled">{totalReps} reps</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={t['text-disabled']}
              style={{ marginLeft: 8 }}
            />
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}
