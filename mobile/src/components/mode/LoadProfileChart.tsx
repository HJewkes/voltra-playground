/**
 * LoadProfileChart
 *
 * Interactive SVG chart showing a full rep: concentric (lift) then eccentric (lower).
 * X-axis = rep timeline (Start → Top → End), so you see the chains slope
 * and the eccentric jump at the turnaround point.
 *
 * Three drag handles:
 * - Left: base weight (moves the whole profile up/down)
 * - Middle (turnaround): chains/inverse chains (tilts the concentric slope)
 * - Right area: eccentric offset
 */

import React, { useRef, useMemo } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Line, Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

const PADDING = { top: 24, right: 32, bottom: 28, left: 48 };
const HANDLE_RADIUS = 10;
const HANDLE_HIT_SLOP = 30;

interface LoadProfileChartProps {
  baseWeight: number;
  chains: number;
  inverseChains: number;
  eccentric: number;
  onBaseWeightChange: (lbs: number) => void;
  onBaseWeightCommit: (lbs: number) => void;
  onChainsChange: (lbs: number) => void;
  onInverseChainsChange: (lbs: number) => void;
  onEccentricChange: (pct: number) => void;
  onChainsCommit: (lbs: number) => Promise<void>;
  onInverseChainsCommit: (lbs: number) => Promise<void>;
  onEccentricCommit: (pct: number) => Promise<void>;
  width: number;
  height: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function roundToStep(v: number, step: number) {
  return Math.round(v / step) * step;
}

export function LoadProfileChart({
  baseWeight,
  chains,
  inverseChains,
  eccentric,
  onBaseWeightChange,
  onBaseWeightCommit,
  onChainsChange,
  onInverseChainsChange,
  onEccentricChange,
  onChainsCommit,
  onInverseChainsCommit,
  onEccentricCommit,
  width,
  height,
}: LoadProfileChartProps) {
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const chainValue = inverseChains > 0 ? inverseChains : chains;
  const isInverse = inverseChains > 0;

  // Load at bottom and top of ROM
  const conBottom = isInverse ? baseWeight : baseWeight + chainValue;
  const conTop = isInverse ? baseWeight + chainValue : baseWeight;

  const eccMultiplier = 1 + eccentric / 100;
  const eccBottom = conBottom * eccMultiplier;
  const eccTop = conTop * eccMultiplier;

  // Y-axis: 0 minimum, ceiling accommodates max possible chains + eccentric at current weight
  // so handles always have room to reach their SDK caps without rescaling
  const maxConLoad = baseWeight + 100; // max chains on current weight
  const maxEccLoad = maxConLoad * (1 + 195 / 100); // max eccentric on top of that
  const yMin = 0;
  const yMax = Math.max(220, maxEccLoad * 1.05);

  const xScale = (pos: number) => PADDING.left + pos * chartW;
  const yScale = (lbs: number) => PADDING.top + ((yMax - lbs) / (yMax - yMin)) * chartH;
  const yInvert = (py: number) => yMax - ((py - PADDING.top) / chartH) * (yMax - yMin);

  // Rep timeline: concentric (left half) then eccentric (right half)
  const conStartX = xScale(0);
  const midX = xScale(0.5);
  const eccEndX = xScale(1);

  const conStartY = yScale(conBottom);
  const conEndY = yScale(conTop);
  const eccStartY = yScale(eccTop);
  const eccEndY = yScale(eccBottom);

  const baselineY = yScale(baseWeight);
  const hasEccentric = eccentric !== 0;

  const fillPath = hasEccentric
    ? `M ${conStartX} ${conStartY} L ${midX} ${conEndY} L ${midX} ${eccStartY} L ${eccEndX} ${eccEndY} L ${eccEndX} ${yScale(conBottom)} L ${conStartX} ${conStartY} Z`
    : '';

  // Handle positions
  const loadHandleX = conStartX;
  const loadHandleY = conStartY;

  const chainsHandleX = midX;
  const chainsHandleY = conEndY;

  const eccHandleX = xScale(0.75);
  const eccHandleMidLoad = (eccTop + eccBottom) / 2;
  const eccHandleY = yScale(eccHandleMidLoad);

  const propsRef = useRef({
    baseWeight,
    chains,
    inverseChains,
    eccentric,
    loadHandleX,
    loadHandleY,
    chainsHandleX,
    chainsHandleY,
    eccHandleX,
    eccHandleY,
    eccBottom,
    eccTop,
    conBottom,
    conTop,
    yScale,
    yInvert,
    onBaseWeightChange,
    onBaseWeightCommit,
    onChainsChange,
    onInverseChainsChange,
    onEccentricChange,
    onChainsCommit,
    onInverseChainsCommit,
    onEccentricCommit,
  });
  propsRef.current = {
    baseWeight,
    chains,
    inverseChains,
    eccentric,
    loadHandleX,
    loadHandleY,
    chainsHandleX,
    chainsHandleY,
    eccHandleX,
    eccHandleY,
    eccBottom,
    eccTop,
    conBottom,
    conTop,
    yScale,
    yInvert,
    onBaseWeightChange,
    onBaseWeightCommit,
    onChainsChange,
    onInverseChainsChange,
    onEccentricChange,
    onChainsCommit,
    onInverseChainsCommit,
    onEccentricCommit,
  };

  const dragging = useRef<'load' | 'chains' | 'eccentric' | null>(null);
  const startHandleY = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const p = propsRef.current;

          const distLoad = Math.sqrt(
            (locationX - p.loadHandleX) ** 2 + (locationY - p.loadHandleY) ** 2
          );
          const distChains = Math.sqrt(
            (locationX - p.chainsHandleX) ** 2 + (locationY - p.chainsHandleY) ** 2
          );
          const distEcc = Math.sqrt(
            (locationX - p.eccHandleX) ** 2 + (locationY - p.eccHandleY) ** 2
          );

          const minDist = Math.min(distLoad, distChains, distEcc);

          if (minDist > HANDLE_HIT_SLOP) {
            dragging.current = null;
          } else if (minDist === distLoad) {
            dragging.current = 'load';
            startHandleY.current = p.loadHandleY;
          } else if (minDist === distChains) {
            dragging.current = 'chains';
            startHandleY.current = p.chainsHandleY;
          } else {
            dragging.current = 'eccentric';
            startHandleY.current = p.eccHandleY;
          }
        },

