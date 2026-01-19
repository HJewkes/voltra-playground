/**
 * Voltra Adaptive Adjustment Engine
 * 
 * Makes intra-workout adjustments based on real-time telemetry:
 * - Rest period adjustments based on fatigue
 * - Weight adjustments based on velocity loss
 * - Set termination based on junk volume detection
 * - Volume adjustments based on performance
 * 
 * All thresholds are research-backed.
 */

import {
  AdaptiveSessionState,
  ExercisePrescription,
  SetAdjustment,
  TrainingGoal,
  EXPECTED_REP_DROP,
  REST_DEFAULTS,
} from './models';

// =============================================================================
// Types
// =============================================================================

export interface SetPerformance {
  setNumber: number;
  reps: number;
  weight: number;
  velocityLossPercent: number;
  estimatedRir: number;
  firstRepVelocity: number;
  avgVelocity: number;
  totalWork?: number;
  grindingDetected?: boolean;
  romShortened?: boolean;
}

export interface NextSetRecommendation {
  weight: number;
  targetReps: [number, number];
  restSeconds: number;
  
  /** Whether weight was changed */
  weightChanged: boolean;
  /** Whether rest was extended */
  restExtended: boolean;
  
  /** Should stop the exercise */
  shouldStop: boolean;
  /** Offer an optional extra set */
  optionalExtraSet: boolean;
  
  /** User-facing message */
  message: string;
  /** Rest period message */
  restMessage: string;
}

// =============================================================================
// Adaptive Engine
// =============================================================================

/**
 * Thresholds for adaptation decisions.
 */
const VL_TOLERANCE = 5.0;            // % tolerance around target VL
const REP_DROP_WARNING = 0.30;       // 30% drop triggers warning
const REP_DROP_STOP = 0.50;          // 50% drop = junk volume
const VELOCITY_DROP_WARNING = 0.40;  // 40% first-rep velocity drop

/**
 * Makes intra-workout adjustments based on real-time performance.
 */
export class AdaptiveEngine {
  private setHistory: SetPerformance[] = [];
  private firstSetPerformance: SetPerformance | null = null;
  
  /**
   * Reset for a new exercise.
   */
  reset(): void {
    this.setHistory = [];
    this.firstSetPerformance = null;
  }
  
  /**
   * Record a completed set's performance.
   */
  recordSet(performance: SetPerformance): void {
    this.setHistory.push(performance);
    
    if (performance.setNumber === 1) {
      this.firstSetPerformance = performance;
    }
  }
  
  /**
   * Get recommendation for the next set based on performance.
   */
  getNextSetRecommendation(
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState,
    lastSet: SetPerformance
  ): NextSetRecommendation {
    // Record the set
    this.recordSet(lastSet);
    
    // Get target velocity loss range
    const [targetVlMin, targetVlMax] = prescription.velocityLossTarget ?? [20, 30];
    
    // Current values
    const currentWeight = sessionState.adjustedWeight;
    const targetReps = sessionState.adjustedRepRange ?? sessionState.plannedRepRange;
    const baseRest = prescription.restSeconds;
    
    // Initialize recommendation
    const rec: NextSetRecommendation = {
      weight: currentWeight,
      targetReps,
      restSeconds: baseRest,
      weightChanged: false,
      restExtended: false,
      shouldStop: false,
      optionalExtraSet: false,
      message: '',
      restMessage: '',
    };
    
    // Check for junk volume
    if (this.isJunkVolume(lastSet)) {
      rec.shouldStop = true;
      rec.message = 'Good work - additional sets won\'t help much';
      rec.restMessage = '';
      return rec;
    }
    
    // Check if hit planned sets
    const setsRemaining = sessionState.plannedSets - sessionState.setsCompleted - 1;
    
    if (setsRemaining <= 0) {
      // Check if we should offer an optional extra set
      if (this.canAddSet(lastSet, prescription, sessionState)) {
        rec.optionalExtraSet = true;
        rec.message = 'Optional: Add another set if you\'re feeling good';
      } else {
        rec.shouldStop = true;
        rec.message = 'Great job - exercise complete!';
      }
      return rec;
    }
    
    // Calculate adjustments
    const weightAdj = this.calculateWeightAdjustment(
      lastSet,
      targetVlMin,
      targetVlMax,
      prescription
    );
    const restAdj = this.calculateRestAdjustment(
      lastSet,
      baseRest,
      prescription.goal
    );
    
    // Apply weight adjustment
    if (weightAdj !== 0 && prescription.adaptive.allowWeightAdjustment) {
      let newWeight = currentWeight + weightAdj;
      newWeight = Math.max(5, Math.min(200, newWeight));
      newWeight = Math.round(newWeight / 5) * 5;
      rec.weight = newWeight;
      rec.weightChanged = true;
      
      // Record the adjustment
      sessionState.setAdjustments.push({
        afterSet: lastSet.setNumber,
        adjustmentType: 'weight',
        oldValue: currentWeight,
        newValue: newWeight,
        reason: `VL ${lastSet.velocityLossPercent.toFixed(0)}% vs target ${targetVlMin}-${targetVlMax}%`,
      });
    }
    
    // Apply rest adjustment
    if (restAdj > 0) {
      rec.restSeconds = baseRest + restAdj;
      rec.restExtended = true;
      
      sessionState.setAdjustments.push({
        afterSet: lastSet.setNumber,
        adjustmentType: 'rest',
        oldValue: baseRest,
        newValue: rec.restSeconds,
        reason: `VL ${lastSet.velocityLossPercent.toFixed(0)}% - extending rest`,
      });
    }
    
    // Generate messages
    rec.message = this.getRecommendationMessage(rec, lastSet, setsRemaining);
    rec.restMessage = this.getRestMessage(baseRest, rec.restSeconds);
    
    return rec;
  }
  
