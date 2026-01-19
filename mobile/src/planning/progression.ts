/**
 * Voltra Progression Engine
 * 
 * Handles workout-to-workout progression decisions:
 * - Linear progression for novices
 * - Double progression for intermediates
 * - Autoregulated progression for advanced
 * - Deload detection and scheduling
 * 
 * All rules are research-backed.
 */

import {
  AdaptiveSessionState,
  DeloadTrigger,
  DeloadWeek,
  ExercisePrescription,
  ProgressionScheme,
  TrainingLevel,
  DEFAULT_DELOAD,
} from './models';

// =============================================================================
// Types
// =============================================================================

export interface ExerciseSessionSummary {
  exerciseId: string;
  date: number; // timestamp
  weight: number;
  setsCompleted: number;
  totalReps: number;
  repRange: [number, number];
  avgVelocityLoss: number;
  avgRir: number;
  
  /** Whether minimum reps were hit */
  hitMinimumReps: boolean;
  /** Whether top of range was hit */
  hitTopOfRange: boolean;
}

export interface ProgressionDecision {
  action: 'increase' | 'maintain' | 'decrease' | 'deload';
  weightChange: number;
  repRangeChange?: [number, number];
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  
  /** User-facing message */
  message: string;
}

// =============================================================================
// Progression Engine
// =============================================================================

const CONSECUTIVE_FAILURES_FOR_DELOAD = 2;

/**
 * Determines workout-to-workout progression.
 */
export class ProgressionEngine {
  /** Recent sessions per exercise */
  private exerciseHistory: Map<string, ExerciseSessionSummary[]> = new Map();
  /** Failure counts per exercise */
  private consecutiveFailures: Map<string, number> = new Map();
  /** Deload tracking */
  private lastDeloadDate: number | null = null;
  private weeksSinceDeload: number = 0;
  
  /**
   * Record a completed exercise session.
   */
  recordSession(summary: ExerciseSessionSummary): void {
    const exerciseId = summary.exerciseId;
    
    if (!this.exerciseHistory.has(exerciseId)) {
      this.exerciseHistory.set(exerciseId, []);
    }
    
    const history = this.exerciseHistory.get(exerciseId)!;
    history.push(summary);
    
    // Keep only last 10 sessions
    if (history.length > 10) {
      history.shift();
    }
    
    // Update failure tracking
    if (summary.hitMinimumReps) {
      this.consecutiveFailures.set(exerciseId, 0);
    } else {
      const failures = this.consecutiveFailures.get(exerciseId) ?? 0;
      this.consecutiveFailures.set(exerciseId, failures + 1);
    }
  }
  
  /**
   * Determine progression for next workout.
   */
  getProgressionDecision(
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): ProgressionDecision {
    const scheme = prescription.progressionScheme;
    
    // Check for consecutive failures first
    const failures = this.consecutiveFailures.get(prescription.exerciseId) ?? 0;
    if (failures >= CONSECUTIVE_FAILURES_FOR_DELOAD) {
      return this.makeDeloadDecision(prescription, 'consecutive_failures');
    }
    
    // Route to appropriate progression logic
    switch (scheme) {
      case ProgressionScheme.LINEAR:
        return this.linearProgression(prescription, sessionState);
      case ProgressionScheme.DOUBLE:
        return this.doubleProgression(prescription, sessionState);
      case ProgressionScheme.AUTOREGULATED:
        return this.autoregulatedProgression(prescription, sessionState);
    }
  }
  
  /**
   * Linear progression: add weight every session if reps are hit.
   * Best for novices who can progress rapidly.
   */
  private linearProgression(
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): ProgressionDecision {
    const [minReps] = sessionState.adjustedRepRange ?? sessionState.plannedRepRange;
    const repsPerSet = sessionState.totalReps / Math.max(1, sessionState.setsCompleted);
    
    if (repsPerSet >= minReps) {
      // Hit target - add weight
      const increment = prescription.progressionIncrement;
      const newWeight = sessionState.adjustedWeight + increment;
      
      return {
        action: 'increase',
        weightChange: increment,
        reason: `Hit ${Math.round(repsPerSet)} reps/set - ready to add weight`,
        confidence: 'high',
        message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
      };
    } else {
      // Missed target - maintain
      return {
        action: 'maintain',
        weightChange: 0,
        reason: `Only ${Math.round(repsPerSet)} reps/set - build up first`,
        confidence: 'medium',
        message: 'Next time: Same weight, keep building',
      };
    }
  }
  
