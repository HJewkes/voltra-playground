import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

const INCREMENTS = [-10, -5, -1, 1, 5, 10] as const;

interface IncrementRowProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function IncrementRow({ value, min, max, onChange }: IncrementRowProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {INCREMENTS.map((inc) => {
        const next = value + inc;
        const disabled = next < min || next > max;
        const label = inc > 0 ? `+${inc}` : String(inc);
        return (
          <TouchableOpacity
            key={inc}
            onPress={() => onChange(Math.max(min, Math.min(max, next)))}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${inc > 0 ? 'Increase' : 'Decrease'} by ${Math.abs(inc)} pounds`}
            className="rounded-lg px-3 py-2"
            style={{
              backgroundColor: alpha(t['brand-primary'], disabled ? 0.05 : 0.12),
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: disabled ? t['text-disabled'] : t['brand-primary'] }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
