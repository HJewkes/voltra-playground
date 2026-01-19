/**
 * Voltra Telemetry Parser
 * 
 * Decodes real-time telemetry data from Voltra devices during workouts.
 * Data is streamed at ~11 Hz via BLE notifications.
 */

import { bytesToHex } from '@/ble/types';
import { MessageTypes, TelemetryOffsets, MovementPhase } from './constants';

// =============================================================================
// Types
// =============================================================================

/**
 * Real-time telemetry data from a single notification.
 */
export interface TelemetryFrame {
  /** Incrementing sequence number */
  sequence: number;
  /** Current movement phase */
  phase: MovementPhase;
  /** Cable extension (0=rest, ~600=full pull) */
  position: number;
  /** Force reading (positive=concentric, negative=eccentric) */
  force: number;
  /** Movement velocity */
  velocity: number;
  /** When frame was received (ms since epoch) */
  timestamp: number;
}

/**
 * Summary data for a completed rep.
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
  
  // Computed properties
  peakConcentricForce: number;
  peakEccentricForce: number;
  peakForce: number;
  avgConcentricForce: number;
  avgEccentricForce: number;
  maxPosition: number;
  maxVelocity: number;
  durationSeconds: number;
  
  // Phase timings (in seconds)
  concentricTime: number;      // Time actively pulling
  eccentricTime: number;       // Time actively lowering
  topPauseTime: number;        // Time paused at top (HOLD phase)
  bottomPauseTime: number;     // Time paused at bottom before rep (IDLE within rep)
  
  // Derived tempo metrics
  totalActiveTime: number;     // concentricTime + eccentricTime
  totalPauseTime: number;      // topPauseTime + bottomPauseTime
  tempo: string;               // e.g., "2-1-3-0" (ecc-pause-con-pause)
}

/**
 * Aggregate statistics for a workout set.
 */
export interface WorkoutStats {
  reps: RepData[];
  startTime: number;
  endTime: number | null;
  weightLbs: number | null;
  
