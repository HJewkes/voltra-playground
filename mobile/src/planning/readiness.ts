/**
 * Voltra Readiness Detection
 * 
 * Analyzes warmup set performance to determine daily readiness
 * and adjust workout targets accordingly.
 * 
 * Research basis:
 * - Day-to-day strength variation is typically ±5%
 * - >10% drop from baseline indicates significant fatigue
 * - Warmup velocity compared to historical baseline is a valid readiness predictor
 */

import {
  ReadinessZone,
  AdaptiveSessionState,
  ExercisePrescription,
  READINESS_THRESHOLDS,
} from './models';

// =============================================================================
// Types
// =============================================================================

export interface ReadinessCheckResult {
  zone: ReadinessZone;
  /** Velocity as % of baseline (100 = normal) */
  velocityPercent: number;
  /** "high", "medium", "low" */
  confidence: 'high' | 'medium' | 'low';
  
  /** Positive = increase, negative = decrease */
  weightAdjustment: number;
  /** Adjustment to target reps */
  repAdjustment: number;
  /** Multiplier for sets (1.0 = no change) */
  volumeAdjustment: number;
  
  /** User-facing message */
  message: string;
}

export interface WarmupSetData {
  weight: number;
  reps: number;
  meanVelocity: number;
}

// =============================================================================
// Readiness Checker
// =============================================================================

/**
 * Thresholds as velocity percent of baseline.
 */
const EXCELLENT_THRESHOLD = 1.05;  // >105% = feeling great
const NORMAL_THRESHOLD = 0.95;     // 95-105% = normal range
const FATIGUED_THRESHOLD = 0.85;   // 85-95% = fatigued
// Below 85% = RED (significantly off)

const WEIGHT_INCREMENT = 5; // lbs per adjustment step

/**
 * Manages velocity baselines for readiness checking.
 */
export class ReadinessChecker {
  /** exercise_id -> {weight: velocity} */
  private baselines: Map<string, Map<number, number>> = new Map();
  
  /**
   * Set or update velocity baseline for an exercise at a weight.
   */
  setBaseline(exerciseId: string, weight: number, velocity: number): void {
    if (!this.baselines.has(exerciseId)) {
      this.baselines.set(exerciseId, new Map());
    }
    this.baselines.get(exerciseId)!.set(weight, velocity);
  }
  
  /**
   * Get velocity baseline for an exercise at a weight.
   * Interpolates from nearby weights if exact match not found.
   */
  getBaseline(exerciseId: string, weight: number): number | null {
    const exerciseBaselines = this.baselines.get(exerciseId);
    if (!exerciseBaselines || exerciseBaselines.size === 0) {
      return null;
    }
    
    // Exact match
    if (exerciseBaselines.has(weight)) {
      return exerciseBaselines.get(weight)!;
    }
    
    // Interpolate from nearby weights
    const weights = Array.from(exerciseBaselines.keys()).sort((a, b) => a - b);
    
    // Below minimum
    if (weight < weights[0]) {
      // Lighter weight = higher velocity
      const ratio = weights[0] / (weight || 1);
      return exerciseBaselines.get(weights[0])! * (1 + (ratio - 1) * 0.5);
    }
    
    // Above maximum
    if (weight > weights[weights.length - 1]) {
      // Heavier weight = lower velocity
      const ratio = weight / (weights[weights.length - 1] || 1);
      return exerciseBaselines.get(weights[weights.length - 1])! * (1 - (ratio - 1) * 0.3);
    }
    
    // Interpolate between two known weights
    for (let i = 0; i < weights.length - 1; i++) {
      if (weights[i] <= weight && weight <= weights[i + 1]) {
        const w1 = weights[i];
        const w2 = weights[i + 1];
        const v1 = exerciseBaselines.get(w1)!;
        const v2 = exerciseBaselines.get(w2)!;
        
        // Linear interpolation
        const ratio = (weight - w1) / (w2 - w1);
        return v1 + (v2 - v1) * ratio;
      }
    }
    
    return null;
  }
  
