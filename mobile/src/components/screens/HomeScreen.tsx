/**
 * HomeScreen
 *
 * Home tab with device status, start workout CTA, weekly stats, and recent sessions.
 * Pure orchestration - composes primitives and domain components.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceConnection } from '@/components/device';
import {
  Button,
  ButtonText,
  Card,
  CardContent,
  Metric,
  MetricGroup,
  EmptyState,
  ListItem,
  ListItemContent,
  ListItemTrailing,
  ListItemDivider,
  getSemanticColors,
  alpha,
} from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';

const t = getSemanticColors('dark');

function formatVolume(volume: number): string {
  if (volume > 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(volume);
}

interface RecentSessionDisplay {
  id: string;
  exerciseName: string;
  date: number;
  setCount: number;
  totalReps: number;
  totalVolume: number;
}

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

export function HomeScreen() {
  const router = useRouter();
  const [recentSessions, setRecentSessions] = useState<RecentSessionDisplay[]>([]);

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
        {/* Device Connection */}
        <View className="mb-6">
          <DeviceConnection variant="inline" />
        </View>

        {/* Start Workout CTA */}
        <Button
          variant="solid"
          color="primary"
          size="lg"
          style={{ marginBottom: 24, width: '100%' }}
          onPress={() => router.push('/modes')}
        >
          <Ionicons name="fitness" size={20} color="#fff" style={{ marginRight: 8 }} />
          <ButtonText>Start Workout</ButtonText>
        </Button>

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
          <RecentSessionsSection sessions={displaySessions} onSeeAll={() => router.push('/')} />
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

function RecentSessionsSection({
  sessions,
  onSeeAll,
}: {
  sessions: RecentSessionDisplay[];
  onSeeAll: () => void;
}) {
  return (
    <>
      <Text className="mb-4 text-lg font-bold text-text-primary">Recent Sessions</Text>

      <Card elevation={1} className="mb-4 overflow-hidden">
        {sessions.map((session, index) => {
          const formattedDate = new Date(session.date).toLocaleDateString();

          return (
            <React.Fragment key={session.id}>
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
              {index < sessions.length - 1 && <ListItemDivider />}
            </React.Fragment>
          );
        })}
      </Card>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onSeeAll}
        className="mb-4 items-center py-2"
      >
        <Text className="text-base font-semibold" style={{ color: t['brand-primary'] }}>
          See All History
        </Text>
      </TouchableOpacity>
    </>
  );
}
