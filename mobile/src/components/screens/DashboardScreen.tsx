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
import { 
  Card, 
  Stack, 
  Banner, 
  LinkCard, 
  StatsRow,
  ListItem,
  EmptyState,
} from '@/components/ui';
import { colors } from '@/theme';
import { AsyncStorageAdapter } from '@/data/adapters';
import {
  createExerciseSessionRepository,
  type StoredExerciseSession,
} from '@/data/exercise-session';

/**
 * Format volume for display.
 */
function formatVolume(volume: number): string {
  if (volume > 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(volume);
}

// Create repository singleton
const adapter = new AsyncStorageAdapter();
const sessionRepository = createExerciseSessionRepository(adapter);

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
  const totalVolume = session.completedSets.reduce(
    (sum, s) => sum + s.weight * s.reps.length,
    0
  );
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
        const sessions = await sessionRepository.getRecent(50);
        const completed = sessions.filter(s => s.status === 'completed');
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
    const thisWeekSessions = recentSessions.filter(s => s.date > oneWeekAgo);
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
        <Banner
          variant={isConnected ? 'success' : 'primary'}
          icon={isConnected ? 'flash' : 'fitness'}
          title={isConnected ? `Connected to ${deviceName}` : 'Ready to Train'}
          subtitle={isConnected ? 'Device ready for workout' : 'Connect your Voltra to start'}
          style={{ marginBottom: 24 }}
        />
        
        {/* Quick Actions */}
        <Text className="text-content-primary text-lg font-bold mb-4">
          Quick Actions
        </Text>
        
        <Stack direction="row" gap="md" style={{ marginBottom: 24 }}>
          <LinkCard
            href="/(tabs)/workout"
            icon="fitness"
            iconColor={colors.primary[500]}
            iconBgColor={colors.primary[600] + '20'}
            title="Start Workout"
            subtitle="Begin a new session"
          />
          <LinkCard
            href="/(tabs)/settings"
            icon={isConnected ? 'bluetooth' : 'bluetooth-outline'}
            iconColor={isConnected ? colors.success.DEFAULT : colors.text.tertiary}
            iconBgColor={isConnected ? colors.success.DEFAULT + '20' : colors.surface.light}
            title={isConnected ? 'Connected' : 'Connect'}
            subtitle={isConnected ? deviceName : 'Set up device'}
          />
        </Stack>
        
        {/* Weekly Stats */}
        <Text className="text-content-primary text-lg font-bold mb-4">
          This Week
        </Text>
        
        <Card elevation={1} padding="lg" style={{ marginBottom: 24 }}>
          <StatsRow
            stats={[
              { value: weeklyStats.setCount, label: 'Sets' },
              { value: weeklyStats.totalReps, label: 'Total Reps' },
              { value: formatVolume(weeklyStats.totalVolume), label: 'Volume' },
            ]}
          />
        </Card>
        
        {/* Recent Sessions */}
        {displaySessions.length > 0 ? (
          <RecentSessionsSection sessions={displaySessions} />
        ) : (
          <EmptyState
            icon="barbell-outline"
            title="No sessions yet"
            subtitle="Start your first workout to see your progress here"
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
      <Text className="text-content-primary text-lg font-bold mb-4">
        Recent Sessions
      </Text>
      
      <Card elevation={1} padding="none" className="overflow-hidden">
        {sessions.map((session, index) => {
          const formattedDate = new Date(session.date).toLocaleDateString();
          
          return (
            <Link key={session.id} href="/(tabs)/history" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <ListItem
                  icon="fitness"
                  iconColor={colors.primary[500]}
                  title={session.exerciseName}
                  subtitle={formattedDate}
                  showBorder={index < sessions.length - 1}
                  trailing={
                    <View className="items-end">
                      <Text className="font-bold text-base" style={{ color: colors.primary[500] }}>
                        {session.setCount} sets • {session.totalReps} reps
                      </Text>
                      <Text className="text-content-muted text-sm">
                        {formatVolume(session.totalVolume)} lbs
                      </Text>
                    </View>
                  }
                />
              </TouchableOpacity>
            </Link>
          );
        })}
      </Card>
    </>
  );
}
