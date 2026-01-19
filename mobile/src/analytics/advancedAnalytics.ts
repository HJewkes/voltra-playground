/**
 * Voltra Advanced Workout Analytics
 * 
 * Advanced metrics derived from telemetry data:
 * - Velocity-Based Training (VBT) metrics
 * - RIR/RPE estimation from velocity loss
 * - Tempo analysis and compliance
 * - Work/Power calculations for progression tracking
 * - Rep quality analysis (partial, failed, grinding)
 * - Intent detection (max effort vs pacing)
 * 
 * Research basis:
 * - Pareja-Blanco et al. (2017) - VL thresholds and adaptations
 * - Sánchez-Medina & González-Badillo (2011) - Velocity loss as fatigue indicator
 * - Weakley et al. (2020) - VBT applied framework
 * - Rodiles-Guerrero et al. (2020) - Weight-stack machine VL thresholds
 */

import { RepData, TelemetryFrame, MovementPhase } from '@/protocol';
import {
  VELOCITY_RIR_MAP,
  VELOCITY_LOSS_TARGETS as SHARED_VELOCITY_LOSS_TARGETS,
  estimateRIRFromVelocityLoss,
  estimateRPEFromVelocityLoss,
} from './velocity-constants';

// =============================================================================
// Enums
// =============================================================================

export enum VelocityZone {
  STRENGTH = 'strength',           // <50% max velocity, heavy grinding
  STRENGTH_SPEED = 'strength_speed', // 50-70% max velocity
  POWER = 'power',                 // 70-85% max velocity
  SPEED_STRENGTH = 'speed_strength', // 85-95% max velocity
  SPEED = 'speed',                 // >95% max velocity
}

export enum RepQuality {
  COMPLETE = 'complete',     // Full ROM, normal execution
  PARTIAL = 'partial',       // Reduced ROM (didn't reach full extension)
  FAILED = 'failed',         // Started but couldn't complete (stalled/reversed)
  SHORTENED = 'shortened',   // Intentionally or progressively shortened ROM
  GRINDING = 'grinding',     // Completed but with significant velocity stall
}

// =============================================================================
// Data Types
// =============================================================================

export interface RepQualityAnalysis {
  quality: RepQuality;
  maxPosition: number;
  romPercent: number;           // ROM as % of reference
  stallDetected: boolean;
  stallPosition: number | null;
  stallDuration: number;
  reversed: boolean;            // Position decreased during concentric
  notes: string;
}

export interface IntentAnalysis {
  likelyMaxIntent: boolean;
  firstRepPercentExpected: number | null;
  velocityVarianceLow: boolean;   // Flat velocity = pacing
  accelerationProfileFlat: boolean;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  recommendation: string;
}

export interface TempoTarget {
  eccentric: number;      // Time for lowering phase
  pauseBottom: number;    // Pause at bottom
  concentric: number;     // Time for lifting phase
  pauseTop: number;       // Pause at top
}

export interface TempoAnalysis {
  actualConcentric: number;
  actualEccentric: number;
  actualPauseTop: number;
  actualPauseBottom: number;
  target: TempoTarget | null;
  
  // Computed
  actualTotal: number;
  concentricDeviation: number | null;
  eccentricDeviation: number | null;
  tempoCompliance: number | null;  // 0-100%
}

export interface VelocityMetrics {
  meanConcentricVelocity: number;
  peakConcentricVelocity: number;
  meanEccentricVelocity: number;
  peakEccentricVelocity: number;
  velocityLossPercent: number | null;
  velocityZone: VelocityZone | null;
}

export interface RPEEstimate {
  velocityLossPercent: number;
  estimatedRir: number;
  estimatedRpe: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface WorkMetrics {
  // Impulse = ∫Force dt
  concentricImpulse: number;
  eccentricImpulse: number;
  totalImpulse: number;
  
  // Work = ∫Force dx (estimated as F × v × dt)
  concentricWork: number;
  eccentricWork: number;
  totalWork: number;
  
  // Power = Work / Time
  concentricPower: number;
  eccentricPower: number;
  
  // Peak instantaneous power
  peakPower: number;
  
  // Rate of Force Development
  peakRfd: number;
  
  // Time under tension
  timeUnderTension: number;
}

export interface RepAnalytics {
  repNumber: number;
  velocity: VelocityMetrics;
  tempo: TempoAnalysis;
  work: WorkMetrics;
  quality: RepQualityAnalysis | null;
  rpe: RPEEstimate | null;
}

export interface SetAnalytics {
  reps: RepAnalytics[];
  weightLbs: number | null;
  tempoTarget: TempoTarget | null;
  
