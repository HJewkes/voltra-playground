/**
 * Voltra Weight Discovery Engine
 * 
 * State machine for guiding users through weight discovery for new exercises.
 * Collects data points, builds a load-velocity profile, and recommends
 * working weights.
 * 
 * The engine focuses purely on workflow orchestration:
 * - When to increase/decrease weight
 * - How many reps to request
 * - When discovery is complete
 * 
 * Profile building and analysis is delegated to analytics/velocity-profile.ts
 */

import { TrainingGoal, ExerciseType } from './models';
import {
  TRAINING_ZONES,
  categorizeVelocity,
  type VelocityTrend,
} from '@/analytics/velocity-constants';
import {
  buildLoadVelocityProfile,
  generateWorkingWeightRecommendation,
  type LoadVelocityProfile,
  type WorkingWeightRecommendation,
} from '@/analytics/velocity-profile';

// =============================================================================
// Re-exports for backward compatibility
// =============================================================================

// Re-export types that external code depends on
export type { LoadVelocityProfile } from '@/analytics/velocity-profile';
export {
  VELOCITY_AT_PERCENT_1RM,
  TRAINING_ZONES,
  MINIMUM_VELOCITY_THRESHOLD,
  DISCOVERY_START_PERCENTAGES,
  estimatePercent1RMFromVelocity,
  getTargetVelocityForGoal,
  suggestNextWeight,
} from '@/analytics/velocity-constants';
export {
  estimate1RMFromSet,
} from '@/analytics/velocity-profile';

// =============================================================================
// Types
// =============================================================================

export interface DiscoverySetResult {
  weight: number;
  reps: number;
  meanVelocity: number;
  peakVelocity: number;
  rpe?: number;
  failed: boolean;
  notes?: string;
}

export interface DiscoveryStep {
  stepNumber: number;
  instruction: string;
  weight: number;
  targetReps: number;
  purpose: string;
  velocityExpectation?: string;
}

export interface DiscoveryRecommendation {
  /** Estimated 1RM */
  estimated1RM: number;
  
  /** Recommended warmup sets */
  warmupSets: Array<{ weight: number; reps: number; purpose: string }>;
  
  /** Recommended working weight */
  workingWeight: number;
  
  /** Recommended rep range */
  repRange: [number, number];
  
  /** Confidence in recommendations */
  confidence: 'high' | 'medium' | 'low';
  
  /** Explanation for the user */
  explanation: string;
  
  /** The profile used to generate this */
  profile: LoadVelocityProfile;
}

export type DiscoveryPhase = 'not_started' | 'exploring' | 'dialing_in' | 'complete';

// =============================================================================
// Weight Discovery Engine
// =============================================================================

/**
 * Manages the weight discovery workflow for a new exercise.
 * 
 * Usage:
 * 1. Create engine with exercise info and goal
 * 2. Call getFirstStep() to start
 * 3. After each set, call recordSetAndGetNext() with results
 * 4. Continue until you receive a DiscoveryRecommendation instead of a DiscoveryStep
 */
export class WeightDiscoveryEngine {
  private exerciseId: string;
  private exerciseType: ExerciseType;
  private goal: TrainingGoal;
  
  private sets: DiscoverySetResult[] = [];
  private phase: DiscoveryPhase = 'not_started';
  private profile: LoadVelocityProfile | null = null;
  
  // Current state
  private currentWeight: number = 0;
  private lastVelocity: number = 0;
  
  constructor(
    exerciseId: string,
    exerciseType: ExerciseType = 'compound',
    goal: TrainingGoal = TrainingGoal.HYPERTROPHY
  ) {
    this.exerciseId = exerciseId;
    this.exerciseType = exerciseType;
    this.goal = goal;
  }
  
  /**
   * Get the first discovery step based on user input.
   */
  getFirstStep(userEstimate?: { lightWeight?: number; guessedMax?: number }): DiscoveryStep {
    this.phase = 'exploring';
    
    let startWeight: number;
    
    if (userEstimate?.guessedMax) {
      // User has a rough idea of their max - start at 30%
      startWeight = Math.round(userEstimate.guessedMax * 0.3 / 5) * 5;
    } else if (userEstimate?.lightWeight) {
      // User knows a "light" weight - use that
      startWeight = userEstimate.lightWeight;
    } else {
      // Complete beginner - start with minimum
      startWeight = this.exerciseType === 'compound' ? 20 : 10;
    }
    
    // Ensure minimum
    startWeight = Math.max(5, startWeight);
    this.currentWeight = startWeight;
    
    return {
      stepNumber: 1,
      instruction: `Start with ${startWeight} lbs - do 5 reps at a comfortable pace`,
      weight: startWeight,
      targetReps: 5,
      purpose: 'Establish baseline velocity at light weight',
      velocityExpectation: 'Should feel easy - expect fast bar speed',
    };
  }
  
  /**
   * Record a completed discovery set and get the next step.
   */
  recordSetAndGetNext(result: DiscoverySetResult): DiscoveryStep | DiscoveryRecommendation {
    this.sets.push(result);
    this.lastVelocity = result.meanVelocity;
    
    // Check for failure
    if (result.failed) {
      return this.finalizeDiscovery();
    }
    
    // Analyze current state
    const trend = categorizeVelocity(result.meanVelocity);
    const canEstimate = this.sets.length >= 2 && this.hasAdequateSpread();
    
    // Decide next step based on phase and data
    if (this.phase === 'exploring') {
      return this.getExplorationStep(trend, canEstimate);
    } else {
      return this.getDialingInStep();
    }
  }
  
