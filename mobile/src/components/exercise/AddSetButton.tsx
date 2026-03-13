/**
 * AddSetButton — tappable button to add a set to the workout plan.
 *
 * Shows a large + icon. Disabled when reps/RIR target isn't configured.
 * Each tap appends one PlannedSet with the current weight and targets.
 */

import React from 'react';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { alpha, getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

interface AddSetButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** Number of sets currently in the plan (shown as badge) */
  setCount?: number;
}

export function AddSetButton({ onPress, disabled, setCount }: AddSetButtonProps) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: disabled
            ? alpha('#fff', 0.04)
            : alpha(t['brand-primary'], 0.15),
          borderWidth: 1,
          borderColor: disabled
            ? alpha('#fff', 0.06)
            : alpha(t['brand-primary'], 0.3),
          ...Platform.select({
            web: disabled ? {
              boxShadow: `inset 0 1px 3px ${alpha('#000', 0.4)}`,
            } as any : {
              boxShadow: [
                `0 2px 4px ${alpha('#000', 0.4)}`,
                `inset 0 1px 0 ${alpha(t['brand-primary'], 0.15)}`,
              ].join(', '),
            } as any,
            default: disabled ? {} : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            },
          }),
        }}
      >
        <Ionicons
          name="add"
          size={28}
          color={disabled ? t['text-disabled'] : t['brand-primary']}
        />
      </TouchableOpacity>
      <Text style={{
        fontSize: 9,
        color: disabled ? t['text-disabled'] : t['text-tertiary'],
      }}>
        {setCount && setCount > 0 ? `${setCount} set${setCount > 1 ? 's' : ''}` : 'Add Set'}
      </Text>
    </View>
  );
}