        onPanResponderMove: (_, gesture) => {
          if (!dragging.current) return;
          const p = propsRef.current;
          const handleY = startHandleY.current + gesture.dy;

          if (dragging.current === 'load') {
            const newLoad = p.yInvert(handleY);
            const clamped = clamp(roundToStep(newLoad, 1), 5, 200);
            p.onBaseWeightChange(clamped);
          } else if (dragging.current === 'chains') {
            const loadAtTop = p.yInvert(handleY);
            const diff = loadAtTop - p.baseWeight;

            if (diff >= 0) {
              const clamped = clamp(roundToStep(diff, 1), 0, 100);
              p.onInverseChainsChange(clamped);
              if (p.chains > 0) p.onChainsChange(0);
            } else {
              const clamped = clamp(roundToStep(-diff, 1), 0, 100);
              p.onChainsChange(clamped);
              if (p.inverseChains > 0) p.onInverseChainsChange(0);
            }
          } else if (dragging.current === 'eccentric') {
            const conMidLoad = (p.conBottom + p.conTop) / 2;
            const eccLoadAtMid = p.yInvert(handleY);

            if (conMidLoad > 0) {
              const newEcc = (eccLoadAtMid / conMidLoad - 1) * 100;
              const clamped = clamp(roundToStep(newEcc, 5), -195, 195);
              p.onEccentricChange(clamped);
            }
          }
        },

        onPanResponderRelease: () => {
          const p = propsRef.current;
          if (dragging.current === 'load') {
            p.onBaseWeightCommit(p.baseWeight);
          } else if (dragging.current === 'chains') {
            if (p.inverseChains > 0) {
              p.onInverseChainsCommit(p.inverseChains);
            } else {
              p.onChainsCommit(p.chains);
            }
          } else if (dragging.current === 'eccentric') {
            p.onEccentricCommit(p.eccentric);
          }
          dragging.current = null;
        },

