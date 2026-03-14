/**
 * CoachingToggle
 *
 * Settings section for enabling/disabling AI coaching during sessions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch } from 'react-native';
import { Surface, getSemanticColors } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';
import { isAICoachingEnabled, setAICoachingEnabled } from '@/data/preferences';

const t = getSemanticColors('dark');

export function CoachingToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    async function load() {
      const val = await isAICoachingEnabled();
      setEnabled(val);
    }
    load();
  }, []);

  const handleToggle = useCallback((value: boolean) => {
    setEnabled(value);
    setAICoachingEnabled(value);
  }, []);

  return (
    <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
      <View className="p-4">
        <View className="mb-4 flex-row items-center">
          <Ionicons name="sparkles" size={20} color={t['brand-primary']} />
          <Text className="ml-2 text-lg font-bold text-text-primary">AI Coaching</Text>
        </View>
        <Text className="mb-3 text-xs text-text-disabled">
          Get real-time coaching cues powered by Claude between sets.
        </Text>
        <View className="flex-row items-center justify-between py-2">
          <View className="flex-1">
            <Text className="text-text-primary">Enable AI Coach</Text>
            <Text className="text-xs text-text-disabled">
              Coaching cards appear during rest periods
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: t['background-subtle'], true: t['brand-primary'] }}
          />
        </View>
      </View>
    </Surface>
  );
}
