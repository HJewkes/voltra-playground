/**
 * LiveAnalyticsPanel
 * 
 * Displays live RPE/RIR and velocity metrics during a workout.
 * Uses the VoltraStore's live analytics state.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useStore } from 'zustand';
import { 
  getEffortLabel, 
  getRIRDescription, 
  getRPEColor,
} from '@/analytics';
import type { VoltraStoreApi } from '@/stores';

interface LiveAnalyticsPanelProps {
  /** The VoltraStore instance to read from */
  store: VoltraStoreApi;
  /** Whether to show compact layout */
  compact?: boolean;
}

export function LiveAnalyticsPanel({ store, compact = false }: LiveAnalyticsPanelProps) {
  const liveVelocityLoss = useStore(store, s => s.liveVelocityLoss);
  const liveRPE = useStore(store, s => s.liveRPE);
  const liveRIR = useStore(store, s => s.liveRIR);
  const repCount = useStore(store, s => s.repCount);
  
  const effortLabel = getEffortLabel(liveRPE);
  const rirDescription = getRIRDescription(liveRIR);
  const rpeColor = getRPEColor(liveRPE);
  
  if (compact) {
    return (
      <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-2">
        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">RPE</Text>
          <Text 
            className="text-lg font-bold ml-2"
            style={{ color: rpeColor }}
          >
            {liveRPE.toFixed(1)}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">RIR</Text>
          <Text className="text-lg font-bold text-white ml-2">
            {liveRIR >= 5 ? '5+' : `~${Math.round(liveRIR)}`}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <Text className="text-zinc-400 text-xs">VL</Text>
          <Text className="text-lg font-bold text-white ml-2">
            {liveVelocityLoss.toFixed(0)}%
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View className="bg-zinc-800 rounded-xl p-4">
      <Text className="text-zinc-400 text-sm mb-3">Live Analytics</Text>
      
      <View className="flex-row justify-between">
        {/* RPE */}
        <View className="items-center flex-1">
          <Text className="text-zinc-500 text-xs uppercase">RPE</Text>
          <Text 
            className="text-3xl font-bold mt-1"
            style={{ color: rpeColor }}
          >
            {liveRPE.toFixed(1)}
          </Text>
          <Text className="text-zinc-400 text-xs mt-1">{effortLabel}</Text>
        </View>
        
        {/* RIR */}
        <View className="items-center flex-1 border-l border-r border-zinc-700 mx-2">
          <Text className="text-zinc-500 text-xs uppercase">RIR</Text>
          <Text className="text-3xl font-bold text-white mt-1">
            {liveRIR >= 5 ? '5+' : `~${Math.round(liveRIR)}`}
          </Text>
          <Text className="text-zinc-400 text-xs mt-1">{rirDescription}</Text>
        </View>
        
        {/* Velocity Loss */}
        <View className="items-center flex-1">
          <Text className="text-zinc-500 text-xs uppercase">Velocity Loss</Text>
          <Text className="text-3xl font-bold text-white mt-1">
            {liveVelocityLoss.toFixed(0)}%
          </Text>
          <Text className="text-zinc-400 text-xs mt-1">
            {repCount < 2 ? 'Need 2+ reps' : 'from rep 1'}
          </Text>
        </View>
      </View>
      
      {/* Progress bar for velocity loss */}
      <View className="mt-4">
        <View className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <View 
            className="h-full rounded-full"
            style={{ 
              width: `${Math.min(liveVelocityLoss, 50) * 2}%`,
              backgroundColor: liveVelocityLoss > 30 ? '#ef4444' : 
                              liveVelocityLoss > 20 ? '#eab308' : '#22c55e',
            }}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-zinc-500 text-xs">Fresh</Text>
          <Text className="text-zinc-500 text-xs">Fatigued</Text>
        </View>
      </View>
    </View>
  );
}