  /**
   * Check readiness from a warmup set.
   */
  checkReadiness(
    exerciseId: string,
    warmupWeight: number,
    warmupVelocity: number,
    workingWeight: number,
    increment: number = WEIGHT_INCREMENT
  ): ReadinessCheckResult {
    const baseline = this.getBaseline(exerciseId, warmupWeight);
    
    // If no baseline, we can't determine readiness
    if (baseline === null || baseline <= 0) {
      return {
        zone: ReadinessZone.GREEN,
        velocityPercent: 100.0,
        confidence: 'low',
        weightAdjustment: 0,
        repAdjustment: 0,
        volumeAdjustment: 1.0,
        message: 'No baseline yet - proceeding as planned',
      };
    }
    
    // Calculate velocity as percentage of baseline
    const velocityPercent = (warmupVelocity / baseline) * 100;
    const velocityRatio = warmupVelocity / baseline;
    
    // Determine zone and adjustments
    let zone: ReadinessZone;
    let weightAdj = 0;
    let volumeAdj = 1.0;
    let confidence: 'high' | 'medium' | 'low';
    let message: string;
    
    if (velocityRatio > EXCELLENT_THRESHOLD) {
      // Feeling great - can push harder
      zone = ReadinessZone.GREEN;
      weightAdj = increment;
      volumeAdj = 1.1;
      confidence = 'high';
      message = `You're feeling strong today! Bumping weight +${increment} lbs`;
      
    } else if (velocityRatio >= NORMAL_THRESHOLD) {
      // Normal range - proceed as planned
      zone = ReadinessZone.GREEN;
      weightAdj = 0;
      confidence = 'high';
      message = 'Ready to go - proceeding as planned';
      
    } else if (velocityRatio >= FATIGUED_THRESHOLD) {
      // Fatigued - reduce weight
      zone = ReadinessZone.YELLOW;
      // Scale reduction: 85% -> -10%, 95% -> 0%
      const reductionFactor = (NORMAL_THRESHOLD - velocityRatio) / (NORMAL_THRESHOLD - FATIGUED_THRESHOLD);
      weightAdj = -Math.round(reductionFactor * 2) * increment; // -5 to -10 lbs
      confidence = 'medium';
      message = `A bit off today - reducing weight ${Math.abs(weightAdj)} lbs`;
      
    } else {
      // Significantly off - major reduction
      zone = ReadinessZone.RED;
      weightAdj = -2 * increment; // -10 lbs minimum
      volumeAdj = 0.75; // Do 75% of planned sets
      confidence = 'high'; // Confident they should back off
      message = 'Take it easy today - your body needs recovery';
    }
    
    return {
      zone,
      velocityPercent,
      confidence,
      weightAdjustment: weightAdj,
      repAdjustment: 0, // Generally don't adjust rep targets
      volumeAdjustment: volumeAdj,
      message,
    };
  }
  
  /**
   * Check readiness from multiple warmup sets.
   * Uses the specified warmup set (default: last) for the check.
   */
  checkReadinessFromWarmups(
    exerciseId: string,
    warmupSets: WarmupSetData[],
    workingWeight: number,
    readinessCheckIndex: number = -1
  ): ReadinessCheckResult {
    if (warmupSets.length === 0) {
      return {
        zone: ReadinessZone.GREEN,
        velocityPercent: 100.0,
        confidence: 'low',
        weightAdjustment: 0,
        repAdjustment: 0,
        volumeAdjustment: 1.0,
        message: 'No warmup data - proceeding as planned',
      };
    }
    
    // Get the readiness check set
    const checkIndex = readinessCheckIndex < 0 
      ? warmupSets.length + readinessCheckIndex 
      : readinessCheckIndex;
    const checkSet = warmupSets[Math.min(checkIndex, warmupSets.length - 1)];
    
    return this.checkReadiness(
      exerciseId,
      checkSet.weight,
      checkSet.meanVelocity,
      workingWeight
    );
  }
  
