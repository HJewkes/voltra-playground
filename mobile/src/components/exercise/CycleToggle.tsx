/**
 * CycleToggle — a compact button that cycles through a list of options on tap.
 *
 * Used for Set/Rep view toggle and Velocity/Force/Position signal toggle.
 * Shows the current option label, tapping advances to the next.
 */

import React from 'react';
import { TouchableOpacity, Text, Platform } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface CycleToggleOption<T extends string = string> {
  value: T;
  label: string;
}

interface CycleToggleProps<T extends string = string> {
  options: readonly CycleToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional color override for active state */
  activeColor?: string;
}

export function CycleToggle<T extends string = string>({
  options,
  value,
  onChange,
  activeColor = t['brand-primary'],
}: CycleToggleProps<T>) {
  const currentIndex = options.findIndex((o) => o.value === value);
  const currentLabel = options[currentIndex]?.label ?? value;

  const handlePress = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex].value);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${currentLabel}, tap to switch`}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: alpha(activeColor, 0.15),
        ...Platform.select({
          web: {
            boxShadow: [
              `0 1px 2px ${alpha('#000', 0.4)}`,
              `inset 0 1px 0 ${alpha(activeColor, 0.15)}`,
            ].join(', '),
          } as any,
          default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
          },
        }),
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: activeColor,
          ...Platform.select({
            web: {
              textShadow: `0 0 8px ${alpha(activeColor, 0.4)}`,
            } as any,
            default: {},
          }),
        }}
      >
        {currentLabel}
      </Text>
    </TouchableOpacity>
  );
}