  private hasAdequateSpread(): boolean {
    if (this.sets.length < 2) return false;
    
    const weights = this.sets.map(s => s.weight);
    const velocities = this.sets.map(s => s.meanVelocity);
    
    // Need at least 20% weight spread
    const minWeight = Math.min(...weights);
    const weightSpread = minWeight > 0 
      ? (Math.max(...weights) - minWeight) / minWeight 
      : 0;
    
    // Need meaningful velocity difference
    const velocitySpread = Math.max(...velocities) - Math.min(...velocities);
    
    return weightSpread >= 0.2 && velocitySpread >= 0.15;
  }
  
  private getExplorationStep(
    trend: VelocityTrend,
    canEstimate: boolean
  ): DiscoveryStep | DiscoveryRecommendation {
    const stepNumber = this.sets.length + 1;
    
    // Determine weight increment based on velocity
    let increment: number;
    let message: string;
    
    switch (trend) {
      case 'fast':
        // Way too light - big jump
        increment = this.exerciseType === 'compound' ? 20 : 10;
        message = 'That was very light - making a bigger jump';
        break;
        
      case 'moderate':
        // Getting closer - moderate jump
        increment = this.exerciseType === 'compound' ? 10 : 5;
        message = "Good pace - let's go a bit heavier";
        break;
        
      case 'slow':
        // Getting heavy - small jump or switch to dialing in
        if (canEstimate) {
          this.phase = 'dialing_in';
          return this.getDialingInStep();
        }
        increment = 5;
        message = 'Starting to slow down - small increase';
        break;
        
      case 'grinding':
        // Near limit - we have enough data
        if (this.sets.length >= 2) {
          return this.finalizeDiscovery();
        }
        // Go back down if we jumped too fast
        increment = -10;
        message = "That was hard! Let's try a lighter weight";
        break;
    }
    
    const newWeight = Math.max(5, Math.round((this.currentWeight + increment) / 5) * 5);
    this.currentWeight = newWeight;
    
    const targetReps = trend === 'slow' || trend === 'grinding' ? 3 : 5;
    
    return {
      stepNumber,
      instruction: `Try ${newWeight} lbs - ${targetReps} reps, max intent`,
      weight: newWeight,
      targetReps,
      purpose: message,
      velocityExpectation: this.getVelocityExpectation(trend),
    };
  }
  
  private getDialingInStep(): DiscoveryStep | DiscoveryRecommendation {
    // Build profile with current data
    const dataPoints = this.sets.map(s => ({
      weight: s.weight,
      velocity: s.meanVelocity,
    }));
    const profile = buildLoadVelocityProfile(this.exerciseId, dataPoints);
    
    if (profile.confidence !== 'low') {
      // Good enough - finalize
      return this.generateRecommendation(profile);
    }
    
    // Need one more data point near the working zone
    const targetZone = TRAINING_ZONES[this.goal];
    const targetWeight = Math.round(profile.estimated1RM * (targetZone.optimal / 100) / 5) * 5;
    
    // Check if we've already tested near this weight
    const nearTarget = this.sets.some(s => 
      Math.abs(s.weight - targetWeight) / targetWeight < 0.1
    );
    
    if (!nearTarget && targetWeight > 0) {
      this.currentWeight = targetWeight;
      
      return {
        stepNumber: this.sets.length + 1,
        instruction: `Let's test ${targetWeight} lbs - this should be close to your working weight`,
        weight: targetWeight,
        targetReps: 3,
        purpose: 'Confirming working weight zone',
      };
    }
    
    // We've tested near target - good enough
    return this.generateRecommendation(profile);
  }
  
  private generateRecommendation(profile: LoadVelocityProfile): DiscoveryRecommendation {
    this.profile = profile;
    this.phase = 'complete';
    
    const recommendation = generateWorkingWeightRecommendation(profile, this.goal);
    
    return {
      estimated1RM: profile.estimated1RM,
      warmupSets: recommendation.warmupSets,
      workingWeight: recommendation.workingWeight,
      repRange: recommendation.repRange,
      confidence: recommendation.confidence,
      explanation: recommendation.explanation,
      profile: recommendation.profile,
    };
  }
  
  private finalizeDiscovery(): DiscoveryRecommendation {
    const dataPoints = this.sets.map(s => ({
      weight: s.weight,
      velocity: s.meanVelocity,
    }));
    const profile = buildLoadVelocityProfile(this.exerciseId, dataPoints);
    return this.generateRecommendation(profile);
  }
  
  private getVelocityExpectation(trend: VelocityTrend): string {
    switch (trend) {
      case 'fast':
        return 'Expect velocity to slow as weight increases';
      case 'moderate':
        return 'Getting into working territory';
      case 'slow':
        return 'This is challenging weight - good data point';
      case 'grinding':
        return 'Near your limit - be careful';
    }
  }
  
  // ==========================================================================
  // Public Getters
  // ==========================================================================
  
  getPhase(): DiscoveryPhase {
    return this.phase;
  }
  
  getProfile(): LoadVelocityProfile | null {
    return this.profile;
  }
  
  getSets(): DiscoverySetResult[] {
    return [...this.sets];
  }
  
  /**
   * Get a quick recommendation if user wants to skip detailed discovery.
   * Uses just 2 sets: one light, one moderate.
   */
  getQuickRecommendation(
    lightSet: DiscoverySetResult,
    moderateSet: DiscoverySetResult
  ): DiscoveryRecommendation {
    this.sets = [lightSet, moderateSet];
    return this.finalizeDiscovery();
  }
  
  /**
   * Reset for a new discovery session.
   */
  reset(): void {
    this.sets = [];
    this.phase = 'not_started';
    this.profile = null;
    this.currentWeight = 0;
    this.lastVelocity = 0;
  }
}