        onPanResponderTerminate: () => {
          dragging.current = null;
        },
      }),
    []
  );

  const yTicks = computeYTicks(yMin, yMax, 4);

  const loadLabel = `${baseWeight} lbs`;

  const chainLabel = chainValue > 0 ? `${chainValue} lbs ${isInverse ? 'inv' : ''}` : '';

  const eccLabel = eccentric !== 0 ? `${eccentric > 0 ? '+' : ''}${eccentric}%` : '';

  return (
    <View>
      <View {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="eccFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t['status-info']} stopOpacity={0.2} />
              <Stop offset="1" stopColor={t['status-info']} stopOpacity={0.05} />
            </LinearGradient>
          </Defs>

          {/* Chart background */}
          <Rect
            x={PADDING.left}
            y={PADDING.top}
            width={chartW}
            height={chartH}
            fill={alpha(t['surface-elevated'], 0.3)}
            rx={4}
          />

          {/* Y-axis grid lines */}
          {yTicks.map((tick) => (
            <Line
              key={tick}
              x1={PADDING.left}
              y1={yScale(tick)}
              x2={eccEndX}
              y2={yScale(tick)}
              stroke={alpha(t['border-strong'], 0.3)}
              strokeWidth={0.5}
            />
          ))}

          {/* Midpoint vertical divider (turnaround) */}
          <Line
            x1={midX}
            y1={PADDING.top}
            x2={midX}
            y2={PADDING.top + chartH}
            stroke={alpha(t['border-strong'], 0.2)}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />

          {/* Base weight dashed reference line */}
          <Line
            x1={conStartX}
            y1={baselineY}
            x2={eccEndX}
            y2={baselineY}
            stroke={alpha(t['text-tertiary'], 0.5)}
            strokeWidth={1}
            strokeDasharray="6,4"
          />

          {/* Eccentric fill band */}
          {hasEccentric && <Path d={fillPath} fill="url(#eccFill)" />}

          {/* Concentric line (orange) — left half: bottom→top */}
          <Line
            x1={conStartX}
            y1={conStartY}
            x2={midX}
            y2={conEndY}
            stroke={t['brand-primary']}
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Eccentric line (blue) — right half: top→bottom */}
          {hasEccentric ? (
            <Line
              x1={midX}
              y1={eccStartY}
              x2={eccEndX}
              y2={eccEndY}
              stroke={t['status-info']}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6,3"
            />
          ) : (
            <Line
              x1={midX}
              y1={conEndY}
              x2={eccEndX}
              y2={conStartY}
              stroke={alpha(t['brand-primary'], 0.4)}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="4,3"
            />
          )}

          {/* Jump line at turnaround (concentric top → eccentric top) */}
          {hasEccentric && (
            <Line
              x1={midX}
              y1={conEndY}
              x2={midX}
              y2={eccStartY}
              stroke={t['status-info']}
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          )}

          {/* Load drag handle (left edge — base weight) */}
          <Circle
            cx={loadHandleX}
            cy={loadHandleY}
            r={HANDLE_RADIUS}
            fill={t['text-primary']}
            stroke={t['surface-elevated']}
            strokeWidth={2}
          />

          {/* Chains drag handle (turnaround — middle) */}
          <Circle
            cx={chainsHandleX}
            cy={chainsHandleY}
            r={HANDLE_RADIUS}
            fill={t['brand-primary']}
            stroke={t['surface-elevated']}
            strokeWidth={2}
          />

          {/* Eccentric drag handle (midpoint of eccentric phase) */}
          <Circle
            cx={eccHandleX}
            cy={eccHandleY}
            r={HANDLE_RADIUS}
            fill={eccentric !== 0 ? t['status-info'] : alpha(t['status-info'], 0.5)}
            stroke={t['surface-elevated']}
            strokeWidth={2}
          />

          {/* End dot */}
          <Circle
            cx={eccEndX}
            cy={hasEccentric ? eccEndY : conStartY}
            r={4}
            fill={hasEccentric ? t['status-info'] : alpha(t['brand-primary'], 0.4)}
          />
        </Svg>

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <View
            key={tick}
            style={{
              position: 'absolute',
              left: 0,
              top: yScale(tick) - 8,
              width: PADDING.left - 6,
              alignItems: 'flex-end',
            }}
          >
            <Text style={{ fontSize: 12, color: t['text-disabled'] }}>{Math.round(tick)}</Text>
          </View>
        ))}

        {/* X-axis labels */}
        <View
          style={{
            position: 'absolute',
            bottom: 4,
            left: PADDING.left,
            right: PADDING.right,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 10, color: t['text-disabled'] }}>Start</Text>
          <Text style={{ fontSize: 10, color: t['text-disabled'] }}>Top</Text>
          <Text style={{ fontSize: 10, color: t['text-disabled'] }}>End</Text>
        </View>

        {/* Load handle label */}
        <View
          style={{
            position: 'absolute',
            left: loadHandleX + HANDLE_RADIUS + 6,
            top: loadHandleY - 8,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: t['text-primary'],
              fontWeight: '600',
            }}
          >
            {loadLabel}
          </Text>
        </View>

        {/* Chains handle label */}
        {chainLabel !== '' && (
          <View
            style={{
              position: 'absolute',
              left: chainsHandleX - 50,
              top: chainsHandleY - HANDLE_RADIUS - 16,
              width: 100,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: t['brand-primary'],
                fontWeight: '600',
              }}
            >
              {chainLabel}
            </Text>
          </View>
        )}

        {/* Eccentric handle label */}
        {eccLabel !== '' && (
          <View
            style={{
              position: 'absolute',
              left: eccHandleX + HANDLE_RADIUS + 6,
              top: eccHandleY - 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: t['status-info'],
                fontWeight: '600',
              }}
            >
              {eccLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function computeYTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const rawStep = range / count;

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceStep: number;
  if (normalized <= 1.5) niceStep = magnitude;
  else if (normalized <= 3.5) niceStep = 2 * magnitude;
  else if (normalized <= 7.5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks: number[] = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let v = start; v <= max; v += niceStep) {
    ticks.push(v);
  }
  return ticks;
}
