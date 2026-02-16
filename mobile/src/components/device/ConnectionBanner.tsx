/**
 * ConnectionBanner
 *
 * Displays connected device info with disconnect button.
 * Visually distinct from device list with success styling.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export interface ConnectionBannerProps {
  /** Device name */
  deviceName: string;
  /** Called when disconnect is pressed */
  onDisconnect: () => void;
}

/**
 * ConnectionBanner - shows connected device with disconnect option.
 * Uses success-colored border and background to clearly indicate connected state.
 */
export function ConnectionBanner({ deviceName, onDisconnect }: ConnectionBannerProps) {
  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: colors.success.DEFAULT + '15',
        borderWidth: 2,
        borderColor: colors.success.DEFAULT,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="mr-4 h-14 w-14 items-center justify-center rounded-xl"
          style={{ backgroundColor: colors.success.DEFAULT + '30' }}
        >
          <Ionicons name="bluetooth" size={28} color={colors.success.DEFAULT} />
        </View>
        <View className="flex-1">
          <View className="mb-1 flex-row items-center">
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.success.DEFAULT }} />
            <Text
              className="ml-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: colors.success.DEFAULT }}
            >
              Connected
            </Text>
          </View>
          <Text className="text-lg font-bold text-content-primary">{deviceName}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onDisconnect}
        className="mt-4 rounded-xl py-3"
        style={{ backgroundColor: colors.surface.dark }}
        activeOpacity={0.7}
      >
        <Text className="text-center font-semibold text-content-secondary">Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}
