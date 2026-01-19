/**
 * Force Curve Chart
 * 
 * Real-time visualization of force data during a rep.
 * Dark mode neumorphic design.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import type { TelemetryFrame } from '@/protocol/telemetry';
import { MovementPhase } from '@/protocol/constants';
import { colors } from '@/theme';

interface ForceCurveChartProps {
  /** Recent frames to display */
  frames: TelemetryFrame[];
  /** Chart width */
  width: number;
  /** Chart height */
  height: number;
  /** Max frames to show (rolling window) */
  maxFrames?: number;
}

/**
 * Real-time force curve visualization.
 */
export function ForceCurveChart({
  frames,
  width,
  height,
  maxFrames = 100,
}: ForceCurveChartProps) {
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const recentFrames = frames.slice(-maxFrames);
  
  const { minForce, maxForce, forcePath, phaseBands } = useMemo(() => {
    if (recentFrames.length === 0) {
      return { minForce: -500, maxForce: 500, forcePath: '', phaseBands: [] };
    }
    
    const forces = recentFrames.map(f => f.force);
    const min = Math.min(...forces, -100);
    const max = Math.max(...forces, 100);
    
    const range = max - min || 200;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;
    
    const xScale = chartWidth / Math.max(recentFrames.length - 1, 1);
    const yScale = chartHeight / (paddedMax - paddedMin);
    
    let path = '';
    recentFrames.forEach((frame, i) => {
      const x = padding.left + i * xScale;
      const y = padding.top + (paddedMax - frame.force) * yScale;
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    
    const bands: { x: number; width: number; phase: MovementPhase }[] = [];
    let bandStart = 0;
    let currentPhase = recentFrames[0]?.phase;
    
    recentFrames.forEach((frame, i) => {
      if (frame.phase !== currentPhase || i === recentFrames.length - 1) {
        const endIdx = i === recentFrames.length - 1 ? i + 1 : i;
        bands.push({
          x: padding.left + bandStart * xScale,
          width: (endIdx - bandStart) * xScale,
          phase: currentPhase,
        });
        bandStart = i;
        currentPhase = frame.phase;
      }
    });
    
    return { minForce: paddedMin, maxForce: paddedMax, forcePath: path, phaseBands: bands };
  }, [recentFrames, chartWidth, chartHeight, padding.left, padding.top]);
  
  const getPhaseColor = (phase: MovementPhase) => {
    switch (phase) {
      case MovementPhase.CONCENTRIC:
        return colors.success + '25';
      case MovementPhase.HOLD:
        return colors.warning + '25';
      case MovementPhase.ECCENTRIC:
        return colors.info + '25';
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
          <Path
            d={forcePath}
            stroke={colors.primary[500]}
            strokeWidth={2.5}
            fill="none"
          />
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
        <Text style={{ fontSize: 10, color: colors.text.muted }}>
          {Math.round(maxForce)}
        </Text>
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
        <Text style={{ fontSize: 10, color: colors.text.muted }}>
          {Math.round(minForce)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Velocity trend mini chart.
 * Shows velocity progression across reps with trend coloring.
 */
interface VelocityTrendProps {
  velocities: number[];
  width: number;
  height: number;
}

export function VelocityTrendChart({ velocities, width, height }: VelocityTrendProps) {
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const { path, dots, trendColor } = useMemo((): { path: string; dots: { x: number; y: number }[]; trendColor: string } => {
    if (velocities.length === 0) {
      return { path: '', dots: [], trendColor: colors.success };
    }
    
    const max = Math.max(...velocities, 1);
    const min = Math.min(...velocities, 0);
    const range = max - min || 1;
    
    const xScale = chartWidth / Math.max(velocities.length - 1, 1);
    const yScale = chartHeight / range;
    
    let pathStr = '';
    const dotPositions: { x: number; y: number }[] = [];
    
    velocities.forEach((vel, i) => {
      const x = padding + i * xScale;
      const y = padding + (max - vel) * yScale;
      
      dotPositions.push({ x, y });
      
      if (i === 0) {
        pathStr += `M ${x} ${y}`;
      } else {
        pathStr += ` L ${x} ${y}`;
      }
    });
    
    // Determine trend color based on velocity loss
    const velocityLoss = velocities.length >= 2 
      ? (velocities[0] - velocities[velocities.length - 1]) / velocities[0]
      : 0;
    
    let color: string = colors.success;
    if (velocityLoss > 0.3) {
      color = colors.danger;
    } else if (velocityLoss > 0.15) {
      color = colors.primary[500];
    } else if (velocityLoss > 0) {
      color = colors.warning;
    }
    
    return { path: pathStr, dots: dotPositions, trendColor: color };
  }, [velocities, chartWidth, chartHeight]);
  
  return (
    <Svg width={width} height={height}>
      {path && (
        <Path
          d={path}
          stroke={trendColor}
          strokeWidth={2.5}
          fill="none"
        />
      )}
      {dots.map((dot, i) => (
        <Rect
          key={i}
          x={dot.x - 4}
          y={dot.y - 4}
          width={8}
          height={8}
          rx={4}
          fill={trendColor}
        />
      ))}
    </Svg>
  );
}
