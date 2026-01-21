/**
 * RestTimer
 *
 * Countdown timer for rest periods between sets.
 * Dark mode neumorphic design with orange accents.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

interface RestTimerProps {
  /** Rest duration in seconds */
  duration: number;
  /** Called when timer completes */
  onComplete: () => void;
  /** Called when user skips the rest */
  onSkip?: () => void;
  /** Whether to auto-start */
  autoStart?: boolean;
  /** Label to show above timer */
  label?: string;
}

export function RestTimer({
  duration,
  onComplete,
  onSkip,
  autoStart = true,
  label = 'Rest',
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning) return;

    if (remaining <= 0) {
      Vibration.vibrate([0, 200, 100, 200]);
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setRemaining((r) => r - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [remaining, isRunning, onComplete]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    onSkip?.();
    onComplete();
  }, [onComplete, onSkip]);

  const handlePause = useCallback(() => {
    setIsRunning((r) => !r);
  }, []);

  const handleReset = useCallback(() => {
    setRemaining(duration);
    setIsRunning(true);
  }, [duration]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const progress = (remaining / duration) * 100;

  // Color based on time remaining
  const getTimeColor = () => {
    if (remaining <= 10) return colors.success.DEFAULT;
    if (remaining <= 30) return colors.warning.DEFAULT;
    return colors.text.primary;
  };

  return (
    <View className="items-center py-6">
      <Text
        className="mb-3 text-sm font-medium uppercase tracking-wider"
        style={{ color: colors.text.muted }}
      >
        {label}
      </Text>

      {/* Timer display */}
      <View className="items-center">
        <Text className="text-7xl font-bold" style={{ color: getTimeColor() }}>
          {timeDisplay}
        </Text>

        {/* Progress bar */}
        <View
          className="mt-4 h-2 w-48 overflow-hidden rounded-full"
          style={{ backgroundColor: colors.surface.dark }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: colors.primary[500],
            }}
          />
        </View>
      </View>

      {/* Controls */}
      <View className="mt-8 flex-row gap-4">
        <TouchableOpacity
          className="h-14 w-14 items-center justify-center rounded-full"
          style={[{ backgroundColor: colors.surface.card }]}
          onPress={handlePause}
          activeOpacity={0.7}
        >
          <Ionicons name={isRunning ? 'pause' : 'play'} size={24} color={colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity
          className="h-14 w-14 items-center justify-center rounded-full"
          style={[{ backgroundColor: colors.surface.card }]}
          onPress={handleReset}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={24} color={colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-2xl px-8 py-4"
          style={[{ backgroundColor: colors.primary[600] }]}
          onPress={handleSkip}
          activeOpacity={0.8}
        >
          <Text className="font-bold text-white">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Ready indicator when close to done */}
      {remaining <= 10 && remaining > 0 && (
        <Text className="mt-6 text-lg font-bold" style={{ color: colors.success.DEFAULT }}>
          Get ready!
        </Text>
      )}
    </View>
  );
}
