/**
 * RepAggregator - computes RepMetrics from phases.
 *
 * Pure functions that take Phase objects and produce Rep metrics.
 * Hardware-agnostic: doesn't know where the phases came from.
 */
import type { Phase } from '@/domain/workout/models/phase';
import type { Rep, RepMetrics } from '@/domain/workout/models/rep';
import { createRep } from '@/domain/workout/models/rep';

export function aggregateRep(
  repNumber: number,
  concentric: Phase,
  eccentric: Phase,
  holdAtTop: Phase | null,
  holdAtBottom: Phase | null,
): Rep {
  const metrics = computeRepMetrics(concentric, eccentric, holdAtTop, holdAtBottom);
  return createRep(repNumber, concentric, eccentric, holdAtTop, holdAtBottom, metrics);
}

export function computeRepMetrics(
  concentric: Phase,
  eccentric: Phase,
  holdAtTop: Phase | null,
  holdAtBottom: Phase | null,
): RepMetrics {
  const concentricDuration = concentric.metrics.duration;
  const eccentricDuration = eccentric.metrics.duration;
  const topPauseTime = holdAtTop?.metrics.duration ?? 0;
  const bottomPauseTime = holdAtBottom?.metrics.duration ?? 0;

  return {
    totalDuration: concentricDuration + eccentricDuration + topPauseTime + bottomPauseTime,
    concentricDuration,
    eccentricDuration,
    topPauseTime,
    bottomPauseTime,
    tempo: formatTempo(eccentricDuration, topPauseTime, concentricDuration, bottomPauseTime),

    // Phase-specific velocities - THE KEY DATA for fatigue analysis
    concentricMeanVelocity: concentric.metrics.meanVelocity,
    concentricPeakVelocity: concentric.metrics.peakVelocity,
    eccentricMeanVelocity: eccentric.metrics.meanVelocity,
    eccentricPeakVelocity: eccentric.metrics.peakVelocity,

    peakForce: Math.max(concentric.metrics.peakForce, eccentric.metrics.peakForce),
    rangeOfMotion: Math.max(concentric.metrics.endPosition, eccentric.metrics.startPosition),
  };
}

function formatTempo(ecc: number, topPause: number, con: number, botPause: number): string {
  const round = (t: number) => Math.round(t * 2) / 2;
  return `${round(ecc)}-${round(topPause)}-${round(con)}-${round(botPause)}`;
}