  /**
   * Double progression: add reps until top of range, then add weight.
   * Best for intermediates who need more gradual progress.
   */
  private doubleProgression(
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): ProgressionDecision {
    const [minReps, maxReps] = sessionState.adjustedRepRange ?? sessionState.plannedRepRange;
    const repsPerSet = sessionState.totalReps / Math.max(1, sessionState.setsCompleted);
    const rir = sessionState.avgRir;
    
    if (repsPerSet >= maxReps && rir >= 2) {
      // Ready to increase weight
      const increment = prescription.progressionIncrement;
      const newWeight = sessionState.adjustedWeight + increment;
      
      return {
        action: 'increase',
        weightChange: increment,
        reason: `Hit ${maxReps} reps at RIR ${Math.round(rir)} - ready for more weight`,
        confidence: 'high',
        message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
      };
    }
    
    if (repsPerSet >= maxReps && rir < 2) {
      // Hit top of range but was hard - consolidate
      return {
        action: 'maintain',
        weightChange: 0,
        reason: `Hit ${maxReps} reps but RIR ${Math.round(rir)} - consolidate first`,
        confidence: 'medium',
        message: 'Next time: Same weight, focus on consistency',
      };
    }
    
    if (repsPerSet >= minReps) {
      // In range but not at top - keep building
      return {
        action: 'maintain',
        weightChange: 0,
        reason: `Hit ${Math.round(repsPerSet)} reps - keep building to ${maxReps}`,
        confidence: 'high',
        message: 'Next time: Same weight, keep building',
      };
    }
    
    // Missed minimum
    const failures = this.consecutiveFailures.get(prescription.exerciseId) ?? 0;
    
    if (failures >= 1) {
      // Second miss - deload
      return this.makeDeloadDecision(prescription, 'missed_reps');
    }
    
    // First miss - maintain and try again
    return {
      action: 'maintain',
      weightChange: 0,
      reason: `Only ${Math.round(repsPerSet)} reps - try again next session`,
      confidence: 'low',
      message: 'Next time: Same weight, keep building',
    };
  }
  
  /**
   * Autoregulated progression: progress based on velocity and readiness.
   * Best for advanced trainees who need individualized progression.
   */
  private autoregulatedProgression(
    prescription: ExercisePrescription,
    sessionState: AdaptiveSessionState
  ): ProgressionDecision {
    // Get recent history
    const history = this.exerciseHistory.get(prescription.exerciseId) ?? [];
    
    // Check velocity trend
    const vl = sessionState.avgVelocityLoss;
    const [targetVlMin, targetVlMax] = prescription.velocityLossTarget ?? [20, 30];
    
    // Check recent trend
    let velocityTrendingUp = false;
    if (history.length >= 3) {
      const recentVls = history.slice(-3).map(h => h.avgVelocityLoss);
      velocityTrendingUp = recentVls.every(
        (v, i) => i === 0 || v < recentVls[i - 1]
      );
    }
    
    const increment = prescription.progressionIncrement;
    
    // Decision logic
    if (vl < targetVlMin - 5) {
      // Way under target - increase weight
      const newWeight = sessionState.adjustedWeight + increment;
      
      return {
        action: 'increase',
        weightChange: increment,
        reason: `VL ${Math.round(vl)}% is well under target - ready for more`,
        confidence: 'high',
        message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
      };
    }
    
    if (velocityTrendingUp && sessionState.avgRir >= 2) {
      // Getting easier over time
      const newWeight = sessionState.adjustedWeight + increment;
      
      return {
        action: 'increase',
        weightChange: increment,
        reason: 'Velocity improving over recent sessions',
        confidence: 'medium',
        message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
      };
    }
    
    if (vl > targetVlMax + 10) {
      // Way over target - decrease weight
      const newWeight = sessionState.adjustedWeight - increment;
      
      return {
        action: 'decrease',
        weightChange: -increment,
        reason: `VL ${Math.round(vl)}% is too high - reduce weight`,
        confidence: 'high',
        message: `Next time: Drop to ${newWeight} lbs to rebuild`,
      };
    }
    
    // In range - maintain
    return {
      action: 'maintain',
      weightChange: 0,
      reason: `VL ${Math.round(vl)}% is in target range`,
      confidence: 'high',
      message: 'Next time: Same weight, keep building',
    };
  }
  
  private makeDeloadDecision(
    prescription: ExercisePrescription,
    triggerType: string
  ): ProgressionDecision {
    const increment = prescription.progressionIncrement;
    const newWeight = (prescription.weightLbs ?? 0) - increment;
    
    return {
      action: 'decrease',
      weightChange: -increment,
      reason: `Deload triggered: ${triggerType}`,
      confidence: 'high',
      message: `Next time: Drop to ${newWeight} lbs to rebuild`,
    };
  }
  
