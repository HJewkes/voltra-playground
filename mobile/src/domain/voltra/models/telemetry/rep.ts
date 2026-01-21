/**
 * Rep Data Model
 *
 * Computed statistics for a single completed rep.
 */

import { MovementPhase } from '@/domain/voltra/protocol/constants';
import type { TelemetryFrame } from './frame';

/**
 * Summary data for a completed rep (from device notification).
 */
export interface RepSummary {
  /** Rep number (1-indexed) */
  repNumber: number;
  /** Peak force during rep */
  peakForce: number;
  /** When rep completed */
  timestamp: number;
}

/**
 * Computed statistics for a single rep.
 */
export interface RepData {
  repNumber: number;
  frames: TelemetryFrame[];

  // Force metrics
  peakConcentricForce: number;
  peakEccentricForce: number;
  peakForce: number;
  avgConcentricForce: number;
  avgEccentricForce: number;

  // Motion metrics
  maxPosition: number;
  maxVelocity: number;
  durationSeconds: number;

  // Phase timings (in seconds)
  concentricTime: number; // Time actively pulling
  eccentricTime: number; // Time actively lowering
  topPauseTime: number; // Time paused at top (HOLD phase)
  bottomPauseTime: number; // Time paused at bottom (IDLE within rep)

  // Derived tempo metrics
  totalActiveTime: number; // concentricTime + eccentricTime
  totalPauseTime: number; // topPauseTime + bottomPauseTime
  tempo: string; // e.g., "2-1-3-0" (ecc-pause-con-pause)
}

// =============================================================================
// Computation Helpers
// =============================================================================

/**
 * Calculate time duration for a set of frames.
 */
function calculatePhaseDuration(frames: TelemetryFrame[]): number {
  if (frames.length < 2) return 0;
  return (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000;
}

/**
 * Find contiguous segments of a specific phase within frames.
 */
function findPhaseSegments(frames: TelemetryFrame[], phase: MovementPhase): TelemetryFrame[][] {
  const segments: TelemetryFrame[][] = [];
  let currentSegment: TelemetryFrame[] = [];

  for (const frame of frames) {
    if (frame.phase === phase) {
      currentSegment.push(frame);
    } else if (currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Round tempo value to nearest 0.5s for readability.
 */
function roundTempo(t: number): number {
  return Math.round(t * 2) / 2;
}

// =============================================================================
// Rep Data Computation
// =============================================================================

/**
 * Compute RepData from collected frames.
 *
 * This is the core business logic for analyzing a completed rep.
 */
export function computeRepData(repNumber: number, frames: TelemetryFrame[]): RepData {
  // Filter frames by phase
  const concentricFrames = frames.filter((f) => f.phase === MovementPhase.CONCENTRIC);
  const eccentricFrames = frames.filter((f) => f.phase === MovementPhase.ECCENTRIC);

  // Force calculations
  const peakConcentricForce =
    concentricFrames.length > 0 ? Math.max(...concentricFrames.map((f) => f.force)) : 0;

  const peakEccentricForce =
    eccentricFrames.length > 0 ? Math.max(...eccentricFrames.map((f) => Math.abs(f.force))) : 0;

  const peakForce = frames.length > 0 ? Math.max(...frames.map((f) => Math.abs(f.force))) : 0;

  const avgConcentricForce =
    concentricFrames.length > 0
      ? concentricFrames.reduce((sum, f) => sum + f.force, 0) / concentricFrames.length
      : 0;

  const avgEccentricForce =
    eccentricFrames.length > 0
      ? eccentricFrames.reduce((sum, f) => sum + Math.abs(f.force), 0) / eccentricFrames.length
      : 0;

  // Motion calculations
  const maxPosition = frames.length > 0 ? Math.max(...frames.map((f) => f.position)) : 0;

  const maxVelocity = frames.length > 0 ? Math.max(...frames.map((f) => f.velocity)) : 0;

  const durationSeconds =
    frames.length >= 2 ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000 : 0;

  // Phase timing calculations using contiguous segments
  const concentricSegments = findPhaseSegments(frames, MovementPhase.CONCENTRIC);
  const eccentricSegments = findPhaseSegments(frames, MovementPhase.ECCENTRIC);
  const holdSegments = findPhaseSegments(frames, MovementPhase.HOLD);

  const concentricTime = concentricSegments.reduce(
    (sum, seg) => sum + calculatePhaseDuration(seg),
    0
  );

  const eccentricTime = eccentricSegments.reduce(
    (sum, seg) => sum + calculatePhaseDuration(seg),
    0
  );

  // Top pause: HOLD phase (between concentric and eccentric)
  const topPauseTime = holdSegments.reduce((sum, seg) => sum + calculatePhaseDuration(seg), 0);

  // Bottom pause: IDLE frames that occur AFTER the first concentric
  // (to exclude pre-rep idle time)
  let bottomPauseTime = 0;
  const firstConcentricIndex = frames.findIndex((f) => f.phase === MovementPhase.CONCENTRIC);
  if (firstConcentricIndex >= 0) {
    const framesAfterStart = frames.slice(firstConcentricIndex);
    const idleSegmentsInRep = findPhaseSegments(framesAfterStart, MovementPhase.IDLE);
    bottomPauseTime = idleSegmentsInRep.reduce((sum, seg) => sum + calculatePhaseDuration(seg), 0);
  }

  // Derived metrics
  const totalActiveTime = concentricTime + eccentricTime;
  const totalPauseTime = topPauseTime + bottomPauseTime;

  // Tempo string: eccentric-topPause-concentric-bottomPause
  const tempo = `${roundTempo(eccentricTime)}-${roundTempo(topPauseTime)}-${roundTempo(concentricTime)}-${roundTempo(bottomPauseTime)}`;

  return {
    repNumber,
    frames,
    peakConcentricForce,
    peakEccentricForce,
    peakForce,
    avgConcentricForce,
    avgEccentricForce,
    maxPosition,
    maxVelocity,
    durationSeconds,
    concentricTime,
    eccentricTime,
    topPauseTime,
    bottomPauseTime,
    totalActiveTime,
    totalPauseTime,
    tempo,
  };
}

/**
 * Create a rep summary from rep data.
 */
export function createRepSummary(repData: RepData): RepSummary {
  return {
    repNumber: repData.repNumber,
    peakForce: repData.peakForce,
    timestamp: Date.now(),
  };
}

/**
 * Rep data without frame data (for storage).
 * Frame data is large and not needed for historical analysis.
 */
export type StoredRepData = Omit<RepData, 'frames'>;

/**
 * Strip frame data from rep for storage.
 * Frames are large arrays and not needed for historical analysis.
 */
export function stripFrames(rep: RepData): StoredRepData {
  const { frames: _frames, ...rest } = rep;
  return rest;
}
