import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors } from '@titan-design/react-ui';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { DeviceConnection } from '@/components/device';

const t = getSemanticColors('dark');

/**
 * Returns a responsive top padding for web so content sits in the upper
 * portion of the viewport rather than dead-center. Scales with viewport
 * height (20%), capped at 160px.
 */
function useWebTopPadding(): number | undefined {
  const { height } = useWindowDimensions();
  if (Platform.OS !== "web") return undefined;
  return Math.min(height * 0.2, 160);
}

export function ConnectionScreen() {
  const router = useRouter();
  const webTopPadding = useWebTopPadding();
  const isConnected = useConnectionStore(selectIsConnected);

  useEffect(() => {
    if (isConnected) {
      router.replace('/modes');
    }
  }, [isConnected, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface-400">
      {/* Header with settings */}
      <View className="flex-row items-center justify-between px-4 pt-2">
        <View />
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="cog-outline" size={24} color={t['text-secondary']} />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View
        className={`flex-1 items-center px-6 ${webTopPadding === undefined ? 'justify-center' : 'pt-0'}`}
        style={webTopPadding !== undefined ? { paddingTop: webTopPadding } : undefined}
      >
        {/* App branding */}
        <Text className="mb-2 text-4xl font-bold text-text-primary">Voltra</Text>
        <Text className="mb-8 text-base text-text-tertiary">Connect to your device to get started</Text>

        {/* Connection card */}
        <View className="w-full">
          <DeviceConnection variant="card" subtitle="Scan for nearby Voltra devices" />
        </View>
      </View>
    </SafeAreaView>
  );
}
