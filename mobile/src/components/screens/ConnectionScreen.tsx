import React from 'react';
import { Redirect } from 'expo-router';
import { DeviceConnection } from '@/components/device';

export function ConnectionScreen() {
  return (
    <DeviceConnection
      variant="guard"
      title="Voltra"
      subtitle="Connect your device to get started"
    >
      <Redirect href="/modes" />
    </DeviceConnection>
  );
}
