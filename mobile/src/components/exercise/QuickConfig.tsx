/**
 * QuickConfig — simplified config bar for plan-as-you-go exercise flow.
 *
 * Three-column layout: Reps/RIR cycling pill + ScrollDial | Weight slot | AddSetButton.
 * The left pill cycles through Off → Reps → RIR → Off via onCycleEffort.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';
import { ScrollDial } from './ScrollDial';
import { AddSetButton } from './AddSetButton';

const t = getSemanticColors('dark');

export interface QuickConfigProps {
  effortEnabled: boolean;
  targetMode: 'reps' | 'rir';
  targetValue: number;
  maxValue: number;
  onCycleEffort: () => void;
  onTargetChange: (value: number) => void;
  weightSlot?: React.ReactNode;
  onAddSet: () => void;
  setCount: number;
  addSetDisabled?: boolean;
  disabled?: boolean;
}

export function QuickConfig({
  effortEnabled,
  targetMode,
  targetValue,
  maxValue,
  onCycleEffort,
  onTargetChange,
  weightSlot,
  onAddSet,
  setCount,
  addSetDisabled,
  disabled,
}: QuickConfigProps) {
  const outerOpacity = disabled ? 0.4 : 1;
  const pillLabel = effortEnabled
    ? targetMode === 'reps' ? 'Reps' : 'RIR'
    : 'Reps';

  return (
    <View
      style={{ opacity: outerOpacity }}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <View className="flex-row items-center">
        {/* Left: Effort pill + ScrollDial */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <EnablePill
            label={pillLabel}
            active={effortEnabled}
            onPress={onCycleEffort}
          />
          <View className="mt-1.5">
            <ScrollDial
              value={targetValue}
              min={0}
              max={maxValue}
              onChange={onTargetChange}
              formatValue={dashZero}
              activeColor={
                effortEnabled && targetValue > 0
                  ? t['brand-primary']
                  : t['text-disabled']
              }
              disabled={!effortEnabled}
            />
          </View>
        </View>

        {/* Center: Weight slot */}
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 26 }}>
          {weightSlot}
        </View>

        {/* Right: AddSetButton — paddingTop matches weight slot alignment */}
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 26 }}>
          <AddSetButton
            onPress={onAddSet}
            disabled={addSetDisabled}
            setCount={setCount}
          />
        </View>
      </View>
    </View>
  );
}

function EnablePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}${active ? ' (active)' : ''}`}
      accessibilityHint="Tap to cycle through options"
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: active ? alpha(t['brand-primary'], 0.15) : '#1a1a1a',
        ...Platform.select({
          web: webStyle({
            boxShadow: active
              ? [
                  `0 1px 2px ${alpha('#000', 0.4)}`,
                  `inset 0 1px 0 ${alpha(t['brand-primary'], 0.15)}`,
                ].join(', ')
              : [
                  `inset 0 1px 3px ${alpha('#000', 0.4)}`,
                  `0 1px 0 ${alpha('#fff', 0.04)}`,
                ].join(', '),
          }),
          default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: active ? 1 : 0 },
            shadowOpacity: active ? 0.3 : 0,
            shadowRadius: active ? 2 : 0,
          },
        }),
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: active ? '700' : '500',
          color: active ? t['brand-primary'] : t['text-disabled'],
          ...Platform.select({
            web: active ? webStyle({
              textShadow: `0 0 8px ${alpha(t['brand-primary'], 0.4)}`,
            }) : webStyle({}),
            default: {},
          }),
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function dashZero(v: number): string {
  return v === 0 ? '–' : String(v);
}