  /**
   * Check if a deload week is needed.
   */
  checkForDeload(
    trainingLevel: TrainingLevel
  ): DeloadTrigger | null {
    // Time-based check
    const weeksBetweenDeloads = trainingLevel === TrainingLevel.INTERMEDIATE ? 5 : 6;
    
    if (this.weeksSinceDeload >= weeksBetweenDeloads) {
      return {
        triggerType: 'time',
        description: `It's been ${this.weeksSinceDeload} weeks since your last deload`,
        severity: 'moderate',
        detectedAt: Date.now(),
      };
    }
    
    // Performance-based check
    for (const [exerciseId, history] of this.exerciseHistory) {
      if (history.length >= 3) {
        const recent = history.slice(-3);
        
        // Check velocity trend (increasing = getting harder)
        const vls = recent.map(h => h.avgVelocityLoss);
        const vlsIncreasing = vls.every((v, i) => i === 0 || v > vls[i - 1]);
        
        if (vlsIncreasing) {
          return {
            triggerType: 'performance',
            description: `Performance declining on ${exerciseId}`,
            severity: 'moderate',
            detectedAt: Date.now(),
          };
        }
        
        // Check if consistently missing targets
        if (recent.every(h => !h.hitMinimumReps)) {
          return {
            triggerType: 'performance',
            description: `Consistently missing targets on ${exerciseId}`,
            severity: 'severe',
            detectedAt: Date.now(),
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Create a deload week prescription.
   */
  createDeloadWeek(trigger: DeloadTrigger): DeloadWeek {
    // Reset tracking
    this.lastDeloadDate = Date.now();
    this.weeksSinceDeload = 0;
    
    // Reset failure counts
    this.consecutiveFailures.clear();
    
    return {
      ...DEFAULT_DELOAD,
      trigger,
    };
  }
  
  /**
   * Call this at the end of each training week.
   */
  incrementWeek(): void {
    this.weeksSinceDeload++;
  }
  
  /**
   * Get performance trend for an exercise.
   */
  getExerciseTrend(
    exerciseId: string,
    lookback: number = 5
  ): {
    sessionsAnalyzed: number;
    weightTrend: 'increasing' | 'decreasing' | 'stable';
    weightChange: number;
    repChangePercent: number;
    velocityLossChange: number;
    improving: boolean;
  } | null {
    const history = this.exerciseHistory.get(exerciseId);
    
    if (!history || history.length < 2) {
      return null;
    }
    
    const recent = history.slice(-lookback);
    
    // Calculate trends
    const weights = recent.map(h => h.weight);
    const repsPerSet = recent.map(h => h.totalReps / h.setsCompleted);
    const vls = recent.map(h => h.avgVelocityLoss);
    
    const weightTrend: 'increasing' | 'decreasing' | 'stable' = 
      weights[weights.length - 1] > weights[0] ? 'increasing' :
      weights[weights.length - 1] < weights[0] ? 'decreasing' : 'stable';
    
    const repChange = repsPerSet[0] > 0
      ? ((repsPerSet[repsPerSet.length - 1] - repsPerSet[0]) / repsPerSet[0]) * 100
      : 0;
    
    const vlChange = vls[vls.length - 1] - vls[0];
    
    return {
      sessionsAnalyzed: recent.length,
      weightTrend,
      weightChange: weights[weights.length - 1] - weights[0],
      repChangePercent: Math.round(repChange * 10) / 10,
      velocityLossChange: Math.round(vlChange * 10) / 10,
      improving: weightTrend === 'increasing' || (repChange > 5 && vlChange < 0),
    };
  }
  
  /**
   * Export state for persistence.
   */
  exportState(): {
    exerciseHistory: Record<string, ExerciseSessionSummary[]>;
    consecutiveFailures: Record<string, number>;
    lastDeloadDate: number | null;
    weeksSinceDeload: number;
  } {
    return {
      exerciseHistory: Object.fromEntries(this.exerciseHistory),
      consecutiveFailures: Object.fromEntries(this.consecutiveFailures),
      lastDeloadDate: this.lastDeloadDate,
      weeksSinceDeload: this.weeksSinceDeload,
    };
  }
  
  /**
   * Import state from storage.
   */
  importState(state: {
    exerciseHistory: Record<string, ExerciseSessionSummary[]>;
    consecutiveFailures: Record<string, number>;
    lastDeloadDate: number | null;
    weeksSinceDeload: number;
  }): void {
    this.exerciseHistory = new Map(Object.entries(state.exerciseHistory));
    this.consecutiveFailures = new Map(Object.entries(state.consecutiveFailures));
    this.lastDeloadDate = state.lastDeloadDate;
    this.weeksSinceDeload = state.weeksSinceDeload;
  }
}

/**
 * Create a session summary from completed session state.
 */
export function createSessionSummary(
  sessionState: AdaptiveSessionState,
  prescription: ExercisePrescription
): ExerciseSessionSummary {
  const [minReps, maxReps] = sessionState.adjustedRepRange ?? sessionState.plannedRepRange;
  const repsPerSet = sessionState.totalReps / Math.max(1, sessionState.setsCompleted);
  
  return {
    exerciseId: sessionState.exerciseId,
    date: Date.now(),
    weight: sessionState.adjustedWeight,
    setsCompleted: sessionState.setsCompleted,
    totalReps: sessionState.totalReps,
    repRange: [minReps, maxReps],
    avgVelocityLoss: sessionState.avgVelocityLoss,
    avgRir: sessionState.avgRir,
    hitMinimumReps: repsPerSet >= minReps,
    hitTopOfRange: repsPerSet >= maxReps,
  };
}
