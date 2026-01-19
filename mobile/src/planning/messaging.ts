/**
 * Voltra User Messaging System
 * 
 * Translates technical data into user-friendly coaching messages.
 * Provides live feedback, post-set summaries, and progression guidance.
 */

import { ReadinessZone, TrainingGoal } from './models';
import { ReadinessCheckResult } from './readiness';
import { SetPerformance, NextSetRecommendation } from './adaptation';
import { ProgressionDecision } from './progression';

// =============================================================================
// Types
// =============================================================================

export type MessageTone = 'encouraging' | 'neutral' | 'warning' | 'success';

export interface UserMessage {
  text: string;
  tone: MessageTone;
  /** Optional brief technical detail */
  detail?: string;
  /** Priority (higher = show first) */
  priority: number;
}

// =============================================================================
// Live Rep Feedback
// =============================================================================

/**
 * Get feedback after each rep during a set.
 */
export function getRepProgressMessage(
  repNumber: number,
  repVelocity: number,
  firstRepVelocity: number | null,
  targetVelocityLoss: [number, number],
  estimatedRir: number,
  targetRir: number
): UserMessage {
  // Calculate velocity loss if we have first rep data
  let velocityLoss = 0;
  if (firstRepVelocity && firstRepVelocity > 0) {
    velocityLoss = ((firstRepVelocity - repVelocity) / firstRepVelocity) * 100;
  }
  
  const [targetMin, targetMax] = targetVelocityLoss;
  
  // First rep - just acknowledg
  if (repNumber === 1) {
    if (repVelocity > 0.5) {
      return {
        text: 'Strong start!',
        tone: 'encouraging',
        priority: 1,
      };
    }
    return {
      text: 'Good',
      tone: 'neutral',
      priority: 1,
    };
  }
  
  // Check velocity loss vs target
  if (velocityLoss >= targetMax) {
    // At or past target - consider stopping
    if (estimatedRir <= targetRir) {
      return {
        text: 'Target hit - stop when ready',
        tone: 'success',
        detail: `RIR ~${Math.round(estimatedRir)}`,
        priority: 3,
      };
    }
    return {
      text: 'Good effort - almost there',
      tone: 'encouraging',
      detail: `VL ${Math.round(velocityLoss)}%`,
      priority: 2,
    };
  }
  
  if (velocityLoss >= targetMin) {
    // In target zone
    return {
      text: 'In the zone - keep going',
      tone: 'encouraging',
      detail: `VL ${Math.round(velocityLoss)}%`,
      priority: 2,
    };
  }
  
  // Under target - still have reps
  return {
    text: repNumber % 2 === 0 ? 'Good' : 'Keep it up',
    tone: 'neutral',
    priority: 1,
  };
}

// =============================================================================
// Tempo Feedback
// =============================================================================

/**
 * Get feedback about rep tempo during or after a rep.
 */
export function getTempoFeedback(
  actualTempo: string,
  targetTempo: string | null
): UserMessage | null {
  if (!targetTempo) {
    return null;
  }
  
  const actual = parseTempoString(actualTempo);
  const target = parseTempoString(targetTempo);
  
  if (!actual || !target) {
    return null;
  }
  
  // Check each component
  const eccDiff = actual.eccentric - target.eccentric;
  const topDiff = actual.topPause - target.topPause;
  const conDiff = actual.concentric - target.concentric;
  const botDiff = actual.bottomPause - target.bottomPause;
  
  const tolerance = 0.5; // seconds tolerance
  
  // Prioritize feedback (most important first)
  if (Math.abs(eccDiff) > tolerance) {
    if (eccDiff > 0) {
      return {
        text: 'Speed up the lowering phase',
        tone: 'neutral',
        detail: `Target ${target.eccentric}s, did ${actual.eccentric.toFixed(1)}s`,
        priority: 2,
      };
    } else {
      return {
        text: 'Slow down the lowering',
        tone: 'neutral',
        detail: `Target ${target.eccentric}s, did ${actual.eccentric.toFixed(1)}s`,
        priority: 2,
      };
    }
  }
  
  if (Math.abs(conDiff) > tolerance && target.concentric > 0.5) {
    if (conDiff > 0) {
      return {
        text: 'Push a bit faster',
        tone: 'neutral',
        detail: `Target ${target.concentric}s, did ${actual.concentric.toFixed(1)}s`,
        priority: 2,
      };
    }
    // Don't tell them to slow down concentric - faster is usually fine
  }
  
  // Good tempo match
  return {
    text: 'Good tempo!',
    tone: 'success',
    priority: 1,
  };
}