  // Aggregates
  totalWork: number;
  totalImpulse: number;
  avgVelocityLoss: number;
  finalRpe: RPEEstimate | null;
}

// =============================================================================
// Tempo Helpers
// =============================================================================

export const DEFAULT_TEMPO: TempoTarget = {
  eccentric: 2.0,
  pauseBottom: 0.0,
  concentric: 1.0,
  pauseTop: 0.0,
};

/**
 * Parse tempo string like "3-1-2-0" or "3120".
 */
export function parseTempoString(tempo: string): TempoTarget {
  let parts: number[];
  
  if (tempo.includes('-')) {
    parts = tempo.split('-').map(Number);
  } else {
    parts = tempo.split('').map(Number);
  }
  
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    return {
      eccentric: parts[0],
      pauseBottom: parts[1],
      concentric: parts[2],
      pauseTop: parts[3],
    };
  } else if (parts.length === 2 && parts.every(p => !isNaN(p))) {
    return {
      eccentric: parts[0],
      pauseBottom: 0,
      concentric: parts[1],
      pauseTop: 0,
    };
  }
  
  return DEFAULT_TEMPO;
}

/**
 * Format tempo as string.
 */
export function formatTempo(tempo: TempoTarget): string {
  return `${tempo.eccentric}-${tempo.pauseBottom}-${tempo.concentric}-${tempo.pauseTop}`;
}

/**
 * Get total time for a tempo.
 */
export function getTempoTotal(tempo: TempoTarget): number {
  return tempo.eccentric + tempo.pauseBottom + tempo.concentric + tempo.pauseTop;
}

// =============================================================================
// Velocity-RIR Mapping (imported from velocity-constants.ts)
// =============================================================================

// VELOCITY_RIR_MAP is now imported from velocity-constants.ts

// =============================================================================
// Workout Analyzer
// =============================================================================

export class WorkoutAnalyzer {
  private tempoTarget: TempoTarget | null = null;
  
  /**
   * Set target tempo for compliance checking.
   */
  setTempoTarget(target: TempoTarget | string): void {
    if (typeof target === 'string') {
      this.tempoTarget = parseTempoString(target);
    } else {
      this.tempoTarget = target;
    }
  }
  
  /**
   * Infer intended tempo from the first few reps.
   */
  inferTempoFromReps(reps: RepData[], numReps: number = 3): TempoTarget {
    if (reps.length === 0) return DEFAULT_TEMPO;
    
    const sample = reps.slice(0, numReps);
    const avgCon = sample.reduce((sum, r) => sum + r.concentricTime, 0) / sample.length;
    const avgEcc = sample.reduce((sum, r) => sum + r.eccentricTime, 0) / sample.length;
    const avgTopPause = sample.reduce((sum, r) => sum + r.topPauseTime, 0) / sample.length;
    const avgBotPause = sample.reduce((sum, r) => sum + r.bottomPauseTime, 0) / sample.length;
    
    return {
      concentric: avgCon,
      eccentric: avgEcc,
      pauseTop: avgTopPause,
      pauseBottom: avgBotPause,
    };
  }
  
  /**
   * Analyze a single rep.
   */
  analyzeRep(
    rep: RepData,
    referenceVelocity: number | null = null,
    referencePosition: number | null = null
  ): RepAnalytics {
    const velocity = this.computeVelocityMetrics(rep, referenceVelocity);
    const tempo = this.computeTempo(rep);
    const work = this.computeWorkMetrics(rep);
    const quality = this.computeRepQuality(rep, referencePosition);
    
    let rpe: RPEEstimate | null = null;
    if (velocity.velocityLossPercent !== null) {
      rpe = this.estimateRpe(velocity.velocityLossPercent);
    }
    
    return {
      repNumber: rep.repNumber,
      velocity,
      tempo,
      work,
      quality,
      rpe,
    };
  }
  
