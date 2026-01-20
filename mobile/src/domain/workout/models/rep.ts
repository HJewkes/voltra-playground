/**
 * Rep - a complete repetition consisting of phases.
 *
 * Hardware-agnostic representation of one rep.
 * Built from Phase objects provided by hardware adapters.
 */
import type { Phase } from './phase';

export interface Rep {
  repNumber: number;
  timestamp: { start: number; end: number };

  // Building blocks (phases that make up this rep)
  concentric: Phase;
  eccentric: Phase;
  holdAtTop: Phase | null;
  holdAtBottom: Phase | null;

  // Aggregated metrics (derived from phases)
  metrics: RepMetrics;
}

export interface RepMetrics {
  // Timing
  totalDuration: number;
  concentricDuration: number;
  eccentricDuration: number;
  topPauseTime: number;
  bottomPauseTime: number;
  tempo: string; // e.g., "2-1-3-0" (ecc-pause-con-pause)

  // Phase-specific velocities (THE KEY DATA for fatigue analysis)
  concentricMeanVelocity: number;
  concentricPeakVelocity: number;
  eccentricMeanVelocity: number;
  eccentricPeakVelocity: number;

  // Overall
  peakForce: number;
  rangeOfMotion: number; // 0-1 normalized
}

// For storage (omit phase objects, keep only metrics)
export interface StoredRep {
  repNumber: number;
  timestamp: { start: number; end: number };
  metrics: RepMetrics;
}

// Factory
export function createRep(
  repNumber: number,
  concentric: Phase,
  eccentric: Phase,
  holdAtTop: Phase | null,
  holdAtBottom: Phase | null,
  metrics: RepMetrics,
): Rep {
  return {
    repNumber,
    timestamp: { start: concentric.timestamp.start, end: eccentric.timestamp.end },
    concentric,
    eccentric,
    holdAtTop,
    holdAtBottom,
    metrics,
  };
}