function parseTempoString(tempo: string): {
  eccentric: number;
  topPause: number;
  concentric: number;
  bottomPause: number;
} | null {
  const parts = tempo.split('-').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }
  return {
    eccentric: parts[0],
    topPause: parts[1],
    concentric: parts[2],
    bottomPause: parts[3],
  };
}

// =============================================================================
// ROM Warnings
// =============================================================================

/**
 * Get warning if ROM seems shortened.
 */
export function getRomWarning(
  currentRom: number,
  baselineRom: number | null,
  threshold: number = 0.85
): UserMessage | null {
  if (baselineRom === null || currentRom <= 0 || baselineRom <= 0) {
    return null;
  }
  
  const romPercent = currentRom / baselineRom;
  
  if (romPercent < threshold) {
    return {
      text: 'Full range of motion',
      tone: 'warning',
      detail: `${Math.round((1 - romPercent) * 100)}% shorter than usual`,
      priority: 3,
    };
  }
  
  return null;
}

// =============================================================================
// Post-Set Summaries
// =============================================================================

/**
 * Generate a friendly post-set summary.
 */
export function getPostSetSummary(
  setNumber: number,
  performance: SetPerformance,
  targetVelocityLoss: [number, number],
  targetRir: number
): UserMessage[] {
  const messages: UserMessage[] = [];
  const [targetMin, targetMax] = targetVelocityLoss;
  
  // Main performance message
  const vl = performance.velocityLossPercent;
  const rir = performance.estimatedRir;
  
  // Performance summary
  if (vl >= targetMin && vl <= targetMax + 5) {
    // In target zone
    if (rir >= targetRir - 1 && rir <= targetRir + 1) {
      messages.push({
        text: `Set ${setNumber}: Perfect! Right on target`,
        tone: 'success',
        detail: `${performance.reps} reps, VL ${Math.round(vl)}%, RIR ~${Math.round(rir)}`,
        priority: 3,
      });
    } else {
      messages.push({
        text: `Set ${setNumber}: Good set`,
        tone: 'encouraging',
        detail: `${performance.reps} reps, VL ${Math.round(vl)}%`,
        priority: 2,
      });
    }
  } else if (vl < targetMin) {
    // Stopped too early
    messages.push({
      text: `Set ${setNumber}: Had more in the tank`,
      tone: 'neutral',
      detail: `Could have pushed ${Math.round(targetMin - vl)}% harder`,
      priority: 2,
    });
  } else {
    // Pushed past target
    if (vl > targetMax + 15) {
      messages.push({
        text: `Set ${setNumber}: Pushed really hard`,
        tone: 'warning',
        detail: `VL ${Math.round(vl)}% - consider stopping earlier`,
        priority: 3,
      });
    } else {
      messages.push({
        text: `Set ${setNumber}: Strong effort!`,
        tone: 'encouraging',
        detail: `${performance.reps} reps`,
        priority: 2,
      });
    }
  }
  
  // Grinding detection
  if (performance.grindingDetected) {
    messages.push({
      text: 'Grinding detected on last rep(s)',
      tone: 'neutral',
      detail: 'Building grit, but watch fatigue',
      priority: 1,
    });
  }
  
  return messages;
}

// =============================================================================
// Readiness Messages
// =============================================================================

/**
 * Get user-friendly readiness message.
 */
export function getReadinessMessage(result: ReadinessCheckResult): UserMessage {
  switch (result.zone) {
    case ReadinessZone.GREEN:
      if (result.velocityPercent > 105) {
        return {
          text: "You're feeling strong today!",
          tone: 'success',
          detail: result.weightAdjustment > 0 
            ? `Adding ${result.weightAdjustment} lbs` 
            : undefined,
          priority: 3,
        };
      }
      return {
        text: 'Ready to train!',
        tone: 'neutral',
        priority: 2,
      };
      
    case ReadinessZone.YELLOW:
      return {
        text: "A bit off today - that's okay",
        tone: 'neutral',
        detail: result.weightAdjustment < 0 
          ? `Dropping ${Math.abs(result.weightAdjustment)} lbs` 
          : undefined,
        priority: 2,
      };
      
    case ReadinessZone.RED:
      return {
        text: 'Your body needs recovery',
        tone: 'warning',
        detail: 'Going lighter today - smart choice',
        priority: 3,
      };
  }
}

// =============================================================================
// Next Set Guidance
// =============================================================================

/**
 * Get guidance message for the next set.
 */
