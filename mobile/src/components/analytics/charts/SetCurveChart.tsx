/**
 * Set Curve Chart
 *
 * Full-set visualization with signal selection (velocity/force/position).
 * X-axis is time-based, pre-stubbed to expected duration, expanding if exceeded.
 * When velocity is selected, peak and avg velocity are shown as overlay labels.
 */

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import { MovementPhase, type WorkoutSample } from '@/domain/workout';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { CycleToggle, type CycleToggleOption } from '@/components/exercise/CycleToggle';

const t = getSemanticColors('dark');

const SAMPLE_INTERVAL_MS = 91;
const DEFAULT_EXPECTED_MS = 30_000;

export const SIGNAL_OPTIONS: readonly CycleToggleOption<ChartSignal>[] = [
  { value: 'velocity', label: 'Velocity' },
  { value: 'force', label: 'Force' },
  { value: 'position', label: 'Position' },
];

export type ChartSignal = 'velocity' | 'force' | 'position';

interface SetCurveChartProps {
  samples: WorkoutSample[];
  width: number;
  height: number;
  expectedDurationMs?: number;
  /** When provided, signal is externally controlled (no internal toggle rendered) */
  signal?: ChartSignal;
}

const SIGNAL_CONFIG: Record<ChartSignal, {
  label: string;
  getValue: (s: WorkoutSample) => number;
  unit: string;
  color: string;
  defaultMin: number;
  defaultMax: number;
  floorAtZero: boolean;
}> = {
  velocity: {
    label: 'Velocity',
    getValue: (s) => s.velocity,
    unit: 'm/s',
    color: t['status-success'],
    defaultMin: 0,
    defaultMax: 0.5,
    floorAtZero: true,
  },
  force: {
    label: 'Force',
    getValue: (s) => s.force,
    unit: 'lbs',
    color: t['brand-primary'],
    defaultMin: 0,
    defaultMax: 50,
    floorAtZero: true,
  },
  position: {
    label: 'Position',
    getValue: (s) => s.position,
    unit: 'mm',
    color: t['status-info'],
    defaultMin: 0,
    defaultMax: 0.5,
    floorAtZero: true,
  },
};

