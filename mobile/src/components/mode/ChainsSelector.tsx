/**
 * ChainsSelector
 *
 * Toggle between normal chains and inverse chains with a weight picker.
 * Only one can be non-zero at a time.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { OptionSelector, WeightPicker } from '@/components/ui';
import type { Option } from '@/components/ui';

type ChainType = 'normal' | 'inverse';

const CHAIN_OPTIONS: Option<ChainType>[] = [
  { value: 'normal', label: 'Normal Chains', icon: 'link-outline' },
  { value: 'inverse', label: 'Inverse Chains', icon: 'swap-vertical-outline' },
];

interface ChainsSelectorProps {
  chains: number;
  inverseChains: number;
  onChainsChange: (lbs: number) => Promise<void>;
  onInverseChainsChange: (lbs: number) => Promise<void>;
}

export function ChainsSelector({
  chains,
  inverseChains,
  onChainsChange,
  onInverseChainsChange,
}: ChainsSelectorProps) {
  // Determine active type based on which has a non-zero value
  const activeType: ChainType = inverseChains > 0 ? 'inverse' : 'normal';
  const activeValue = activeType === 'normal' ? chains : inverseChains;

  const handleTypeChange = async (type: ChainType) => {
    if (type === 'normal' && activeType === 'inverse') {
      // Switching from inverse to normal - zero out inverse
      await onInverseChainsChange(0);
    } else if (type === 'inverse' && activeType === 'normal') {
      // Switching from normal to inverse - zero out normal
      await onChainsChange(0);
    }
  };

  const handleValueChange = async (lbs: number) => {
    if (activeType === 'normal') {
      await onChainsChange(lbs);
    } else {
      await onInverseChainsChange(lbs);
    }
  };

  return (
    <View>
      {/* Chain type toggle */}
      <OptionSelector
        options={CHAIN_OPTIONS}
        selected={activeType}
        onSelect={handleTypeChange}
        gap="sm"
      />

      {/* Weight picker for active chain type */}
      <View className="mt-4">
        <WeightPicker
          value={activeValue}
          onChange={handleValueChange}
          min={0}
          max={100}
          step={1}
          unit="lbs"
        />
      </View>

      {/* Description */}
      <Text className="mt-4 text-center text-sm text-content-muted">
        {activeType === 'normal'
          ? 'Normal chains add resistance at the top of the lift'
          : 'Inverse chains reduce resistance at the top of the lift'}
      </Text>
    </View>
  );
}
