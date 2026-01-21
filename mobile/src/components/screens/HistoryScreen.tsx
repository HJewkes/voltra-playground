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
import { Card, Stack, StatsRow, EmptyState } from '@/components/ui';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { colors } from '@/theme';

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
          tintColor={colors.primary[500]}
        />
      }
    >
      <View className="p-4">
        {/* Aggregate Stats */}
        <Card elevation={1} padding="lg" style={{ marginBottom: 24 }}>
          <Text className="mb-4 font-bold text-content-secondary">All Time Stats</Text>
          <StatsRow
            stats={[
              { value: aggregateStats.totalSets, label: 'Sets' },
              { value: formatNumber(aggregateStats.totalReps), label: 'Total Reps' },
              { value: formatNumber(aggregateStats.totalVolume), label: 'Volume (lbs)' },
            ]}
          />
        </Card>

        {/* Session List */}
        <Text className="mb-4 text-lg font-bold text-content-primary">Past Sessions</Text>

        {sessions.length === 0 ? (
          <EmptyState
            icon="fitness-outline"
            title="No Sessions Yet"
            subtitle="Complete your first session to see it here"
          />
        ) : (
          <Stack gap="sm">
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                onPress={() => handleViewDetails(session)}
                onLongPress={() => handleDelete(session.id)}
              />
            ))}
          </Stack>
        )}

        {/* Tip */}
        {sessions.length > 0 && (
          <Text className="mt-6 text-center text-xs text-content-muted">
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
      <Card elevation={1} padding="md">
        <View className="flex-row items-center">
          <View
            className="mr-4 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[600] + '20' }}
          >
            <Ionicons
              name={isDiscovery ? 'compass' : 'fitness'}
              size={24}
              color={colors.primary[500]}
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-content-primary">
              {session.exerciseName ?? 'Exercise'}
            </Text>
            <Text className="text-sm text-content-muted">
              {formattedDate} • {isDiscovery ? 'Discovery' : 'Training'}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold" style={{ color: colors.primary[500] }}>
              {session.completedSets.length} sets
            </Text>
            <Text className="text-sm text-content-muted">{totalReps} reps</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.content.muted}
            style={{ marginLeft: 8 }}
          />
        </View>
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
      <View className="flex-1" style={{ backgroundColor: colors.surface.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b px-5 py-5"
          style={{ backgroundColor: colors.surface.elevated, borderColor: colors.surface.light }}
        >
          <View>
            <Text className="text-xl font-bold text-content-primary">
              {session.exerciseName ?? 'Exercise'}
            </Text>
            <Text className="text-content-muted">
              {new Date(session.startTime).toLocaleDateString()} •{' '}
              {isDiscovery ? 'Discovery' : 'Training'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Summary stats */}
          <Card elevation={1} padding="lg">
            <StatsRow
              stats={[
                { value: session.completedSets.length, label: 'Sets' },
                { value: totalReps, label: 'Reps' },
                { value: formatNumber(totalVolume), label: 'Volume' },
              ]}
            />
          </Card>

          {/* Set breakdown */}
          <Card elevation={1} padding="lg">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
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
                      style={{ backgroundColor: colors.surface.dark }}
                    >
                      <Text className="font-bold text-content-secondary">{i + 1}</Text>
                    </View>
                    <View>
                      <Text className="font-medium text-content-primary">
                        {set.weight} lbs × {set.reps.length}
                        {planned && (
                          <Text
                            style={{
                              color: repsDelta >= 0 ? colors.success.DEFAULT : colors.danger.light,
                            }}
                          >
                            {' '}
                            ({repsDelta >= 0 ? '+' : ''}
                            {repsDelta})
                          </Text>
                        )}
                      </Text>
                      <Text className="text-xs text-content-muted">
                        {set.meanVelocity.toFixed(2)} m/s • RPE {set.estimatedRPE}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Termination reason */}
          {session.terminationReason && (
            <Card elevation={1} padding="md">
              <View className="flex-row items-center">
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={colors.content.muted}
                  style={{ marginRight: 8 }}
                />
                <Text className="flex-1 text-content-muted">
                  Session ended: {formatTerminationReason(session.terminationReason)}
                </Text>
              </View>
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