  /**
   * Analyze a complete set.
   */
  analyzeSet(reps: RepData[], weightLbs: number | null = null): SetAnalytics {
    if (reps.length === 0) {
      return {
        reps: [],
        weightLbs,
        tempoTarget: this.tempoTarget,
        totalWork: 0,
        totalImpulse: 0,
        avgVelocityLoss: 0,
        finalRpe: null,
      };
    }
    
    // Use first rep as reference
    const firstRep = reps[0];
    const referenceVelocity = this.getMeanConcentricVelocity(firstRep);
    const referencePosition = firstRep.maxPosition;
    
    // Analyze each rep
    const repAnalytics = reps.map(rep => 
      this.analyzeRep(rep, referenceVelocity, referencePosition)
    );
    
    // Aggregate metrics
    const totalWork = repAnalytics.reduce((sum, r) => sum + r.work.totalWork, 0);
    const totalImpulse = repAnalytics.reduce((sum, r) => sum + r.work.totalImpulse, 0);
    
    // Average velocity loss (excluding first rep)
    const losses = repAnalytics
      .slice(1)
      .map(r => r.velocity.velocityLossPercent)
      .filter((l): l is number => l !== null);
    const avgVelocityLoss = losses.length > 0
      ? losses.reduce((a, b) => a + b, 0) / losses.length
      : 0;
    
    // Final RPE from last rep
    const finalRpe = repAnalytics[repAnalytics.length - 1]?.rpe ?? null;
    
    return {
      reps: repAnalytics,
      weightLbs,
      tempoTarget: this.tempoTarget,
      totalWork,
      totalImpulse,
      avgVelocityLoss,
      finalRpe,
    };
  }
  
  /**
   * Analyze intent (max effort vs pacing).
   */
  analyzeIntent(
    reps: RepData[],
    expectedFirstRepVelocity: number | null = null
  ): IntentAnalysis {
    if (reps.length === 0 || !reps[0].frames || reps[0].frames.length === 0) {
      return {
        likelyMaxIntent: true,
        firstRepPercentExpected: null,
        velocityVarianceLow: false,
        accelerationProfileFlat: false,
        confidence: 'unknown',
        recommendation: '',
      };
    }
    
    const firstRep = reps[0];
    const firstRepVelocity = this.getMeanConcentricVelocity(firstRep);
    
    // Check 1: First rep vs expected
    let firstRepPercent: number | null = null;
    let belowExpected = false;
    
    if (expectedFirstRepVelocity && expectedFirstRepVelocity > 0) {
      firstRepPercent = (firstRepVelocity / expectedFirstRepVelocity) * 100;
      belowExpected = firstRepPercent < 85;
    }
    
    // Check 2: Velocity variance (flat = pacing)
    const velocities = reps
      .map(r => this.getMeanConcentricVelocity(r))
      .filter(v => v > 0);
    
    let velocityVarianceLow = false;
    if (velocities.length >= 3) {
      const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      velocityVarianceLow = cv < 0.05; // <5% CV suggests pacing
    }
    
    // Determine intent
    const likelyMaxIntent = !belowExpected && !velocityVarianceLow;
    
    // Confidence
    let confidence: 'high' | 'medium' | 'low' | 'unknown';
    if (expectedFirstRepVelocity) {
      confidence = likelyMaxIntent ? 'medium' : 'high';
    } else {
      confidence = 'low';
    }
    
    // Recommendation
    let recommendation = '';
    if (belowExpected) {
      recommendation = 'First rep velocity was below expected. Push faster on concentrics for accurate RIR tracking.';
    } else if (velocityVarianceLow) {
      recommendation = 'Velocity was very consistent across reps. If using tempo, RIR estimates may be less accurate.';
    }
    
    return {
      likelyMaxIntent,
      firstRepPercentExpected: firstRepPercent,
      velocityVarianceLow,
      accelerationProfileFlat: false,
      confidence,
      recommendation,
    };
  }
  
  /**
   * Compare two sets for progression tracking.
   */
  compareSets(set1: SetAnalytics, set2: SetAnalytics): {
    workChangePercent: number;
    impulseChangePercent: number;
    repCountChange: number;
    velocityLossChange: number;
    assessment: 'progressed' | 'maintained' | 'regressed';
  } {
    const percentChange = (old: number, newVal: number) => 
      old === 0 ? 0 : Math.round(((newVal - old) / old) * 1000) / 10;
    
    const workChange = percentChange(set1.totalWork, set2.totalWork);
    
    return {
      workChangePercent: percentChange(set1.totalWork, set2.totalWork),
      impulseChangePercent: percentChange(set1.totalImpulse, set2.totalImpulse),
      repCountChange: set2.reps.length - set1.reps.length,
      velocityLossChange: Math.round((set2.avgVelocityLoss - set1.avgVelocityLoss) * 10) / 10,
      assessment: workChange > 5 ? 'progressed' : workChange < -5 ? 'regressed' : 'maintained',
    };
  }
  
  // ===========================================================================
  // Private Methods
  // ===========================================================================
  
  private getMeanConcentricVelocity(rep: RepData): number {
    const concentric = rep.frames.filter(f => f.phase === MovementPhase.CONCENTRIC);
    if (concentric.length === 0) return 0;
    return concentric.reduce((sum, f) => sum + f.velocity, 0) / concentric.length;
  }
  