export function SetCurveChart({
  samples,
  width,
  height,
  expectedDurationMs = DEFAULT_EXPECTED_MS,
  signal: externalSignal,
}: SetCurveChartProps) {
  const [internalSignal, setInternalSignal] = useState<ChartSignal>('velocity');
  const signal = externalSignal ?? internalSignal;
  const showToggle = !externalSignal;
  const config = SIGNAL_CONFIG[signal];

  const selectorHeight = 32;
  const svgHeight = height - selectorHeight;
  const padding = { top: 8, right: 10, bottom: 18, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const computed = useMemo(() => {
    if (samples.length === 0) {
      return {
        minVal: config.defaultMin,
        maxVal: config.defaultMax,
        dataPath: '',
        phaseBands: [] as { x: number; width: number; phase: MovementPhase }[],
        totalDurationMs: expectedDurationMs,
        elapsedMs: 0,
        playheadX: padding.left,
      };
    }

    const startTime = samples[0].timestamp;
    const elapsedMs = samples[samples.length - 1].timestamp - startTime;
    const totalDurationMs = Math.max(expectedDurationMs, elapsedMs + SAMPLE_INTERVAL_MS * 5);
    const msToX = (ms: number) => padding.left + (ms / totalDurationMs) * chartWidth;

    // Value range — scale to actual data, floor at 0 for force/velocity/position
    const values = samples.map(config.getValue);
    const rawMin = config.floorAtZero ? 0 : Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin || 0.1;
    const minVal = rawMin;
    const maxVal = rawMax + range * 0.1;
    const yScale = chartHeight / (maxVal - minVal);
    const valToY = (v: number) => padding.top + (maxVal - v) * yScale;

    // Data path
    let path = '';
    samples.forEach((sample, i) => {
      const x = msToX(sample.timestamp - startTime);
      const y = valToY(config.getValue(sample));
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    // Phase bands
    const bands: { x: number; width: number; phase: MovementPhase }[] = [];
    let bandStartMs = 0;
    let currentPhase = samples[0].phase;

    samples.forEach((sample, i) => {
      const sampleMs = sample.timestamp - startTime;
      if (sample.phase !== currentPhase || i === samples.length - 1) {
        const endMs = i === samples.length - 1 ? sampleMs + SAMPLE_INTERVAL_MS : sampleMs;
        bands.push({
          x: msToX(bandStartMs),
          width: msToX(endMs) - msToX(bandStartMs),
          phase: currentPhase,
        });
        bandStartMs = sampleMs;
        currentPhase = sample.phase;
      }
    });

    return {
      minVal,
      maxVal,
      dataPath: path,
      phaseBands: bands,
      totalDurationMs,
      elapsedMs,
      playheadX: msToX(elapsedMs),
    };
  }, [samples, chartWidth, chartHeight, expectedDurationMs, padding.left, padding.top, config]);

  const { minVal, maxVal, dataPath, phaseBands, playheadX, elapsedMs, totalDurationMs } = computed;

  const getPhaseColor = (phase: MovementPhase) => {
    switch (phase) {
      case MovementPhase.CONCENTRIC:
        return alpha(t['status-success'], 0.12);
      case MovementPhase.HOLD:
        return alpha(t['status-warning'], 0.12);
      case MovementPhase.ECCENTRIC:
        return alpha(t['status-info'], 0.12);
      default:
        return alpha(t['border-strong'], 0.06);
    }
  };

  const elapsedSec = Math.round(elapsedMs / 1000);
  const totalSec = Math.round(totalDurationMs / 1000);

  return (
    <View>
      {/* Signal toggle (only when not externally controlled) */}
      {showToggle && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: selectorHeight }}>
          <CycleToggle
            options={SIGNAL_OPTIONS}
            value={signal}
            onChange={setInternalSignal}
            activeColor={config.color}
          />
        </View>
      )}

      {/* Chart */}
      <View>
        <Svg width={width} height={svgHeight}>
          {/* Unfilled expected area */}
          <Rect
            x={playheadX}
            y={padding.top}
            width={Math.max(0, width - padding.right - playheadX)}
            height={chartHeight}
            fill={alpha('#fff', 0.02)}
          />

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

          {/* Data curve */}
          {dataPath && (
            <Path d={dataPath} stroke={config.color} strokeWidth={2} fill="none" />
          )}

          {/* Playhead */}
          {samples.length > 0 && (
            <Line
              x1={playheadX}
              y1={padding.top}
              x2={playheadX}
              y2={svgHeight - padding.bottom}
              stroke={alpha(t['brand-primary'], 0.4)}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {/* Y-axis */}
          <Line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={svgHeight - padding.bottom}
            stroke={t['border-strong']}
            strokeWidth={1}
          />

          {/* X-axis */}
          <Line
            x1={padding.left}
            y1={svgHeight - padding.bottom}
            x2={width - padding.right}
            y2={svgHeight - padding.bottom}
            stroke={t['border-strong']}
            strokeWidth={1}
          />
        </Svg>

        {/* Y-axis labels */}
        <View style={{ position: 'absolute', left: 0, top: padding.top, width: padding.left - 4, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>
            {signal === 'velocity' ? maxVal.toFixed(1) : Math.round(maxVal)}
          </Text>
        </View>
        <View style={{ position: 'absolute', left: 0, bottom: padding.bottom, width: padding.left - 4, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>
            {signal === 'velocity' ? minVal.toFixed(1) : Math.round(minVal)}
          </Text>
        </View>

        {/* Time labels */}
        <View style={{
          position: 'absolute',
          bottom: 1,
          left: padding.left,
          right: padding.right,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>0s</Text>
          {samples.length > 0 && elapsedSec < totalSec - 1 && (
            <Text style={{ fontSize: 9, color: t['text-tertiary'] }}>{elapsedSec}s</Text>
          )}
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>{totalSec}s</Text>
        </View>
      </View>
    </View>
  );
}
