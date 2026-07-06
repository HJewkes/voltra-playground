/**
 * ContextualTooltip
 *
 * A dismissible one-time tip card that teaches VBT concepts at the moment
 * they become relevant. Automatically marks the milestone as seen on dismiss.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import {
  isOnboardingMilestoneSeen,
  markOnboardingMilestoneSeen,
  type OnboardingMilestone,
} from '@/data/preferences';

const t = getSemanticColors('dark');

export interface ContextualTooltipProps {
  milestone: OnboardingMilestone;
  title: string;
  body: string;
  style?: StyleProp<ViewStyle>;
}

export function ContextualTooltip({ milestone, title, body, style }: ContextualTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isOnboardingMilestoneSeen(milestone).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, [milestone]);

  if (!visible) return null;

  function handleDismiss() {
    setVisible(false);
    markOnboardingMilestoneSeen(milestone);
  }

  return (
    <View
      className="rounded-xl px-4 py-3"
      style={[
        {
          backgroundColor: alpha(t['brand-primary'], 0.1),
          borderWidth: 1,
          borderColor: alpha(t['brand-primary'], 0.2),
        },
        style,
      ]}
    >
      <HStack align="start" justify="between" gap={10}>
        <Ionicons
          name="bulb-outline"
          size={18}
          color={t['brand-primary']}
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: t['text-primary'], marginBottom: 2 }}
          >
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: t['text-secondary'], lineHeight: 17 }}>{body}</Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityLabel="Got it"
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: t['brand-primary'] }}>Got it</Text>
        </Pressable>
      </HStack>
    </View>
  );
}
