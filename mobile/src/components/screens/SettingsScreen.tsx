/**
 * SettingsScreen
 *
 * Device connection and app settings.
 * Pure orchestration - composes device/ components and UI primitives.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { DataRow, Surface } from '@titan-design/react-ui';
import { DeviceConnection } from '@/components/device';
import { DataBackupSection, DevToolsSection, WorkoutCuesSection } from '@/components/settings';
import { selectBleEnvironment } from '@/stores';

/**
 * SettingsScreen - connection and app settings.
 */
export function SettingsScreen() {
  const { isWeb } = selectBleEnvironment();

  return (
    <ScrollView className="bg-surface-400 flex-1">
      <View className="p-4">
        {/* Device Connection */}
        <View className="mb-4">
          <DeviceConnection variant="card" />
        </View>

        {/* Workout Cues */}
        <WorkoutCuesSection />

        {/* Data Backup */}
        <DataBackupSection />

        {/* Dev Tools (DEV only) */}
        {__DEV__ && <DevToolsSection />}

        {/* App Info */}
        <AppInfoSection isWeb={isWeb} />
      </View>
    </ScrollView>
  );
}

/**
 * AppInfoSection - displays app version and settings.
 * Inline helper component (presentational only).
 */
function AppInfoSection({ isWeb }: { isWeb: boolean }) {
  return (
    <>
      <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
        <View className="p-4">
          <DataRow
            label="Version"
            value="1.0.0"
            className="border-surface-200 mb-3 border-b pb-3"
          />
          <DataRow label="BLE Mode" value={isWeb ? 'Web Bluetooth' : 'Native'} />
        </View>
      </Surface>

      <Text className="mb-6 px-4 text-center text-xs text-text-disabled">
        Unofficial Voltra SDK. Not affiliated with Beyond Power.
      </Text>
    </>
  );
}