  private computeVelocityMetrics(
    rep: RepData,
    referenceVelocity: number | null
  ): VelocityMetrics {
    const concentric = rep.frames.filter(f => f.phase === MovementPhase.CONCENTRIC);
    const eccentric = rep.frames.filter(f => f.phase === MovementPhase.ECCENTRIC);
    
    // Concentric metrics
    const conVelocities = concentric.map(f => f.velocity);
    const meanCon = conVelocities.length > 0
      ? conVelocities.reduce((a, b) => a + b, 0) / conVelocities.length
      : 0;
    const peakCon = conVelocities.length > 0 ? Math.max(...conVelocities) : 0;
    
    // Eccentric metrics
    const eccVelocities = eccentric.map(f => f.velocity);
    const meanEcc = eccVelocities.length > 0
      ? eccVelocities.reduce((a, b) => a + b, 0) / eccVelocities.length
      : 0;
    const peakEcc = eccVelocities.length > 0 ? Math.max(...eccVelocities) : 0;
    
    // Velocity loss and zone
    let velocityLossPercent: number | null = null;
    let velocityZone: VelocityZone | null = null;
    
    if (referenceVelocity && referenceVelocity > 0) {
      velocityLossPercent = 100 * (1 - meanCon / referenceVelocity);
      
      const ratio = meanCon / referenceVelocity;
      if (ratio < 0.5) velocityZone = VelocityZone.STRENGTH;
      else if (ratio < 0.7) velocityZone = VelocityZone.STRENGTH_SPEED;
      else if (ratio < 0.85) velocityZone = VelocityZone.POWER;
      else if (ratio < 0.95) velocityZone = VelocityZone.SPEED_STRENGTH;
      else velocityZone = VelocityZone.SPEED;
    }
    
    return {
      meanConcentricVelocity: meanCon,
      peakConcentricVelocity: peakCon,
      meanEccentricVelocity: meanEcc,
      peakEccentricVelocity: peakEcc,
      velocityLossPercent,
      velocityZone,
    };
  }
  
  private computeTempo(rep: RepData): TempoAnalysis {
    const actualConcentric = rep.concentricTime;
    const actualEccentric = rep.eccentricTime;
    const actualPauseTop = rep.topPauseTime;
    const actualPauseBottom = rep.bottomPauseTime;
    const actualTotal = actualConcentric + actualEccentric + actualPauseTop + actualPauseBottom;
    
    let concentricDeviation: number | null = null;
    let eccentricDeviation: number | null = null;
    let tempoCompliance: number | null = null;
    
    if (this.tempoTarget) {
      concentricDeviation = actualConcentric - this.tempoTarget.concentric;
      eccentricDeviation = actualEccentric - this.tempoTarget.eccentric;
      
      // Calculate compliance (0-100%)
      const conDev = Math.abs(concentricDeviation) / Math.max(this.tempoTarget.concentric, 0.1);
      const eccDev = Math.abs(eccentricDeviation) / Math.max(this.tempoTarget.eccentric, 0.1);
      const avgDev = (conDev + eccDev) / 2;
      tempoCompliance = Math.max(0, Math.round((1 - avgDev) * 1000) / 10);
    }
    
    return {
      actualConcentric,
      actualEccentric,
      actualPauseTop,
      actualPauseBottom,
      target: this.tempoTarget,
      actualTotal,
      concentricDeviation,
      eccentricDeviation,
      tempoCompliance,
    };
  }
  
