import React from 'react';
import { View, Text } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { getSetMeanVelocity } from '@voltras/workout-analytics';

import type { SetLogEntry } from '@/domain/workout';

import { CircularTimer } from './CircularTimer';

const t = getSemanticColors('dark');

interface RestCardProps {
  /** Elapsed rest time in ms */
  restElapsedMs: number;
  /** Rest target in ms (null = no target) */
  restTargetMs: number | null;
  /** The just-completed set (last entry in setLog) */
  lastSetEntry: SetLogEntry | null;
  /** Current set number (1-based) */
  setNumber: number;
}

export function RestCard({ restElapsedMs, restTargetMs, lastSetEntry, setNumber }: RestCardProps) {
  const completedSet = lastSetEntry?.set;
  const repCount = completedSet?.data.reps.length ?? 0;
  const weight = completedSet?.weight ?? 0;
  const avgVelocity = completedSet ? getSetMeanVelocity(completedSet.data) : 0;

  return (
    <View>
      {/* Circular timer centered */}
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <CircularTimer elapsedMs={restElapsedMs} targetMs={restTargetMs} />
      </View>

      {/* Set summary */}
      {completedSet && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            backgroundColor: alpha('#fff', 0.04),
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 13, color: t['text-secondary'] }}>Set {setNumber} complete</Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {repCount} reps
          </Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {weight} lbs
          </Text>
          <Text style={{ fontSize: 13, color: t['text-tertiary'] }}>·</Text>
          <Text style={{ fontSize: 13, color: t['text-primary'], fontWeight: '600' }}>
            {avgVelocity.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}
