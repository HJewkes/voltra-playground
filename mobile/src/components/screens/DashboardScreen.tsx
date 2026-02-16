/**
 * DashboardScreen
 *
 * Home screen with quick actions and recent activity.
 * Pure orchestration - composes primitives and domain components.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { useConnectionStore } from '@/stores';
import { LinkCard } from '@/components/ui';
import { HStack, Card, CardContent, Alert, AlertTitle, AlertDescription, Metric, MetricGroup, EmptyState, ListItem, ListItemContent, ListItemTrailing, ListItemDivider, getSemanticColors, alpha } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';

const t = getSemanticColors('dark');

/**
 * Format volume for display.
 */
function formatVolume(volume: number): string {
  if (volume > 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(volume);
}

/**
 * Display data for a recent session.
 */
interface RecentSessionDisplay {
  id: string;
  exerciseName: string;
  date: number;
  setCount: number;
  totalReps: number;
  totalVolume: number;
}

/**
 * Convert StoredExerciseSession to display format.
 */
function toRecentDisplay(session: StoredExerciseSession): RecentSessionDisplay {
  const totalReps = session.completedSets.reduce((sum, s) => sum + s.reps.length, 0);
  const totalVolume = session.completedSets.reduce((sum, s) => sum + s.weight * s.reps.length, 0);
  return {
    id: session.id,
    exerciseName: session.exerciseName ?? 'Exercise',
    date: session.startTime,
    setCount: session.completedSets.length,
    totalReps,
    totalVolume,
  };
}

/**
 * DashboardScreen - home screen component.
 */
export function DashboardScreen() {
  const { primaryDeviceId, devices } = useConnectionStore();
  const [recentSessions, setRecentSessions] = useState<RecentSessionDisplay[]>([]);

  const connectedDevice = primaryDeviceId ? devices.get(primaryDeviceId) : null;
  const isConnected = !!connectedDevice;
  const deviceName = connectedDevice?.getState().deviceName ?? 'Voltra';

  useEffect(() => {
    async function loadRecentSessions() {
      try {
        const sessions = await getSessionRepository().getRecent(50);
        const completed = sessions.filter((s) => s.status === 'completed');
        setRecentSessions(completed.map(toRecentDisplay));
      } catch (err) {
        console.error('Failed to load recent sessions:', err);
      }
    }
    loadRecentSessions();
  }, []);

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekSessions = recentSessions.filter((s) => s.date > oneWeekAgo);
    return {
      setCount: thisWeekSessions.reduce((sum, s) => sum + s.setCount, 0),
      totalReps: thisWeekSessions.reduce((sum, s) => sum + s.totalReps, 0),
      totalVolume: thisWeekSessions.reduce((sum, s) => sum + s.totalVolume, 0),
    };
  }, [recentSessions]);

  const displaySessions = recentSessions.slice(0, 5);

  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        {/* Welcome Banner */}
        <Alert
          status={isConnected ? 'success' : 'info'}
          variant="solid"
          className="mb-6 rounded-2xl"
        >
          <AlertTitle>{isConnected ? `Connected to ${deviceName}` : 'Ready to Train'}</AlertTitle>
          <AlertDescription>
            {isConnected ? 'Device ready for workout' : 'Connect your Voltra to start'}
          </AlertDescription>
        </Alert>

        {/* Quick Actions */}
        <Text className="mb-4 text-lg font-bold text-text-primary">Quick Actions</Text>

        <HStack gap={4} style={{ marginBottom: 24 }}>
          <LinkCard
            href="/(tabs)/workout"
            icon="fitness"
            iconColor={t['brand-primary']}
            iconBgColor={alpha(t['brand-primary-dark'], 0.12)}
            title="Start Workout"
            subtitle="Begin a new session"
          />
          <LinkCard
            href="/(tabs)/settings"
            icon={isConnected ? 'bluetooth' : 'bluetooth-outline'}
            iconColor={isConnected ? t['status-success'] : t['text-tertiary']}
            iconBgColor={isConnected ? alpha(t['status-success'], 0.12) : t['border-strong']}
            title={isConnected ? 'Connected' : 'Connect'}
            subtitle={isConnected ? deviceName : 'Set up device'}
          />
        </HStack>

        {/* Weekly Stats */}
        <Text className="mb-4 text-lg font-bold text-text-primary">This Week</Text>

        <Card elevation={1} style={{ marginBottom: 24 }}>
          <CardContent className="p-6">
            <MetricGroup>
              <Metric value={String(weeklyStats.setCount)} label="Sets" />
              <Metric value={String(weeklyStats.totalReps)} label="Total Reps" />
              <Metric value={formatVolume(weeklyStats.totalVolume)} label="Volume" />
            </MetricGroup>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        {displaySessions.length > 0 ? (
          <RecentSessionsSection sessions={displaySessions} />
        ) : (
          <EmptyState
            icon={(props) => <Ionicons name="barbell-outline" size={props.size} />}
            title="No sessions yet"
            description="Start your first workout to see your progress here"
          />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * RecentSessionsSection - displays recent session entries.
 * Inline helper component (presentational only, <40 lines).
 */
function RecentSessionsSection({ sessions }: { sessions: RecentSessionDisplay[] }) {
  return (
    <>
      <Text className="mb-4 text-lg font-bold text-text-primary">Recent Sessions</Text>

      <Card elevation={1} className="mb-4 overflow-hidden">
        {sessions.map((session, index) => {
          const formattedDate = new Date(session.date).toLocaleDateString();

          return (
            <React.Fragment key={session.id}>
              <Link href="/(tabs)/history" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <ListItem>
                    <View
                      className="mr-3 items-center justify-center rounded-xl"
                      style={{ width: 48, height: 48, backgroundColor: alpha(t['brand-primary'], 0.12) }}
                    >
                      <Ionicons name="fitness" size={24} color={t['brand-primary']} />
                    </View>
                    <ListItemContent title={session.exerciseName} subtitle={formattedDate} />
                    <ListItemTrailing>
                      <View className="items-end">
                        <Text className="text-base font-bold text-brand-primary">
                          {session.setCount} sets • {session.totalReps} reps
                        </Text>
                        <Text className="text-sm text-text-disabled">
                          {formatVolume(session.totalVolume)} lbs
                        </Text>
                      </View>
                    </ListItemTrailing>
                  </ListItem>
                </TouchableOpacity>
              </Link>
              {index < sessions.length - 1 && <ListItemDivider />}
            </React.Fragment>
          );
        })}
      </Card>
    </>
  );
}