  /**
   * Update baseline from a working set using exponential moving average.
   */
  updateBaseline(
    exerciseId: string,
    weight: number,
    velocity: number,
    wasMaxEffort: boolean = true,
    learningRate: number = 0.2
  ): void {
    if (!wasMaxEffort || velocity <= 0) {
      return; // Don't update baseline from tempo/controlled sets
    }
    
    const currentBaseline = this.getBaseline(exerciseId, weight);
    
    if (currentBaseline === null) {
      // First observation at this weight
      this.setBaseline(exerciseId, weight, velocity);
    } else {
      // Exponential moving average
      const newBaseline = (1 - learningRate) * currentBaseline + learningRate * velocity;
      this.setBaseline(exerciseId, weight, newBaseline);
    }
  }
  
  /**
   * Apply readiness check results to session state.
   */
  applyToSession(
    result: ReadinessCheckResult,
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): AdaptiveSessionState {
    const updated = { ...sessionState };
    
    updated.readinessZone = result.zone;
    updated.readinessScore = result.velocityPercent / 100;
    updated.readinessNote = result.message;
    
    // Apply weight adjustment
    if (result.weightAdjustment !== 0 && prescription.adaptive.allowWeightAdjustment) {
      let newWeight = sessionState.plannedWeight + result.weightAdjustment;
      // Clamp to valid range
      newWeight = Math.max(5, Math.min(200, newWeight));
      // Round to 5 lb increment
      newWeight = Math.round(newWeight / 5) * 5;
      updated.adjustedWeight = newWeight;
    }
    
    // Apply volume adjustment
    if (result.volumeAdjustment !== 1.0 && prescription.adaptive.allowSetAdjustment) {
      let adjustedSets = Math.round(sessionState.plannedSets * result.volumeAdjustment);
      // Clamp to allowed range
      adjustedSets = Math.max(
        prescription.adaptive.minSets,
        Math.min(prescription.adaptive.maxSets, adjustedSets)
      );
      updated.plannedSets = adjustedSets;
    }
    
    return updated;
  }
  
  /**
   * Export all baselines for persistence.
   */
  exportBaselines(): Record<string, Record<number, number>> {
    const result: Record<string, Record<number, number>> = {};
    for (const [exerciseId, weights] of this.baselines) {
      result[exerciseId] = Object.fromEntries(weights);
    }
    return result;
  }
  
  /**
   * Import baselines from storage.
   */
  importBaselines(baselines: Record<string, Record<number, number>>): void {
    this.baselines.clear();
    for (const [exerciseId, weights] of Object.entries(baselines)) {
      const weightMap = new Map<number, number>();
      for (const [w, v] of Object.entries(weights)) {
        weightMap.set(Number(w), v);
      }
      this.baselines.set(exerciseId, weightMap);
    }
  }
}

/**
 * Quick readiness estimate from the first rep of the first working set.
 * Fallback when warmup data isn't available.
 */
export function estimateReadinessFromFirstRep(
  firstRepVelocity: number,
  baselineVelocity: number | null
): ReadinessCheckResult {
  if (baselineVelocity === null || baselineVelocity <= 0) {
    return {
      zone: ReadinessZone.GREEN,
      velocityPercent: 100.0,
      confidence: 'low',
      weightAdjustment: 0,
      repAdjustment: 0,
      volumeAdjustment: 1.0,
      message: 'No baseline - learning your performance',
    };
  }
  
  const velocityPercent = (firstRepVelocity / baselineVelocity) * 100;
  const velocityRatio = firstRepVelocity / baselineVelocity;
  
  let zone: ReadinessZone;
  let message: string;
  
  if (velocityRatio > 1.05) {
    zone = ReadinessZone.GREEN;
    message = 'Strong start!';
  } else if (velocityRatio >= 0.95) {
    zone = ReadinessZone.GREEN;
    message = 'Good start';
  } else if (velocityRatio >= 0.85) {
    zone = ReadinessZone.YELLOW;
    message = 'Starting slower than usual';
  } else {
    zone = ReadinessZone.RED;
    message = 'Significantly slower - consider reducing weight';
  }
  
  return {
    zone,
    velocityPercent,
    confidence: 'low', // First rep is less reliable than warmup
    weightAdjustment: 0,
    repAdjustment: 0,
    volumeAdjustment: 1.0,
    message,
  };
}
