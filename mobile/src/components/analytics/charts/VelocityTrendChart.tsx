/**
 * Velocity Trend Chart
 * 
 * Mini chart showing velocity progression across reps with trend coloring.
 */

import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

export interface VelocityTrendChartProps {
  /** Array of velocity values for each rep */
  velocities: number[];
  /** Chart width */
  width: number;
  /** Chart height */
  height: number;
}

/**
 * VelocityTrendChart component - mini chart for velocity trends.
 * 
 * @example
 * ```tsx
 * <VelocityTrendChart
 *   velocities={[0.8, 0.75, 0.7, 0.65, 0.6]}
 *   width={120}
 *   height={40}
 * />
 * ```
 */
export function VelocityTrendChart({ velocities, width, height }: VelocityTrendChartProps) {
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const { path, dots, trendColor } = useMemo((): { path: string; dots: { x: number; y: number }[]; trendColor: string } => {
    if (velocities.length === 0) {
      return { path: '', dots: [], trendColor: colors.success.DEFAULT };
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
    
    let color: string = colors.success.DEFAULT;
    if (velocityLoss > 0.3) {
      color = colors.danger.DEFAULT;
    } else if (velocityLoss > 0.15) {
      color = colors.primary[500];
    } else if (velocityLoss > 0) {
      color = colors.warning.DEFAULT;
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
