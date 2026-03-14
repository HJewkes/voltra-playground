/**
 * ModeDrawer — dropdown overlay for switching training modes.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

import { TrainingMode, TrainingModeNames } from '@/domain/device';

const t = getSemanticColors('dark');

type IconName = keyof typeof Ionicons.glyphMap;

const MODE_META: Partial<Record<TrainingMode, { desc: string; icon: IconName }>> = {
  [TrainingMode.WeightTraining]: { desc: 'Free weights & cables', icon: 'barbell-outline' },
  [TrainingMode.ResistanceBand]: { desc: 'Elastic resistance', icon: 'fitness-outline' },
  [TrainingMode.Rowing]: { desc: 'Row machine simulation', icon: 'boat-outline' },
  [TrainingMode.Damper]: { desc: 'Fluid resistance', icon: 'water-outline' },
  [TrainingMode.Isokinetic]: { desc: 'Constant velocity', icon: 'speedometer-outline' },
  [TrainingMode.Isometric]: { desc: 'Static holds', icon: 'hand-left-outline' },
};

const TRAINING_MODES = Object.keys(MODE_META).map(Number) as TrainingMode[];

export { MODE_META };

export interface ModeDrawerProps {
  currentMode: TrainingMode;
  onSelect: (m: TrainingMode) => void;
  onClose: () => void;
}

export function ModeDrawer({ currentMode, onSelect, onClose }: ModeDrawerProps) {
  return (
    <>
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: alpha('#000', 0.4),
        }}
      />
      <View
        style={{
          zIndex: 11,
          backgroundColor: '#1a1a1a',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
          ...Platform.select({
            web: webStyle({
              boxShadow: `0 8px 24px ${alpha('#000', 0.5)}`,
            }),
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            },
          }),
        }}
      >
        <View className="flex-row flex-wrap gap-2">
          {TRAINING_MODES.map((modeValue) => {
            const isSelected = currentMode === modeValue;
            const meta = MODE_META[modeValue]!;
            return (
              <TouchableOpacity
                key={modeValue}
                onPress={() => onSelect(modeValue)}
                activeOpacity={0.7}
                style={{
                  width: '48%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? alpha(t['brand-primary'], 0.12)
                    : alpha('#fff', 0.04),
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: isSelected ? alpha(t['brand-primary'], 0.3) : 'transparent',
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons
                  name={meta.icon}
                  size={16}
                  color={isSelected ? t['brand-primary'] : t['text-secondary']}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: isSelected ? '700' : '600',
                      color: isSelected ? t['brand-primary'] : t['text-primary'],
                    }}
                  >
                    {TrainingModeNames[modeValue]}
                  </Text>
                  <Text style={{ fontSize: 9, color: t['text-tertiary'] }}>
                    {meta.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}