  private computeWorkMetrics(rep: RepData): WorkMetrics {
    const concentric = rep.frames.filter(f => f.phase === MovementPhase.CONCENTRIC);
    const eccentric = rep.frames.filter(f => f.phase === MovementPhase.ECCENTRIC);
    
    // Estimate dt between frames (~90ms at 11Hz)
    const dt = 0.09;
    
    // Concentric metrics
    const conImpulse = concentric.reduce((sum, f) => sum + Math.abs(f.force) * dt, 0);
    const conWork = concentric.reduce((sum, f) => sum + Math.abs(f.force) * f.velocity * dt, 0);
    const conTime = rep.concentricTime || 0.001;
    const conPower = conTime > 0 ? conWork / conTime : 0;
    
    // Eccentric metrics
    const eccImpulse = eccentric.reduce((sum, f) => sum + Math.abs(f.force) * dt, 0);
    const eccWork = eccentric.reduce((sum, f) => sum + Math.abs(f.force) * f.velocity * dt, 0);
    const eccTime = rep.eccentricTime || 0.001;
    const eccPower = eccTime > 0 ? eccWork / eccTime : 0;
    
    // Peak instantaneous power
    let peakPower = 0;
    if (concentric.length > 0) {
      const powers = concentric.map(f => Math.abs(f.force) * f.velocity);
      peakPower = Math.max(...powers);
    }
    
    // Rate of Force Development (RFD)
    let peakRfd = 0;
    if (concentric.length >= 2) {
      const rfdValues: number[] = [];
      for (let i = 1; i < concentric.length; i++) {
        const forceChange = concentric[i].force - concentric[i - 1].force;
        if (forceChange > 0) {
          rfdValues.push(forceChange / dt);
        }
      }
      if (rfdValues.length > 0) {
        peakRfd = Math.max(...rfdValues);
      }
    }
    
    return {
      concentricImpulse: conImpulse,
      eccentricImpulse: eccImpulse,
      totalImpulse: conImpulse + eccImpulse,
      concentricWork: conWork,
      eccentricWork: eccWork,
      totalWork: conWork + eccWork,
      concentricPower: conPower,
      eccentricPower: eccPower,
      peakPower,
      peakRfd,
      timeUnderTension: rep.durationSeconds,
    };
  }
  
  private computeRepQuality(
    rep: RepData,
    referencePosition: number | null
  ): RepQualityAnalysis {
    if (!rep.frames || rep.frames.length === 0) {
      return {
        quality: RepQuality.COMPLETE,
        maxPosition: 0,
        romPercent: 100,
        stallDetected: false,
        stallPosition: null,
        stallDuration: 0,
        reversed: false,
        notes: '',
      };
    }
    
    const maxPos = rep.maxPosition;
    const refPos = referencePosition ?? maxPos;
    const romPercent = refPos > 0 ? (maxPos / refPos) * 100 : 100;
    
    // Get concentric frames
    const concentric = rep.frames.filter(f => f.phase === MovementPhase.CONCENTRIC);
    
    // Detect stalls and reversals
    let stallDetected = false;
    let stallPosition: number | null = null;
    let stallDuration = 0;
    let reversed = false;
    
    if (concentric.length >= 3) {
      const stallThreshold = 5; // Very low velocity
      let stallFrames = 0;
      let stallStartTime: number | null = null;
      let prevPos = 0;
      let consecutiveDrops = 0;
      
      for (let i = 0; i < concentric.length; i++) {
        const frame = concentric[i];
        
        // Check for stall
        if (frame.velocity < stallThreshold && frame.position < maxPos * 0.95) {
          if (stallStartTime === null) {
            stallStartTime = frame.timestamp;
            stallPosition = frame.position;
          }
          stallFrames++;
        } else {
          if (stallFrames >= 2) {
            stallDetected = true;
            stallDuration = frame.timestamp - (stallStartTime ?? frame.timestamp);
          }
          stallStartTime = null;
          stallFrames = 0;
        }
        
        // Check for reversal
        if (i > 0 && frame.position < prevPos - 10) {
          consecutiveDrops++;
          if (consecutiveDrops >= 2) {
            reversed = true;
          }
        } else {
          consecutiveDrops = 0;
        }
        prevPos = frame.position;
      }
    }
    
    // Determine quality
    let quality = RepQuality.COMPLETE;
    let notes = '';
    
    if (reversed && romPercent < 85) {
      quality = RepQuality.FAILED;
      notes = `Position reversed at ${stallPosition ?? 'unknown'}, only reached ${romPercent.toFixed(0)}% ROM`;
    } else if (romPercent < 70) {
      quality = RepQuality.PARTIAL;
      notes = `Significantly reduced ROM (${romPercent.toFixed(0)}% of reference)`;
    } else if (romPercent < 85) {
      quality = RepQuality.SHORTENED;
      notes = `Shortened ROM (${romPercent.toFixed(0)}% of reference)`;
    } else if (stallDetected) {
      quality = RepQuality.GRINDING;
      notes = `Velocity stall at position ${stallPosition} for ${stallDuration.toFixed(2)}s`;
    }
    
    return {
      quality,
      maxPosition: maxPos,
      romPercent,
      stallDetected,
      stallPosition,
      stallDuration,
      reversed,
      notes,
    };
  }
  
