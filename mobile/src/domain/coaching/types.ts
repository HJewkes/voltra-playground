/**
 * Coaching Context Types
 *
 * Structured types that represent the context sent to Claude
 * for AI coaching responses. Designed for serialization into
 * a Claude Messages API prompt.
 */

// =============================================================================
// Shared Signal Types
// =============================================================================

/** Severity level for velocity-based warnings. */
export type VelocityWarningSeverity = 'info' | 'warning' | 'critical';

// =============================================================================
// Current Set Summary
// =============================================================================

export interface SetSummary {
  exerciseName: string;
  exerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
  meanVelocity: number;
  peakVelocity: number;
  velocityLossPercent: number;
  estimatedRPE: number;
  estimatedRIR: number;
  tempo?: {
    concentricMs: number;
    eccentricMs: number;
  };
}

// =============================================================================
// Session Context
// =============================================================================

export interface SessionContext {
  exerciseName: string;
  setsCompleted: number;
  setsPlanned: number;
  sessionDurationMinutes: number;
  fatigueTrend: FatigueTrend;
  trainingGoal: string;
}

export interface FatigueTrend {
  velocityRecoveryPercent: number;
  repDropPercent: number;
  isJunkVolume: boolean;
  fatigueLevel: number;
}

// =============================================================================
// Athlete History
// =============================================================================

export interface AthleteHistory {
  recentSessions: HistoricalSession[];
  baselineVelocityAtLoad: number | null;
  personalRecords: PersonalRecordSummary[];
  sessionCount: number;
}

export interface HistoricalSession {
  date: number;
  load: number;
  sets: number;
  totalReps: number;
  avgMeanVelocity: number;
  avgVelocityLossPercent: number;
}

export interface PersonalRecordSummary {
  type: 'max_weight' | 'max_reps' | 'max_velocity' | 'max_volume';
  value: number;
  date: number;
}

// =============================================================================
// Auto-Regulation Signals
// =============================================================================

export interface AutoRegulationSignals {
  readinessZone: 'green' | 'yellow' | 'red';
  readinessConfidence: number;
  velocityWarningSeverity: VelocityWarningSeverity | null;
  velocityWarningMessage: string | null;
  junkVolumeDetected: boolean;
  loadSuggestion: LoadSuggestionSummary | null;
}

export interface LoadSuggestionSummary {
  currentWeight: number;
  suggestedWeight: number;
  direction: 'increase' | 'decrease' | 'maintain';
  reason: string;
}

// =============================================================================
// Previous Coaching
// =============================================================================

export interface PreviousCoachingCue {
  message: string;
  timestamp: number;
  setNumber: number;
  followed: boolean | null;
}

// =============================================================================
// Full Coaching Context
// =============================================================================

export interface CoachingContext {
  currentSet: SetSummary;
  session: SessionContext;
  athleteHistory: AthleteHistory;
  autoRegulation: AutoRegulationSignals;
  previousCues: PreviousCoachingCue[];
  generatedAt: number;
}
