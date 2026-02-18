/**
 * HistoryScreen
 *
 * Exercise session history list with detail modal.
 * Pure orchestration - composes analytics and UI components.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, VStack, Metric, MetricGroup, EmptyState, getSemanticColors, alpha } from '@titan-design/react-ui';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';

const t = getSemanticColors('dark');

/**
 * Format large numbers for display.
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return String(num);
}

/**
 * Calculate aggregate stats from sessions.
 */
function calculateAggregateStats(sessions: StoredExerciseSession[]) {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const session of sessions) {
    totalSets += session.completedSets.length;
    for (const set of session.completedSets) {
      totalReps += set.reps.length;
      totalVolume += set.weight * set.reps.length;
    }
  }

  return { totalSets, totalReps, totalVolume };
}

/**
 * HistoryScreen - exercise session history list.
 */
export function HistoryScreen() {
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

  const aggregateStats = useMemo(() => calculateAggregateStats(sessions), [sessions]);

  return (
    <ScrollView
      className="flex-1 bg-surface-400"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefresh}
          tintColor={t['brand-primary']}
        />
      }
    >
      <View className="p-4">
        {/* Aggregate Stats */}
        <Card elevation={1} style={{ marginBottom: 24 }}>
          <CardContent className="p-6">
            <Text className="mb-4 font-bold text-text-secondary">All Time Stats</Text>
            <MetricGroup>
              <Metric value={String(aggregateStats.totalSets)} label="Sets" />
              <Metric value={formatNumber(aggregateStats.totalReps)} label="Total Reps" />
              <Metric value={formatNumber(aggregateStats.totalVolume)} label="Volume (lbs)" />
            </MetricGroup>
          </CardContent>
        </Card>

        {/* Session List */}
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

        {/* Tip */}
        {sessions.length > 0 && (
          <Text className="mt-6 text-center text-xs text-text-disabled">
            Long press a session to delete it
          </Text>
        )}
      </View>

      {/* Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        visible={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </ScrollView>
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
                {formattedDate} • {isDiscovery ? 'Discovery' : 'Training'}
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

/**
 * SessionDetailModal - displays session details.
 */
function SessionDetailModal({
  session,
  visible,
  onClose,
}: {
  session: StoredExerciseSession | null;
  visible: boolean;
  onClose: () => void;
}) {
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
          style={{ backgroundColor: t['surface-elevated'], borderColor: t['border-strong'] }}
        >
          <View>
            <Text className="text-xl font-bold text-text-primary">
              {session.exerciseName ?? 'Exercise'}
            </Text>
            <Text className="text-text-disabled">
              {new Date(session.startTime).toLocaleDateString()} •{' '}
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

          {/* Set breakdown */}
          <Card elevation={1} className="mb-4">
            <CardContent className="p-6">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
                Set Breakdown
              </Text>
              {session.completedSets.map((set, i) => {
                const planned = session.plan.sets[i];
                const repsDelta = planned ? set.reps.length - planned.targetReps : 0;

                return (
                  <View
                    key={i}
                    className={`flex-row items-center justify-between py-3 ${
                      i < session.completedSets.length - 1 ? 'border-b border-surface-100' : ''
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="mr-4 h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: t['background-subtle'] }}
                      >
                        <Text className="font-bold text-text-secondary">{i + 1}</Text>
                      </View>
                      <View>
                        <Text className="font-medium text-text-primary">
                          {set.weight} lbs × {set.reps.length}
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
                          {set.meanVelocity.toFixed(2)} m/s • RPE {set.estimatedRPE}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
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

/**
 * Format termination reason for display.
 */
function formatTerminationReason(reason: string): string {
  switch (reason) {
    case 'failure':
      return 'Reached failure';
    case 'velocity_grinding':
      return 'Near max effort';
    case 'junk_volume':
      return 'Performance declined';
    case 'plan_exhausted':
      return 'All sets completed';
    case 'profile_complete':
      return 'Discovery complete';
    case 'user_stopped':
      return 'Stopped by user';
    default:
      return reason;
  }
}
