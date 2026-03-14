/**
 * CoachingCueCard
 *
 * Displays an AI coaching cue during rest periods.
 * Color-coded by type: blue (informational), orange (load adjustment),
 * green (encouragement). Includes auto-dismiss timer and quick-react buttons.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, HStack, getSemanticColors, alpha } from '@titan-design/react-ui';
import type { CoachingCue, CoachingCueType, AthleteReaction } from '@/stores';

const t = getSemanticColors('dark');

const AUTO_DISMISS_MS = 15_000;

// =============================================================================
// Color Config
// =============================================================================

interface CueColorConfig {
  bg: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CUE_COLORS: Record<CoachingCueType, CueColorConfig> = {
  informational: {
    bg: alpha(t['brand-primary'] ?? '#3B82F6', 0.12),
    accent: t['brand-primary'] ?? '#3B82F6',
    icon: 'information-circle',
  },
  load_adjustment: {
    bg: alpha(t['status-warning'] ?? '#F59E0B', 0.12),
    accent: t['status-warning'] ?? '#F59E0B',
    icon: 'barbell',
  },
  encouragement: {
    bg: alpha(t['status-success'] ?? '#10B981', 0.12),
    accent: t['status-success'] ?? '#10B981',
    icon: 'flame',
  },
};

// =============================================================================
// Props
// =============================================================================

export interface CoachingCueCardProps {
  cue: CoachingCue;
  onDismiss: () => void;
  onReact: (cueId: string, reaction: AthleteReaction) => void;
}

// =============================================================================
// Component
// =============================================================================

export function CoachingCueCard({ cue, onDismiss, onReact }: CoachingCueCardProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colors = CUE_COLORS[cue.type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [slideAnim, opacityAnim, onDismiss]);

  const handleReact = useCallback(
    (reaction: AthleteReaction) => {
      onReact(cue.id, reaction);
    },
    [cue.id, onReact],
  );

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      <Card elevation={2} style={{ backgroundColor: colors.bg }}>
        <CardContent>
          {/* Header row: icon + dismiss */}
          <HStack align="center" gap={10}>
            <Ionicons name={colors.icon} size={24} color={colors.accent} />
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>
                {cue.type === 'load_adjustment' ? 'Load Adjustment' : cue.type === 'encouragement' ? 'Coach' : 'Insight'}
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={t['text-disabled']} />
            </TouchableOpacity>
          </HStack>

          {/* Message */}
          <Text className="mt-2 text-sm leading-5 text-text-primary">{cue.message}</Text>

          {/* Suggested weight (for load adjustments) */}
          {cue.type === 'load_adjustment' && cue.suggestedWeight != null && (
            <View
              className="mt-2 self-start rounded-lg px-3 py-1"
              style={{ backgroundColor: alpha(colors.accent, 0.15) }}
            >
              <Text className="text-sm font-bold" style={{ color: colors.accent }}>
                Suggested: {cue.suggestedWeight} lbs
              </Text>
            </View>
          )}

          {/* Quick-react buttons */}
          <HStack align="center" gap={12} style={{ marginTop: 12 }}>
            <TouchableOpacity
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{
                backgroundColor:
                  cue.reaction === 'thumbs_up' ? alpha(t['status-success'], 0.2) : alpha(t['text-disabled'], 0.1),
              }}
              onPress={() => handleReact(cue.reaction === 'thumbs_up' ? null : 'thumbs_up')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cue.reaction === 'thumbs_up' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={16}
                color={cue.reaction === 'thumbs_up' ? t['status-success'] : t['text-disabled']}
              />
              <Text
                className="ml-1 text-xs font-medium"
                style={{ color: cue.reaction === 'thumbs_up' ? t['status-success'] : t['text-disabled'] }}
              >
                Helpful
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{
                backgroundColor:
                  cue.reaction === 'thumbs_down' ? alpha(t['status-error'], 0.2) : alpha(t['text-disabled'], 0.1),
              }}
              onPress={() => handleReact(cue.reaction === 'thumbs_down' ? null : 'thumbs_down')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cue.reaction === 'thumbs_down' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={16}
                color={cue.reaction === 'thumbs_down' ? t['status-error'] : t['text-disabled']}
              />
              <Text
                className="ml-1 text-xs font-medium"
                style={{ color: cue.reaction === 'thumbs_down' ? t['status-error'] : t['text-disabled'] }}
              >
                Not useful
              </Text>
            </TouchableOpacity>
          </HStack>
        </CardContent>
      </Card>
    </Animated.View>
  );
}