  private calculateWeightAdjustment(
    lastSet: SetPerformance,
    targetVlMin: number,
    targetVlMax: number,
    prescription: ExercisePrescription
  ): number {
    const vl = lastSet.velocityLossPercent;
    const increment = prescription.progressionIncrement;
    
    // VL significantly under target - can increase weight
    if (vl < targetVlMin - VL_TOLERANCE) {
      return increment;
    }
    
    // VL significantly over target - should decrease weight
    if (vl > targetVlMax + VL_TOLERANCE) {
      return -increment;
    }
    
    // In range - no change
    return 0;
  }
  
  private calculateRestAdjustment(
    lastSet: SetPerformance,
    baseRest: number,
    goal: TrainingGoal
  ): number {
    let extraRest = 0;
    
    // Velocity loss based adjustment
    if (lastSet.velocityLossPercent > 40) {
      extraRest = 60;
    } else if (lastSet.velocityLossPercent > 30) {
      extraRest = 30;
    }
    
    // Rep drop based adjustment (if we have first set data)
    if (this.firstSetPerformance) {
      const repDrop = 1 - (lastSet.reps / this.firstSetPerformance.reps);
      if (repDrop > REP_DROP_WARNING) {
        // Ensure at least 3 min rest
        const minRest = 180;
        if (baseRest + extraRest < minRest) {
          extraRest = minRest - baseRest;
        }
      }
    }
    
    return extraRest;
  }
  
  private isJunkVolume(lastSet: SetPerformance): boolean {
    if (!this.firstSetPerformance) {
      return false;
    }
    
    // Rep drop check
    const repDrop = 1 - (lastSet.reps / this.firstSetPerformance.reps);
    if (repDrop >= REP_DROP_STOP) {
      return true;
    }
    
    // Velocity drop check
    const velocityDrop = 1 - (lastSet.firstRepVelocity / this.firstSetPerformance.firstRepVelocity);
    if (velocityDrop >= VELOCITY_DROP_WARNING) {
      return true;
    }
    
    return false;
  }
  
  private canAddSet(
    lastSet: SetPerformance,
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): boolean {
    if (sessionState.setsCompleted >= prescription.adaptive.maxSets) {
      return false;
    }
    
    if (lastSet.estimatedRir < 2) {
      return false;
    }
    
    const targetVlMax = prescription.velocityLossTarget?.[1] ?? 30;
    if (lastSet.velocityLossPercent > targetVlMax) {
      return false;
    }
    
    if (this.isJunkVolume(lastSet)) {
      return false;
    }
    
    return true;
  }
  
