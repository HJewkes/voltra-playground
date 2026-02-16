/**
 * DevToolsSection
 *
 * Development-only tools for data management, seeding, and replay.
 * Only shown in __DEV__ mode.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, Alert, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ButtonText, VStack, Surface } from '@titan-design/react-ui';
import { colors } from '@/theme';
import {
  getSessionRepository,
  getRecordingRepository,
  isDebugTelemetryEnabled,
  setDebugTelemetryEnabled,
} from '@/data/provider';
import { seedDatabase, clearSeedData } from '@/__fixtures__';
import type { SampleRecording } from '@/data/recordings';

interface StorageStats {
  sessionCount: number;
  recordingCount: number;
}

/**
 * DevToolsSection - developer tools for data management.
 */
export function DevToolsSection() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(isDebugTelemetryEnabled());
  const [stats, setStats] = useState<StorageStats>({ sessionCount: 0, recordingCount: 0 });
  const [recordings, setRecordings] = useState<SampleRecording[]>([]);
  const [showRecordings, setShowRecordings] = useState(false);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const sessions = await getSessionRepository().getRecent(100);
      const recs = await getRecordingRepository().getRecent(100);
      setStats({
        sessionCount: sessions.length,
        recordingCount: recs.length,
      });
      setRecordings(recs);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    try {
      const result = await seedDatabase({
        sessionsCount: 10,
        daysBack: 14,
        includeRecordings: true,
      });
      await loadStats();
      Alert.alert(
        'Seed Complete',
        `Created ${result.sessionsCreated} sessions and ${result.recordingsCreated} recordings.`
      );
    } catch (err: unknown) {
      Alert.alert('Seed Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will delete all sessions, exercises, and recordings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearSeedData();
              await loadStats();
              Alert.alert('Cleared', 'All data has been cleared.');
            } catch (err: unknown) {
              Alert.alert('Clear Failed', err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleDebugToggle = useCallback((value: boolean) => {
    setDebugEnabled(value);
    setDebugTelemetryEnabled(value);
  }, []);

  // TODO: Replay functionality is planned for post-v1
  // See docs/roadmap/replay-adapter.md
  const handleReplaySelect = useCallback(async (recording: SampleRecording) => {
    Alert.alert(
      'Coming Soon',
      `Replay functionality for "${recording.exerciseName}" is planned for a future release.`
    );
    setShowRecordings(false);
  }, []);

  const renderRecordingItem = ({ item }: { item: SampleRecording }) => (
    <TouchableOpacity
      className="border-border flex-row items-center justify-between border-b px-4 py-3"
      onPress={() => handleReplaySelect(item)}
    >
      <View className="flex-1">
        <Text className="font-medium text-content-primary">{item.exerciseName}</Text>
        <Text className="text-xs text-content-muted">
          {item.sampleCount} samples • {Math.round(item.durationMs / 1000)}s • {item.weight} lbs
        </Text>
      </View>
      <Ionicons name="play-circle" size={24} color={colors.primary[500]} />
    </TouchableOpacity>
  );

  return (
    <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
      <View className="p-4">
        {/* Header */}
        <View className="mb-4 flex-row items-center">
          <Ionicons name="construct" size={20} color={colors.warning.DEFAULT} />
          <Text className="ml-2 text-lg font-bold text-content-primary">Dev Tools</Text>
        </View>

        <VStack gap={4}>
          {/* Storage Stats */}
          <View className="rounded-lg bg-surface-300 p-3">
            <Text className="mb-2 text-xs uppercase text-content-muted">Storage Stats</Text>
            <View className="flex-row justify-between">
              <Text className="text-content-secondary">Sessions</Text>
              <Text className="font-medium text-content-primary">{stats.sessionCount}</Text>
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-content-secondary">Recordings</Text>
              <Text className="font-medium text-content-primary">{stats.recordingCount}</Text>
            </View>
          </View>

          {/* Debug Telemetry Toggle */}
          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1">
              <Text className="text-content-primary">Debug Telemetry</Text>
              <Text className="text-xs text-content-muted">Store raw samples with sessions</Text>
            </View>
            <Switch
              value={debugEnabled}
              onValueChange={handleDebugToggle}
              trackColor={{ false: colors.surface.dark, true: colors.primary[500] }}
            />
          </View>

          {/* Seed / Clear Buttons */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                variant="outline"
                color="primary"
                fullWidth
                onPress={handleSeed}
                isDisabled={isSeeding}
                isLoading={isSeeding}
                loadingText="Seeding..."
              >
                <Ionicons name="cloud-download" size={20} color="#f97316" style={{ marginRight: 8 }} />
                <ButtonText>Seed Data</ButtonText>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                variant="outline"
                color="primary"
                fullWidth
                onPress={handleClear}
                isDisabled={isClearing}
                isLoading={isClearing}
                loadingText="Clearing..."
              >
                <Ionicons name="trash" size={20} color="#f97316" style={{ marginRight: 8 }} />
                <ButtonText>Clear Data</ButtonText>
              </Button>
            </View>
          </View>

          {/* Replay Section */}
          {stats.recordingCount > 0 && (
            <>
              <TouchableOpacity
                className="flex-row items-center justify-between py-2"
                onPress={() => setShowRecordings(!showRecordings)}
              >
                <View className="flex-row items-center">
                  <Ionicons name="play-circle" size={20} color={colors.primary[500]} />
                  <Text className="ml-2 text-content-primary">Replay Recording</Text>
                </View>
                <Ionicons
                  name={showRecordings ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.content.muted}
                />
              </TouchableOpacity>

              {showRecordings && (
                <View className="max-h-48 overflow-hidden rounded-lg bg-surface-300">
                  <FlatList
                    data={recordings}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRecordingItem}
                    ListEmptyComponent={
                      <Text className="py-4 text-center text-content-muted">
                        No recordings available
                      </Text>
                    }
                  />
                </View>
              )}
            </>
          )}
        </VStack>
      </View>
    </Surface>
  );
}
