/**
 * ConnectionBanner
 * 
 * Displays connected device info with disconnect button.
 * Visually distinct from device list with success styling.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusIndicator } from '@/components/ui';
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
export function ConnectionBanner({ 
  deviceName, 
  onDisconnect,
}: ConnectionBannerProps) {
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
          className="w-14 h-14 rounded-xl items-center justify-center mr-4"
          style={{ backgroundColor: colors.success.DEFAULT + '30' }}
        >
          <Ionicons name="bluetooth" size={28} color={colors.success.DEFAULT} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <StatusIndicator status="success" size="sm" />
            <Text 
              className="text-xs uppercase tracking-wider font-semibold ml-2"
              style={{ color: colors.success.DEFAULT }}
            >
              Connected
            </Text>
          </View>
          <Text className="font-bold text-content-primary text-lg">
            {deviceName}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        onPress={onDisconnect}
        className="mt-4 py-3 rounded-xl"
        style={{ backgroundColor: colors.surface.dark }}
        activeOpacity={0.7}
      >
        <Text className="text-center text-content-secondary font-semibold">
          Disconnect
        </Text>
      </TouchableOpacity>
    </View>
  );
}