export function getNextSetGuidance(rec: NextSetRecommendation): UserMessage[] {
  const messages: UserMessage[] = [];
  
  if (rec.shouldStop) {
    messages.push({
      text: rec.message,
      tone: 'success',
      priority: 3,
    });
    return messages;
  }
  
  if (rec.optionalExtraSet) {
    messages.push({
      text: rec.message,
      tone: 'neutral',
      priority: 2,
    });
    return messages;
  }
  
  // Weight adjustment
  if (rec.weightChanged) {
    const tone: MessageTone = rec.weight > 0 ? 'success' : 'neutral';
    messages.push({
      text: rec.message,
      tone,
      priority: 3,
    });
  } else {
    messages.push({
      text: rec.message,
      tone: 'neutral',
      priority: 2,
    });
  }
  
  // Rest period
  if (rec.restExtended) {
    messages.push({
      text: rec.restMessage,
      tone: 'neutral',
      priority: 1,
    });
  }
  
  return messages;
}

// =============================================================================
// Progression Messages
// =============================================================================

/**
 * Get user-friendly progression message.
 */
export function getProgressionMessage(decision: ProgressionDecision): UserMessage {
  switch (decision.action) {
    case 'increase':
      return {
        text: decision.message,
        tone: 'success',
        detail: decision.reason,
        priority: 3,
      };
      
    case 'maintain':
      return {
        text: decision.message,
        tone: 'neutral',
        detail: decision.reason,
        priority: 2,
      };
      
    case 'decrease':
      return {
        text: decision.message,
        tone: 'neutral',
        detail: "It's smart to rebuild",
        priority: 2,
      };
      
    case 'deload':
      return {
        text: 'Time for a recovery week',
        tone: 'neutral',
        detail: 'Your body will thank you',
        priority: 3,
      };
  }
}

// =============================================================================
// Workout Complete Messages
// =============================================================================

/**
 * Get summary message after workout is complete.
 */
export function getWorkoutCompleteMessage(
  totalSets: number,
  totalReps: number,
  totalVolume: number,
  avgRir: number,
  avgVelocityLoss: number,
  goal: TrainingGoal
): UserMessage[] {
  const messages: UserMessage[] = [];
  
  // Main completion message
  messages.push({
    text: 'Great workout!',
    tone: 'success',
    detail: `${totalSets} sets, ${totalReps} reps, ${Math.round(totalVolume)} lbs volume`,
    priority: 3,
  });
  
  // Goal-specific feedback
  const [targetMin, targetMax] = {
    [TrainingGoal.STRENGTH]: [5, 15],
    [TrainingGoal.HYPERTROPHY]: [20, 30],
    [TrainingGoal.ENDURANCE]: [35, 50],
  }[goal];
  
  if (avgVelocityLoss >= targetMin && avgVelocityLoss <= targetMax) {
    messages.push({
      text: 'Dialed in for your goal',
      tone: 'success',
      detail: `Avg VL ${Math.round(avgVelocityLoss)}% - right on target`,
      priority: 2,
    });
  } else if (avgVelocityLoss < targetMin) {
    messages.push({
      text: 'Stayed fresh - good for strength',
      tone: 'neutral',
      detail: `Avg VL ${Math.round(avgVelocityLoss)}%`,
      priority: 2,
    });
  } else {
    messages.push({
      text: 'Pushed hard today!',
      tone: 'encouraging',
      detail: `Avg VL ${Math.round(avgVelocityLoss)}%`,
      priority: 2,
    });
  }
  
  // RIR feedback
  if (avgRir >= 1 && avgRir <= 3) {
    messages.push({
      text: 'Smart intensity management',
      tone: 'success',
      detail: `Avg RIR ~${Math.round(avgRir)}`,
      priority: 1,
    });
  } else if (avgRir < 1) {
    messages.push({
      text: 'Went all out!',
      tone: 'neutral',
      detail: 'Make sure to recover well',
      priority: 1,
    });
  }
  
  return messages;
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Sort messages by priority (highest first).
 */
export function sortMessages(messages: UserMessage[]): UserMessage[] {
  return [...messages].sort((a, b) => b.priority - a.priority);
}

/**
 * Get a single top-priority message (for space-constrained UI).
 */
export function getTopMessage(messages: UserMessage[]): UserMessage | null {
  if (messages.length === 0) return null;
  return sortMessages(messages)[0];
}

/**
 * Convert message tone to Tailwind color class.
 */
export function toneToColor(tone: MessageTone): string {
  switch (tone) {
    case 'success':
      return 'text-green-400';
    case 'warning':
      return 'text-yellow-400';
    case 'encouraging':
      return 'text-blue-400';
    case 'neutral':
    default:
      return 'text-zinc-300';
  }
}

/**
 * Convert message tone to background color class.
 */
export function toneToBgColor(tone: MessageTone): string {
  switch (tone) {
    case 'success':
      return 'bg-green-900/30';
    case 'warning':
      return 'bg-yellow-900/30';
    case 'encouraging':
      return 'bg-blue-900/30';
    case 'neutral':
    default:
      return 'bg-zinc-800';
  }
}