  private estimateRpe(velocityLoss: number, intentConfirmed: boolean = true): RPEEstimate {
    // If velocity increasing (negative loss), set is very submaximal
    if (velocityLoss < 0) {
      return {
        velocityLossPercent: velocityLoss,
        estimatedRir: 6.0,
        estimatedRpe: 4.0,
        confidence: 'low',
      };
    }
    
    // Find bracket
    let rir = 0.0;
    let rpe = 10.0;
    
    for (const [maxLoss, bracketRir, bracketRpe] of VELOCITY_RIR_MAP) {
      if (velocityLoss <= maxLoss) {
        rir = bracketRir;
        rpe = bracketRpe;
        break;
      }
    }
    
    // Confidence based on velocity loss and intent
    let confidence: 'high' | 'medium' | 'low';
    if (velocityLoss > 35) {
      confidence = intentConfirmed ? 'high' : 'medium';
    } else if (velocityLoss > 20) {
      confidence = intentConfirmed ? 'medium' : 'low';
    } else {
      confidence = 'low';
    }
    
    // If intent questionable, add uncertainty
    if (!intentConfirmed && rir < 5) {
      rir = Math.min(rir + 1.5, 6.0);
      confidence = 'low';
    }
    
    return {
      velocityLossPercent: velocityLoss,
      estimatedRir: rir,
      estimatedRpe: rpe,
      confidence,
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Apply simple moving average smoothing to velocity data.
 */
export function smoothVelocity(frames: TelemetryFrame[], window: number = 3): number[] {
  const velocities = frames.map(f => f.velocity);
  if (velocities.length < window) return velocities;
  
  const smoothed: number[] = [];
  const half = Math.floor(window / 2);
  
  for (let i = 0; i < velocities.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(velocities.length, i + half + 1);
    const avg = velocities.slice(start, end).reduce((a, b) => a + b, 0) / (end - start);
    smoothed.push(avg);
  }
  
  return smoothed;
}

/**
 * Quick analysis of a set.
 */
export function analyzeSet(
  reps: RepData[],
  weightLbs: number | null = null,
  tempoTarget: TempoTarget | string | null = null
): SetAnalytics {
  const analyzer = new WorkoutAnalyzer();
  if (tempoTarget) {
    analyzer.setTempoTarget(tempoTarget);
  }
  return analyzer.analyzeSet(reps, weightLbs);
}

/**
 * Get velocity zone description.
 */
export function getVelocityZoneDescription(zone: VelocityZone): string {
  const descriptions: Record<VelocityZone, string> = {
    [VelocityZone.STRENGTH]: 'Heavy grinding - maximal strength',
    [VelocityZone.STRENGTH_SPEED]: 'Strength-speed - heavy but moving',
    [VelocityZone.POWER]: 'Power zone - optimal force × velocity',
    [VelocityZone.SPEED_STRENGTH]: 'Speed-strength - fast and strong',
    [VelocityZone.SPEED]: 'Speed zone - maximal velocity',
  };
  return descriptions[zone];
}

/**
 * Get rep quality description.
 */
export function getRepQualityDescription(quality: RepQuality): string {
  const descriptions: Record<RepQuality, string> = {
    [RepQuality.COMPLETE]: 'Full ROM, clean execution',
    [RepQuality.PARTIAL]: 'Reduced range of motion',
    [RepQuality.FAILED]: 'Rep not completed',
    [RepQuality.SHORTENED]: 'ROM shorter than reference',
    [RepQuality.GRINDING]: 'Completed with velocity stall',
  };
  return descriptions[quality];
}

/**
 * Get rep quality color for UI.
 */
export function getRepQualityColor(quality: RepQuality): string {
  const colors: Record<RepQuality, string> = {
    [RepQuality.COMPLETE]: 'text-green-400',
    [RepQuality.PARTIAL]: 'text-yellow-400',
    [RepQuality.FAILED]: 'text-red-400',
    [RepQuality.SHORTENED]: 'text-yellow-400',
    [RepQuality.GRINDING]: 'text-orange-400',
  };
  return colors[quality];
}

// =============================================================================
// Basic VBT Utility Functions (consolidated from workoutAnalytics.ts)
// =============================================================================

/**
 * Velocity loss thresholds for different training goals.
 * Re-exported from velocity-constants.ts for backward compatibility.
 */
export const VELOCITY_LOSS_TARGETS = SHARED_VELOCITY_LOSS_TARGETS;

/**
 * Compute velocity loss percentage from rep data.
 * Compares last rep velocity to first rep (reference) velocity.
 */
export function computeVelocityLoss(reps: RepData[]): number {
  if (reps.length < 2) return 0;
  
  const firstVelocity = reps[0].maxVelocity;
  const lastVelocity = reps[reps.length - 1].maxVelocity;
  
  if (firstVelocity === 0) return 0;
  
  const loss = ((firstVelocity - lastVelocity) / firstVelocity) * 100;
  return Math.round(loss * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate RIR (Reps in Reserve) from velocity loss.
 * Uses cable-specific thresholds (more conservative than barbell).
 * Delegates to shared implementation in velocity-constants.ts.
 */
export function estimateRIR(velocityLossPercent: number): number {
  return estimateRIRFromVelocityLoss(velocityLossPercent);
}

/**
 * Estimate RPE (Rate of Perceived Exertion) from velocity loss.
 * Uses cable-specific thresholds (more conservative than barbell).
 * Delegates to shared implementation in velocity-constants.ts.
 */
export function estimateRPE(velocityLossPercent: number): number {
  return estimateRPEFromVelocityLoss(velocityLossPercent);
}

/**
 * Get effort level description.
 */
export function getEffortLabel(rpe: number): string {
  if (rpe <= 5) return 'Easy';
  if (rpe <= 6) return 'Moderate';
  if (rpe <= 7) return 'Challenging';
  if (rpe <= 8) return 'Hard';
  if (rpe <= 9) return 'Very Hard';
  return 'Max Effort';
}

/**
 * Get RIR description.
 */
export function getRIRDescription(rir: number): string {
  if (rir >= 5) return '5+ reps left';
  if (rir >= 4) return '4 reps left';
  if (rir >= 3) return '3 reps left';
  if (rir >= 2) return '2 reps left';
  if (rir >= 1) return '1 rep left';
  return 'At failure';
}

/**
 * Generate effort bar visualization.
 * Returns a string like "████████░░" for 80% effort.
 */
export function getEffortBar(rpe: number, width: number = 10): string {
  const filled = Math.round((rpe / 10) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get color for RPE value (for UI feedback).
 */
export function getRPEColor(rpe: number): string {
  if (rpe <= 6) return '#22c55e'; // green
  if (rpe <= 7) return '#84cc16'; // lime
  if (rpe <= 8) return '#eab308'; // yellow
  if (rpe <= 9) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Live analytics computed from in-progress rep data.
 */
export interface LiveAnalytics {
  /** Current velocity loss percentage */
  velocityLossPercent: number;
  /** Current estimated RIR */
  estimatedRIR: number;
  /** Current estimated RPE */
  estimatedRPE: number;
  /** Effort label */
  effortLabel: string;
  /** Whether user is approaching target RPE */
  approachingTarget: boolean;
  /** Recommendation message */
  message: string;
}

/**
 * Compute live analytics from completed reps during a set.
 * Used to show real-time feedback as user progresses through the set.
 */
export function computeLiveAnalytics(
  reps: RepData[],
  targetRPE?: number
): LiveAnalytics {
  if (reps.length === 0) {
    return {
      velocityLossPercent: 0,
      estimatedRIR: 6,
      estimatedRPE: 5,
      effortLabel: 'Starting',
      approachingTarget: false,
      message: 'Begin your set',
    };
  }
  
  if (reps.length === 1) {
    return {
      velocityLossPercent: 0,
      estimatedRIR: 6,
      estimatedRPE: 5,
      effortLabel: 'Easy',
      approachingTarget: false,
      message: 'Reference velocity established',
    };
  }
  
  const velocityLoss = computeVelocityLoss(reps);
  const rir = estimateRIR(velocityLoss);
  const rpe = estimateRPE(velocityLoss);
  const effortLabel = getEffortLabel(rpe);
  
  // Check if approaching target
  const target = targetRPE ?? 8; // Default target RPE 8
  const approachingTarget = rpe >= target - 1;
  const atTarget = rpe >= target;
  const pastTarget = rpe > target;
  
  // Generate message based on state
  let message: string;
  if (pastTarget) {
    message = `Past target! ${rir} reps left`;
  } else if (atTarget) {
    message = `Target reached! ${rir} reps left`;
  } else if (approachingTarget) {
    message = `Getting close! ~${rir} reps remaining`;
  } else if (velocityLoss < 10) {
    message = 'Velocity stable - plenty in reserve';
  } else if (velocityLoss < 20) {
    message = 'Good pace - building fatigue';
  } else {
    message = `${Math.round(velocityLoss)}% velocity loss`;
  }
  
  return {
    velocityLossPercent: velocityLoss,
    estimatedRIR: rir,
    estimatedRPE: rpe,
    effortLabel,
    approachingTarget,
    message,
  };
}

/**
 * Analyze a completed workout and compute all analytics.
 * Returns a WorkoutAnalytics object compatible with storage.
 */
export interface WorkoutAnalytics {
  velocityLossPercent: number;
  estimatedRIR: number;
  estimatedRPE: number;
  avgVelocity: number;
  peakVelocity: number;
  timeUnderTension: number;
  avgRepDuration: number;
  velocityByRep: number[];
  avgConcentricTime: number;
  avgEccentricTime: number;
  avgTopPauseTime: number;
  avgBottomPauseTime: number;
  avgTempo: string;
}

/**
 * Analyze a completed workout and compute all analytics.
 */
export function analyzeWorkout(stats: { reps: RepData[] }): WorkoutAnalytics {
  const reps = stats.reps;
  
  if (reps.length === 0) {
    return {
      velocityLossPercent: 0,
      estimatedRIR: 6,
      estimatedRPE: 5,
      avgVelocity: 0,
      peakVelocity: 0,
      timeUnderTension: 0,
      avgRepDuration: 0,
      velocityByRep: [],
      avgConcentricTime: 0,
      avgEccentricTime: 0,
      avgTopPauseTime: 0,
      avgBottomPauseTime: 0,
      avgTempo: '0-0-0-0',
    };
  }
  
  const velocityLossPercent = computeVelocityLoss(reps);
  const rir = estimateRIR(velocityLossPercent);
  const rpe = estimateRPE(velocityLossPercent);
  
  const velocities = reps.map(r => r.maxVelocity);
  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const peakVelocity = Math.max(...velocities);
  
  const timeUnderTension = reps.reduce((sum, r) => sum + r.durationSeconds, 0);
  const avgRepDuration = timeUnderTension / reps.length;
  
  // Compute tempo analytics
  const avgConcentricTime = reps.reduce((sum, r) => sum + r.concentricTime, 0) / reps.length;
  const avgEccentricTime = reps.reduce((sum, r) => sum + r.eccentricTime, 0) / reps.length;
  const avgTopPauseTime = reps.reduce((sum, r) => sum + r.topPauseTime, 0) / reps.length;
  const avgBottomPauseTime = reps.reduce((sum, r) => sum + r.bottomPauseTime, 0) / reps.length;
  
  // Build average tempo string (ecc-topPause-con-bottomPause)
  const roundTempo = (t: number) => Math.round(t * 2) / 2;
  const avgTempo = `${roundTempo(avgEccentricTime)}-${roundTempo(avgTopPauseTime)}-${roundTempo(avgConcentricTime)}-${roundTempo(avgBottomPauseTime)}`;
  
  return {
    velocityLossPercent,
    estimatedRIR: rir,
    estimatedRPE: rpe,
    avgVelocity: Math.round(avgVelocity),
    peakVelocity,
    timeUnderTension: Math.round(timeUnderTension * 10) / 10,
    avgRepDuration: Math.round(avgRepDuration * 100) / 100,
    velocityByRep: velocities,
    avgConcentricTime: Math.round(avgConcentricTime * 100) / 100,
    avgEccentricTime: Math.round(avgEccentricTime * 100) / 100,
    avgTopPauseTime: Math.round(avgTopPauseTime * 100) / 100,
    avgBottomPauseTime: Math.round(avgBottomPauseTime * 100) / 100,
    avgTempo,
  };
}

/**
 * Format workout summary message.
 */
export function getWorkoutSummaryMessage(analytics: WorkoutAnalytics, repCount: number): string {
  const effortLabel = getEffortLabel(analytics.estimatedRPE);
  const rirDesc = getRIRDescription(analytics.estimatedRIR);
  
  return `${repCount} reps completed\n${effortLabel} effort (RPE ${analytics.estimatedRPE})\n${rirDesc}`;
}

/**
 * Get recommendation based on velocity loss and training goal.
 */
export function getRecommendation(
  velocityLossPercent: number,
  goal: keyof typeof VELOCITY_LOSS_TARGETS = 'HYPERTROPHY'
): string {
  const target = VELOCITY_LOSS_TARGETS[goal];
  
  if (velocityLossPercent < target.min) {
    return `You had more in the tank. Consider adding ${Math.ceil((target.min - velocityLossPercent) / 5)} more reps or increasing weight.`;
  }
  
  if (velocityLossPercent > target.max) {
    return `That was a tough set! Consider stopping ${Math.ceil((velocityLossPercent - target.max) / 5)} reps earlier next time for optimal ${goal.toLowerCase()} gains.`;
  }
  
  return `Great set! Velocity loss of ${velocityLossPercent}% is right in the target zone for ${goal.toLowerCase()}.`;
}
