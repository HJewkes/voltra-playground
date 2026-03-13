import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

interface CircularTimerProps {
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Target time in ms (null = no target, don't show circle) */
  targetMs: number | null;
  /** Size in px */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
}

export function CircularTimer({
  elapsedMs,
  targetMs,
  size = 80,
  strokeWidth = 6,
}: CircularTimerProps) {
  if (!targetMs) {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: t['text-primary'] }}>
          {formatTime(elapsedMs)}
        </Text>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsedMs / targetMs);
  const overshot = elapsedMs > targetMs;
  const strokeDashoffset = circumference * (1 - progress);

  const circleColor = overshot ? t['status-error'] : t['brand-primary'];
  const trackColor = overshot ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.08)';

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={circleColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: overshot ? t['status-error'] : t['text-primary'],
        }}
      >
        {formatTime(elapsedMs)}
      </Text>
    </View>
  );
}

export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}

export function getProgress(elapsedMs: number, targetMs: number): number {
  return Math.min(1, elapsedMs / targetMs);
}

export function isOvershot(elapsedMs: number, targetMs: number): boolean {
  return elapsedMs > targetMs;
}
