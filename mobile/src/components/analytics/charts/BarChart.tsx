/**
 * BarChart
 *
 * Generic vertical bar chart built on react-native-svg.
 * Supports labeled x-axis and optional value labels above bars.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export interface BarChartDataPoint {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  width: number;
  height: number;
  barColor?: string;
  showValues?: boolean;
}

/**
 * BarChart - vertical bar chart for volume trends.
 */
export function BarChart({
  data,
  width,
  height,
  barColor = t['brand-primary'],
  showValues = false,
}: BarChartProps) {
  const padding = { top: 20, right: 8, bottom: 40, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { bars } = useMemo(() => {
    if (data.length === 0) return { bars: [], maxValue: 0 };

    const max = Math.max(...data.map((d) => d.value), 1);
    const barWidth = Math.max((chartWidth / data.length) * 0.6, 4);
    const gap = (chartWidth - barWidth * data.length) / (data.length + 1);

    const computed = data.map((point, i) => {
      const x = padding.left + gap + i * (barWidth + gap);
      const barHeight = (point.value / max) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      return { x, y, width: barWidth, height: barHeight, ...point };
    });

    return { bars: computed, maxValue: max };
  }, [data, chartWidth, chartHeight, padding.left, padding.top]);

  if (data.length === 0) return null;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke={t['border-strong']}
          strokeWidth={1}
        />

        {/* Bars */}
        {bars.map((bar, i) => (
          <Rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={Math.max(bar.height, 1)}
            rx={3}
            fill={barColor}
            opacity={0.9}
          />
        ))}
      </Svg>

      {/* X-axis labels */}
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          left: padding.left,
          right: padding.right,
          flexDirection: 'row',
          justifyContent: 'space-around',
        }}
      >
        {data.map((point, i) => (
          <Text
            key={i}
            style={{
              fontSize: 9,
              color: t['text-disabled'],
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {point.label}
          </Text>
        ))}
      </View>

      {/* Value labels */}
      {showValues &&
        bars.map((bar, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: bar.y - 16,
              left: bar.x - 4,
              width: bar.width + 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 8, color: t['text-secondary'], fontWeight: '600' }}>
              {formatCompact(bar.value)}
            </Text>
          </View>
        ))}
    </View>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(Math.round(num));
}
