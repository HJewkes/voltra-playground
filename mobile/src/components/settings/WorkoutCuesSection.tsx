/**
 * WorkoutCuesSection
 *
 * Settings toggles for haptic and audio cues during rest timer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch } from 'react-native';
import { Surface, getSemanticColors } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import {
  isHapticCuesEnabled,
  setHapticCuesEnabled,
  isAudioCuesEnabled,
  setAudioCuesEnabled,
} from '@/data/preferences';

const t = getSemanticColors('dark');

export function WorkoutCuesSection() {
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    async function load() {
      const [haptic, audio] = await Promise.all([
        isHapticCuesEnabled(),
        isAudioCuesEnabled(),
      ]);
      setHapticEnabled(haptic);
      setAudioEnabled(audio);
    }
    load();
  }, []);

  const handleHapticToggle = useCallback((value: boolean) => {
    setHapticEnabled(value);
    setHapticCuesEnabled(value);
  }, []);

  const handleAudioToggle = useCallback((value: boolean) => {
    setAudioEnabled(value);
    setAudioCuesEnabled(value);
  }, []);

  return (
    <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
      <View className="p-4">
        <View className="mb-4 flex-row items-center">
          <Ionicons name="notifications" size={20} color={t['brand-primary']} />
          <Text className="ml-2 text-lg font-bold text-text-primary">Workout Cues</Text>
        </View>
        <Text className="mb-3 text-xs text-text-disabled">
          Get notified at 30s, 10s, and when rest ends.
        </Text>
        <View className="flex-row items-center justify-between py-2">
          <View className="flex-1">
            <Text className="text-text-primary">Haptic Feedback</Text>
            <Text className="text-xs text-text-disabled">Vibration during rest countdown</Text>
          </View>
          <Switch value={hapticEnabled} onValueChange={handleHapticToggle}
            trackColor={{ false: t['background-subtle'], true: t['brand-primary'] }} />
        </View>
        <View className="flex-row items-center justify-between py-2">
          <View className="flex-1">
            <Text className="text-text-primary">Audio Cues</Text>
            <Text className="text-xs text-text-disabled">Beep sounds during rest countdown</Text>
          </View>
          <Switch value={audioEnabled} onValueChange={handleAudioToggle}
            trackColor={{ false: t['background-subtle'], true: t['brand-primary'] }} />
        </View>
      </View>
    </Surface>
  );
}
