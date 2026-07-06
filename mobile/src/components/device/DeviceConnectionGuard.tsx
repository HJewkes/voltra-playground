import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { BLEWarning } from './BLEWarning';
import { DeviceListItem } from './DeviceListItem';
import type { DiscoveredDevice } from '@/domain/device';

const t = getSemanticColors('dark');

export interface GuardVariantProps {
  title: string;
  subtitle: string;
  discoveredDevices: DiscoveredDevice[];
  connectedDevices: { id: string; name: string }[];
  isScanning: boolean;
  connectingDeviceId: string | null;
  bleSupported: boolean;
  warningMessage: string | null;
  environment: string;
  requiresUserGesture: boolean;
  error: string | null;
  onScan: () => void;
  onConnect: (device: DiscoveredDevice) => void;
  onDismissError: () => void;
}

export function GuardVariant({
  title,
  subtitle,
  discoveredDevices,
  connectedDevices,
  isScanning,
  connectingDeviceId,
  bleSupported,
  warningMessage,
  environment,
  requiresUserGesture,
  error,
  onScan,
  onConnect,
  onDismissError,
}: GuardVariantProps) {
  const scanActive = isScanning || connectingDeviceId !== null;
  const scanDisabled = scanActive || !bleSupported;
  const buttonLabel = scanActive
    ? connectingDeviceId
      ? 'Connecting...'
      : 'Scanning...'
    : requiresUserGesture
      ? connectedDevices.length > 0
        ? 'Add Another'
        : 'Connect'
      : 'Scan';

  return (
    <SafeAreaView className="bg-surface-400 flex-1">
      <View className="flex-1 items-center justify-center px-6">
        <Text accessibilityRole="header" className="mb-2 text-4xl font-bold text-text-primary">
          {title}
        </Text>
        <Text className="mb-10 text-base text-text-tertiary">{subtitle}</Text>

        {warningMessage && (
          <View className="mb-6 w-full" style={{ maxWidth: 400 }}>
            <BLEWarning environment={environment} message={warningMessage} />
          </View>
        )}

        {bleSupported && (
          <TouchableOpacity
            onPress={onScan}
            disabled={scanDisabled}
            className="mb-8 flex-row items-center rounded-2xl px-8 py-4"
            style={{
              backgroundColor: scanActive ? alpha(t['brand-primary'], 0.12) : t['brand-primary'],
              opacity: scanDisabled && !scanActive ? 0.5 : 1,
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
          >
            {scanActive ? (
              <>
                <ActivityIndicator size="small" color={t['brand-primary']} />
                <Text
                  className="ml-3 text-base font-semibold"
                  style={{ color: t['brand-primary'] }}
                >
                  {buttonLabel}
                </Text>
              </>
            ) : (
              <Text className="text-base font-semibold text-text-primary">{buttonLabel}</Text>
            )}
          </TouchableOpacity>
        )}

        {!requiresUserGesture && discoveredDevices.length > 0 && (
          <View className="w-full" style={{ maxWidth: 400 }}>
            {discoveredDevices.map((device) => {
              if (connectedDevices.some((d) => d.id === device.id)) return null;
              return (
                <DeviceListItem
                  key={device.id}
                  device={device}
                  isConnecting={connectingDeviceId === device.id}
                  isOtherConnecting={
                    connectingDeviceId !== null && connectingDeviceId !== device.id
                  }
                  onSelect={() => onConnect(device)}
                />
              );
            })}
          </View>
        )}

        {error && (
          <View
            className="mt-4 w-full flex-row items-center rounded-xl p-3"
            style={{ maxWidth: 400, backgroundColor: alpha(t['status-error'], 0.08) }}
          >
            <Ionicons name="alert-circle" size={18} color={t['status-error']} />
            <Text className="ml-2 flex-1 text-xs" style={{ color: t['status-error'] }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={onDismissError}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Ionicons name="close" size={16} color={t['text-disabled']} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
