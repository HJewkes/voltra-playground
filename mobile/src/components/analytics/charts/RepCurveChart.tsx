/**
 * Rep Curve Chart
 *
 * Per-rep visualization showing the current rep's signal trace with phase
 * timing bands as the primary visual element. Phase headers display elapsed
 * (and optionally target) durations with pacing color feedback.
 */

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { MovementPhase, type WorkoutSample, type TempoTarget } from '@/domain/workout';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { CycleToggle, type CycleToggleOption } from '@/components/exercise/CycleToggle';
import { TEMPO_PACING } from '@/components/exercise/TempoBar';

const t = getSemanticColors('dark');

const SAMPLE_INTERVAL_MS = 91;

type ChartSignal = 'velocity' | 'force' | 'position';

const SIGNAL_OPTIONS: readonly CycleToggleOption<ChartSignal>[] = [
  { value: 'velocity', label: 'Velocity' },
  { value: 'force', label: 'Force' },
  { value: 'position', label: 'Position' },
];

const SIGNAL_CONFIG: Record<
  ChartSignal,
  {
    label: string;
    getValue: (s: WorkoutSample) => number;
    unit: string;
    color: string;
    defaultMin: number;
    defaultMax: number;
    floorAtZero: boolean;
  }
> = {
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

const PHASE_LABELS: Record<number, string> = {
  [MovementPhase.CONCENTRIC]: 'Con',
  [MovementPhase.HOLD]: 'Hold',
  [MovementPhase.ECCENTRIC]: 'Ecc',
};

const PHASE_COLORS: Record<number, string> = {
  [MovementPhase.CONCENTRIC]: t['status-success'],
  [MovementPhase.HOLD]: t['status-warning'],
  [MovementPhase.ECCENTRIC]: t['status-info'],
};

const TARGET_MAP: Record<number, keyof TempoTarget> = {
  [MovementPhase.CONCENTRIC]: 'concentric',
  [MovementPhase.HOLD]: 'pauseTop',
  [MovementPhase.ECCENTRIC]: 'eccentric',
};

interface RepCurveChartProps {
  samples: WorkoutSample[];
  width: number;
  height: number;
  repPhaseDurations: { phase: MovementPhase; durationMs: number }[];
  currentPhase: MovementPhase;
  phaseElapsedMs: number;
  targetTempo?: TempoTarget;
}

function findRepStartIndex(samples: WorkoutSample[]): number {
  for (let i = samples.length - 1; i > 0; i--) {
    if (
      samples[i].phase === MovementPhase.CONCENTRIC &&
      samples[i - 1].phase !== MovementPhase.CONCENTRIC
    ) {
      return i;
    }
  }
  return -1;
}

function formatPhaseMs(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? s.toFixed(1) : Math.round(s).toString();
}

function isBehindPace(elapsedMs: number, targetMs: number | null): boolean {
  if (!targetMs || targetMs < TEMPO_PACING.minPhaseDurationMs) return false;
  return elapsedMs / targetMs > 1 + TEMPO_PACING.behindThresholdPct;
}

function getPhaseTargetMs(phase: MovementPhase, tempo?: TempoTarget): number | null {
  if (!tempo) return null;
  const key = TARGET_MAP[phase];
  return key ? tempo[key] * 1000 : null;
}

interface PhaseBand {
  x: number;
  width: number;
  phase: MovementPhase;
  durationMs: number;
  isActive: boolean;
}

export function RepCurveChart({
  samples,
  width,
  height,
  repPhaseDurations,
  currentPhase,
  phaseElapsedMs,
  targetTempo,
}: RepCurveChartProps) {
  const [signal, setSignal] = useState<ChartSignal>('velocity');
  const config = SIGNAL_CONFIG[signal];

  const selectorHeight = 32;
  const labelRowHeight = 18;
  const svgHeight = height - selectorHeight - labelRowHeight;
  const padding = { top: 4, right: 10, bottom: 14, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const repStartIdx = useMemo(() => findRepStartIndex(samples), [samples]);
  const repSamples = useMemo(
    () => (repStartIdx >= 0 ? samples.slice(repStartIdx) : []),
    [samples, repStartIdx]
  );

  const isIdle = currentPhase === MovementPhase.IDLE && repSamples.length === 0;

  const computed = useMemo(() => {
    if (repSamples.length === 0) {
      return {
        minVal: config.defaultMin,
        maxVal: config.defaultMax,
        dataPath: '',
        phaseBands: [] as PhaseBand[],
        totalDurationMs: 0,
        elapsedMs: 0,
      };
    }

    const startTime = repSamples[0].timestamp;
    const elapsedMs = repSamples[repSamples.length - 1].timestamp - startTime + SAMPLE_INTERVAL_MS;
    const totalDurationMs = elapsedMs;
    const msToX = (ms: number) => padding.left + (ms / totalDurationMs) * chartWidth;

    const values = repSamples.map(config.getValue);
    const rawMin = config.floorAtZero ? 0 : Math.min(...values, config.defaultMin);
    const rawMax = Math.max(...values, config.defaultMax);
    const range = rawMax - rawMin || 1;
    const minVal = rawMin;
    const maxVal = rawMax + range * 0.05;
    const yScale = chartHeight / (maxVal - minVal);
    const valToY = (v: number) => padding.top + (maxVal - v) * yScale;

    let path = '';
    repSamples.forEach((sample, i) => {
      const x = msToX(sample.timestamp - startTime);
      const y = valToY(config.getValue(sample));
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    const bands: PhaseBand[] = [];
    let bandStartMs = 0;
    let bandPhase = repSamples[0].phase;

    repSamples.forEach((sample, i) => {
      const sampleMs = sample.timestamp - startTime;
      if (sample.phase !== bandPhase || i === repSamples.length - 1) {
        const endMs = i === repSamples.length - 1 ? sampleMs + SAMPLE_INTERVAL_MS : sampleMs;
        const dur = endMs - bandStartMs;
        const completed = repPhaseDurations.find((d) => d.phase === bandPhase);
        bands.push({
          x: msToX(bandStartMs),
          width: msToX(endMs) - msToX(bandStartMs),
          phase: bandPhase,
          durationMs: completed ? completed.durationMs : dur,
          isActive: i === repSamples.length - 1 && sample.phase === bandPhase,
        });
        if (sample.phase !== bandPhase) {
          bandStartMs = sampleMs;
          bandPhase = sample.phase;
        }
      }
    });

    return { minVal, maxVal, dataPath: path, phaseBands: bands, totalDurationMs, elapsedMs };
  }, [repSamples, chartWidth, chartHeight, padding.left, padding.top, config, repPhaseDurations]);

  const { minVal, maxVal, dataPath, phaseBands, elapsedMs } = computed;

  if (isIdle) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: t['text-disabled'] }}>Waiting for rep...</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Signal toggle */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          height: selectorHeight,
        }}
      >
        <CycleToggle
          options={SIGNAL_OPTIONS}
          value={signal}
          onChange={setSignal}
          activeColor={config.color}
        />
      </View>

      {/* Phase timing labels */}
      <View
        style={{
          flexDirection: 'row',
          height: labelRowHeight,
          marginLeft: padding.left,
          marginRight: padding.right,
        }}
      >
        {phaseBands.map((band, i) => {
          const targetMs = getPhaseTargetMs(band.phase, targetTempo);
          const displayMs = band.isActive ? phaseElapsedMs : band.durationMs;
          const behind = isBehindPace(displayMs, targetMs);
          const label = PHASE_LABELS[band.phase] ?? '';

          const timeStr =
            targetTempo && targetMs
              ? `${formatPhaseMs(displayMs)}/${formatPhaseMs(targetMs)}`
              : formatPhaseMs(displayMs);

          const labelColor = behind
            ? t['status-error']
            : (PHASE_COLORS[band.phase] ?? t['text-disabled']);

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: band.x - padding.left,
                width: band.width,
                alignItems: 'center',
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: labelColor }}>
                {label} {timeStr}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Chart */}
      <View>
        <Svg width={width} height={svgHeight}>
          {/* Phase background bands */}
          {phaseBands.map((band, i) => (
            <Rect
              key={i}
              x={band.x}
              y={padding.top}
              width={band.width}
              height={chartHeight}
              fill={alpha(PHASE_COLORS[band.phase] ?? t['border-strong'], 0.12)}
            />
          ))}

          {/* Data curve */}
          {dataPath !== '' && (
            <Path d={dataPath} stroke={config.color} strokeWidth={2} fill="none" />
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
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: padding.top,
            width: padding.left - 4,
            alignItems: 'flex-end',
          }}
        >
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>
            {signal === 'velocity' ? maxVal.toFixed(1) : Math.round(maxVal)}
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
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>
            {signal === 'velocity' ? minVal.toFixed(1) : Math.round(minVal)}
          </Text>
        </View>

        {/* Time labels */}
        <View
          style={{
            position: 'absolute',
            bottom: 1,
            left: padding.left,
            right: padding.right,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 9, color: t['text-disabled'] }}>0s</Text>
          {elapsedMs > 0 && (
            <Text style={{ fontSize: 9, color: t['text-tertiary'] }}>
              {formatPhaseMs(elapsedMs)}s
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