  private getRecommendationMessage(
    rec: NextSetRecommendation,
    lastSet: SetPerformance,
    setsRemaining: number
  ): string {
    const parts: string[] = [];
    
    if (rec.weightChanged) {
      if (rec.weight > lastSet.weight) {
        parts.push(`Bump up to ${rec.weight} lbs`);
      } else {
        parts.push(`Drop to ${rec.weight} lbs - you're working hard`);
      }
    } else {
      parts.push(`Same weight (${rec.weight} lbs)`);
    }
    
    const repStr = rec.targetReps[0] === rec.targetReps[1]
      ? `${rec.targetReps[0]}`
      : `${rec.targetReps[0]}-${rec.targetReps[1]}`;
    parts.push(`aim for ${repStr} reps`);
    
    return parts.join(', ');
  }
  
  private getRestMessage(baseRest: number, adjustedRest: number): string {
    if (adjustedRest > baseRest) {
      const extra = adjustedRest - baseRest;
      return `Take an extra ${extra} seconds rest`;
    }
    
    const minutes = Math.floor(adjustedRest / 60);
    const seconds = adjustedRest % 60;
    
    if (seconds === 0) {
      return `Rest ${minutes} minutes`;
    }
    return `Rest ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Get expected performance for a set based on history.
   */
  getExpectedPerformance(
    setNumber: number,
    prescription: ExercisePrescription
  ): { expectedReps: number; expectedDropPercent: number } | null {
    if (setNumber === 1 || !this.firstSetPerformance) {
      return null;
    }
    
    // Get expected rep drop for this rest period
    const rest = prescription.restSeconds;
    const expectedDrop = EXPECTED_REP_DROP[rest] ?? 0.15;
    
    // Compound drop across sets
    const cumulativeDrop = 1 - Math.pow(1 - expectedDrop, setNumber - 1);
    
    const expectedReps = Math.max(1, Math.round(
      this.firstSetPerformance.reps * (1 - cumulativeDrop)
    ));
    
    return {
      expectedReps,
      expectedDropPercent: cumulativeDrop * 100,
    };
  }
}

/**
 * Calculate if user has recovered enough based on velocity.
 * Research suggests waiting until first-rep velocity is ≥90% of set 1.
 */
export function checkVelocityRecovery(
  currentFirstRepVelocity: number,
  set1FirstRepVelocity: number,
  targetRecoveryPercent: number = 0.90
): { recovered: boolean; currentPercent: number; recommendation: string } {
  if (set1FirstRepVelocity <= 0) {
    return {
      recovered: true,
      currentPercent: 100,
      recommendation: 'Ready to go',
    };
  }
  
  const currentPercent = (currentFirstRepVelocity / set1FirstRepVelocity) * 100;
  const recovered = currentPercent >= targetRecoveryPercent * 100;
  
  let recommendation: string;
  if (recovered) {
    recommendation = 'Velocity recovered - ready for next set';
  } else if (currentPercent >= 85) {
    recommendation = 'Almost recovered - 30 more seconds recommended';
  } else {
    recommendation = 'Still fatigued - rest a bit longer';
  }
  
  return {
    recovered,
    currentPercent: Math.round(currentPercent * 10) / 10,
    recommendation,
  };
}

/**
 * Check if set performance is within normal expectations.
 */
export function isSetWithinExpectations(
  actualReps: number,
  expectedReps: number,
  actualVelocity: number,
  expectedVelocity: number,
  tolerance: number = 0.15
): { 
  withinExpectations: boolean; 
  repDeviation: number; 
  velocityDeviation: number;
  assessment: string;
} {
  const repDeviation = expectedReps > 0 
    ? (actualReps - expectedReps) / expectedReps 
    : 0;
  const velocityDeviation = expectedVelocity > 0
    ? (actualVelocity - expectedVelocity) / expectedVelocity
    : 0;
  
  const withinExpectations = (
    Math.abs(repDeviation) <= tolerance &&
    Math.abs(velocityDeviation) <= tolerance
  );
  
  let assessment: string;
  if (repDeviation > tolerance) {
    assessment = 'Performing better than expected';
  } else if (repDeviation < -tolerance) {
    assessment = 'Performing below expected - may need more rest';
  } else if (velocityDeviation < -tolerance) {
    assessment = 'Velocity dropping faster than normal';
  } else {
    assessment = 'On track';
  }
  
  return {
    withinExpectations,
    repDeviation: Math.round(repDeviation * 1000) / 10,
    velocityDeviation: Math.round(velocityDeviation * 1000) / 10,
    assessment,
  };
}
