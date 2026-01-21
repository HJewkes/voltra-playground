/**
 * Force Curve Chart
 *
 * Real-time visualization of force data during a rep.
 * Dark mode neumorphic design.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import { MovementPhase, type WorkoutSample } from '@/domain/workout';
import { colors } from '@/theme';

interface ForceCurveChartProps {
  /** Recent samples to display */
  samples: WorkoutSample[];
  /** Chart width */
  width: number;
  /** Chart height */
  height: number;
  /** Max samples to show (rolling window) */
  maxSamples?: number;
}

/**
 * Real-time force curve visualization.
 */
export function ForceCurveChart({
  samples,
  width,
  height,
  maxSamples = 100,
}: ForceCurveChartProps) {
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const recentSamples = samples.slice(-maxSamples);

  const { minForce, maxForce, forcePath, phaseBands } = useMemo(() => {
    if (recentSamples.length === 0) {
      return { minForce: -500, maxForce: 500, forcePath: '', phaseBands: [] };
    }

    const forces = recentSamples.map((s) => s.force);
    const min = Math.min(...forces, -100);
    const max = Math.max(...forces, 100);

    const range = max - min || 200;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;

    const xScale = chartWidth / Math.max(recentSamples.length - 1, 1);
    const yScale = chartHeight / (paddedMax - paddedMin);

    let path = '';
    recentSamples.forEach((sample, i) => {
      const x = padding.left + i * xScale;
      const y = padding.top + (paddedMax - sample.force) * yScale;

      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    const bands: { x: number; width: number; phase: MovementPhase }[] = [];
    let bandStart = 0;
    let currentPhase = recentSamples[0]?.phase;

    recentSamples.forEach((sample, i) => {
      if (sample.phase !== currentPhase || i === recentSamples.length - 1) {
        const endIdx = i === recentSamples.length - 1 ? i + 1 : i;
        bands.push({
          x: padding.left + bandStart * xScale,
          width: (endIdx - bandStart) * xScale,
          phase: currentPhase,
        });
        bandStart = i;
        currentPhase = sample.phase;
      }
    });

    return { minForce: paddedMin, maxForce: paddedMax, forcePath: path, phaseBands: bands };
  }, [recentSamples, chartWidth, chartHeight, padding.left, padding.top]);

  const getPhaseColor = (phase: MovementPhase) => {
    switch (phase) {
      case MovementPhase.CONCENTRIC:
        return colors.success.DEFAULT + '25';
      case MovementPhase.HOLD:
        return colors.warning.DEFAULT + '25';
      case MovementPhase.ECCENTRIC:
        return colors.info.DEFAULT + '25';
      default:
        return colors.surface.light + '30';
    }
  };

  const zeroY = padding.top + (maxForce / (maxForce - minForce)) * chartHeight;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Phase background bands */}
        {phaseBands.map((band, i) => (
          <Rect
            key={i}
            x={band.x}
            y={padding.top}
            width={band.width}
            height={chartHeight}
            fill={getPhaseColor(band.phase)}
          />
        ))}

        {/* Zero line */}
        <Line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke={colors.surface.light}
          strokeWidth={1}
          strokeDasharray="4,4"
        />

        {/* Force curve - orange primary */}
        {forcePath && (
          <Path d={forcePath} stroke={colors.primary[500]} strokeWidth={2.5} fill="none" />
        )}

        {/* Y-axis */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke={colors.surface.light}
          strokeWidth={1}
        />
      </Svg>

      {/* Axis labels */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: padding.top,
          width: padding.left - 4,
          alignItems: 'flex-end',
        }}
      >
        <Text style={{ fontSize: 10, color: colors.text.muted }}>{Math.round(maxForce)}</Text>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: padding.bottom,
          width: padding.left - 4,
          alignItems: 'flex-end',
        }}
      >
        <Text style={{ fontSize: 10, color: colors.text.muted }}>{Math.round(minForce)}</Text>
      </View>
    </View>
  );
}