  // Computed
  repCount: number;
  totalDuration: number;
  avgPeakForce: number;
  maxPeakForce: number;
  avgRepDuration: number;
  timeUnderTension: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Read a little-endian uint16 from a Uint8Array.
 */
function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Read a little-endian int16 from a Uint8Array.
 */
function readInt16LE(data: Uint8Array, offset: number): number {
  const value = readUint16LE(data, offset);
  return value > 0x7fff ? value - 0x10000 : value;
}

/**
 * Check if two byte arrays are equal.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Calculate time duration for a set of frames.
 * Uses frame-by-frame intervals for accuracy.
 */
function calculatePhaseDuration(frames: TelemetryFrame[]): number {
  if (frames.length < 2) return 0;
  return (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000;
}

/**
 * Find contiguous segments of a phase within frames.
 * Returns array of frame groups for each segment.
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
 * Compute RepData from collected frames.
 */
function computeRepData(repNumber: number, frames: TelemetryFrame[]): RepData {
  const concentricFrames = frames.filter(f => f.phase === MovementPhase.CONCENTRIC);
  const eccentricFrames = frames.filter(f => f.phase === MovementPhase.ECCENTRIC);
  const holdFrames = frames.filter(f => f.phase === MovementPhase.HOLD);
  const idleFrames = frames.filter(f => f.phase === MovementPhase.IDLE);
  
  const peakConcentricForce = concentricFrames.length > 0
    ? Math.max(...concentricFrames.map(f => f.force))
    : 0;
  
  const peakEccentricForce = eccentricFrames.length > 0
    ? Math.max(...eccentricFrames.map(f => Math.abs(f.force)))
    : 0;
  
  const peakForce = frames.length > 0
    ? Math.max(...frames.map(f => Math.abs(f.force)))
    : 0;
  
  const avgConcentricForce = concentricFrames.length > 0
    ? concentricFrames.reduce((sum, f) => sum + f.force, 0) / concentricFrames.length
    : 0;
  
  const avgEccentricForce = eccentricFrames.length > 0
    ? eccentricFrames.reduce((sum, f) => sum + Math.abs(f.force), 0) / eccentricFrames.length
    : 0;
  
  const maxPosition = frames.length > 0
    ? Math.max(...frames.map(f => f.position))
    : 0;
  
  const maxVelocity = frames.length > 0
    ? Math.max(...frames.map(f => f.velocity))
    : 0;
  
  const durationSeconds = frames.length >= 2
    ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000
    : 0;
  
  // Calculate phase times using contiguous segments
  // This handles cases where phase might briefly switch
  const concentricSegments = findPhaseSegments(frames, MovementPhase.CONCENTRIC);
  const eccentricSegments = findPhaseSegments(frames, MovementPhase.ECCENTRIC);
  const holdSegments = findPhaseSegments(frames, MovementPhase.HOLD);
  const idleSegments = findPhaseSegments(frames, MovementPhase.IDLE);
  
  const concentricTime = concentricSegments.reduce(
    (sum, seg) => sum + calculatePhaseDuration(seg), 0
  );
  
  const eccentricTime = eccentricSegments.reduce(
    (sum, seg) => sum + calculatePhaseDuration(seg), 0
  );
  
  // Top pause: HOLD phase (between concentric and eccentric)
  const topPauseTime = holdSegments.reduce(
    (sum, seg) => sum + calculatePhaseDuration(seg), 0
  );
  
  // Bottom pause: IDLE frames that occur AFTER the first concentric
  // (to exclude pre-rep idle time)
  let bottomPauseTime = 0;
  const firstConcentricIndex = frames.findIndex(f => f.phase === MovementPhase.CONCENTRIC);
  if (firstConcentricIndex >= 0) {
    const framesAfterStart = frames.slice(firstConcentricIndex);
    const idleSegmentsInRep = findPhaseSegments(framesAfterStart, MovementPhase.IDLE);
    bottomPauseTime = idleSegmentsInRep.reduce(
      (sum, seg) => sum + calculatePhaseDuration(seg), 0
    );
  }
  
  // Derived metrics
  const totalActiveTime = concentricTime + eccentricTime;
  const totalPauseTime = topPauseTime + bottomPauseTime;
  
  // Build tempo string: eccentric-topPause-concentric-bottomPause
  // Round to nearest 0.5s for readability
  const roundTempo = (t: number) => Math.round(t * 2) / 2;
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

// =============================================================================
// TelemetryParser
// =============================================================================

export type ParseResult = 
  | { type: 'frame'; frame: TelemetryFrame }
  | { type: 'rep'; summary: RepSummary; repData: RepData }
  | null;

/**
 * Parser for Voltra BLE notifications with history tracking.
 */
export class TelemetryParser {
  private trackHistory: boolean;
  private lastSequence: number = -1;
  private repCount: number = 0;
  
  // History tracking
  private startTime: number | null = null;
  private allFrames: TelemetryFrame[] = [];
  private currentRepFrames: TelemetryFrame[] = [];
  private repData: RepData[] = [];
  private weightLbs: number | null = null;
  
  // Rep phase tracking
  private lastActivePhase: MovementPhase | null = null;
  private inRep: boolean = false;
  
  constructor(trackHistory: boolean = true) {
    this.trackHistory = trackHistory;
  }
  
  /**
   * Set the weight for this workout (for stats reporting).
   */
  setWeight(weightLbs: number): void {
    this.weightLbs = weightLbs;
  }
  
  /**
   * Get current rep count.
   */
  getRepCount(): number {
    return this.repCount;
  }
  
  /**
   * Parse a BLE notification into telemetry data.
   */
  parse(data: Uint8Array): ParseResult {
    if (data.length < 14) {
      return null;
    }
    
    const msgType = data.slice(0, 4);
    
    if (bytesEqual(msgType, MessageTypes.TELEMETRY_STREAM)) {
      return this.parseTelemetry(data);
    } else if (bytesEqual(msgType, MessageTypes.REP_SUMMARY)) {
      return this.parseRepSummary(data);
    }
    
    return null;
  }
  
  private parseTelemetry(data: Uint8Array): ParseResult {
    if (data.length < 30) {
      return null;
    }
    
    // Start tracking time on first frame
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
    
    // Sequence number
    const sequence = readUint16LE(data, TelemetryOffsets.SEQUENCE);
    
    // Phase
    const phaseByte = data[TelemetryOffsets.PHASE];
    let phase: MovementPhase;
    if (phaseByte >= 0 && phaseByte <= 3) {
      phase = phaseByte as MovementPhase;
    } else {
      phase = MovementPhase.UNKNOWN;
    }
    
    // Sensor data
    const position = readUint16LE(data, TelemetryOffsets.POSITION);
    const force = readInt16LE(data, TelemetryOffsets.FORCE);
    const velocity = readUint16LE(data, TelemetryOffsets.VELOCITY);
    
    this.lastSequence = sequence;
    
    const frame: TelemetryFrame = {
      sequence,
      phase,
      position,
      force,
      velocity,
      timestamp: Date.now(),
    };
    
    // Track history
    if (this.trackHistory) {
      this.allFrames.push(frame);
      this.currentRepFrames.push(frame);
    }
    
    // Track active phase for rep detection
    if (phase === MovementPhase.CONCENTRIC || 
        phase === MovementPhase.ECCENTRIC || 
        phase === MovementPhase.HOLD) {
      this.lastActivePhase = phase;
      if (phase === MovementPhase.CONCENTRIC) {
        this.inRep = true;
      }
    }
    
    return { type: 'frame', frame };
  }
  
  private parseRepSummary(data: Uint8Array): ParseResult {
    if (data.length < 30) {
      return null;
    }
    
    // Determine if this is a full rep completion
    // A full rep ends when eccentric phase completes (cable returned)
    const isFullRep = this.inRep && this.lastActivePhase === MovementPhase.ECCENTRIC;
    
    if (!isFullRep) {
      // This is just the end of concentric phase (top of rep)
      return null;
    }
    
    // Full rep completed!
    this.repCount++;
    this.inRep = false;
    
    // Compute peak force and rep data from collected frames
    let peakForce = 0;
    let repDataEntry: RepData | null = null;
    
    if (this.trackHistory && this.currentRepFrames.length > 0) {
      peakForce = Math.max(...this.currentRepFrames.map(f => Math.abs(f.force)));
      repDataEntry = computeRepData(this.repCount, [...this.currentRepFrames]);
      this.repData.push(repDataEntry);
      this.currentRepFrames = [];
    }
    
    const summary: RepSummary = {
      repNumber: this.repCount,
      peakForce,
      timestamp: Date.now(),
    };
    
    return { 
      type: 'rep', 
      summary, 
      repData: repDataEntry || computeRepData(this.repCount, []),
    };
  }
  
  /**
   * Get computed statistics for the workout.
   */
  getWorkoutStats(): WorkoutStats {
    const now = Date.now();
    const start = this.startTime || now;
    const totalDuration = (now - start) / 1000;
    
    const avgPeakForce = this.repData.length > 0
      ? this.repData.reduce((sum, r) => sum + r.peakForce, 0) / this.repData.length
      : 0;
    
    const maxPeakForce = this.repData.length > 0
      ? Math.max(...this.repData.map(r => r.peakForce))
      : 0;
    
    const avgRepDuration = this.repData.length > 0
      ? this.repData.reduce((sum, r) => sum + r.durationSeconds, 0) / this.repData.length
      : 0;
    
    const timeUnderTension = this.repData.reduce((sum, r) => sum + r.durationSeconds, 0);
    
    return {
      reps: [...this.repData],
      startTime: start,
      endTime: now,
      weightLbs: this.weightLbs,
      repCount: this.repCount,
      totalDuration,
      avgPeakForce,
      maxPeakForce,
      avgRepDuration,
      timeUnderTension,
    };
  }
  
  /**
   * Get all recorded telemetry frames.
   */
  getAllFrames(): TelemetryFrame[] {
    return [...this.allFrames];
  }
  
  /**
   * Get computed data for each completed rep.
   */
  getRepData(): RepData[] {
    return [...this.repData];
  }
  
  /**
   * Get the most recent frame.
   */
  getLastFrame(): TelemetryFrame | null {
    return this.allFrames.length > 0 
      ? this.allFrames[this.allFrames.length - 1] 
      : null;
  }
  
  /**
   * Reset parser state (call when starting new set).
   */
  reset(): void {
    this.lastSequence = -1;
    this.repCount = 0;
    this.startTime = null;
    this.allFrames = [];
    this.currentRepFrames = [];
    this.repData = [];
    this.lastActivePhase = null;
    this.inRep = false;
    // Keep weight setting across resets
  }
}
