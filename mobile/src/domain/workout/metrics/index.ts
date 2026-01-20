/**
 * Workout Metrics Module
 *
 * Session metrics computation and velocity baseline management.
 * These metrics are inputs to the planning domain.
 */

// Types
export {
  type StrengthEstimate,
  type ReadinessEstimate,
  type ReadinessAdjustments,
  type FatigueEstimate,
  type SessionMetrics,
  READINESS_THRESHOLDS,
  EXPECTED_REP_DROP,
  JUNK_VOLUME_THRESHOLD,
  VELOCITY_GRINDING_THRESHOLD,
  createEmptyStrengthEstimate,
  createDefaultReadinessEstimate,
  createEmptyFatigueEstimate,
  createEmptySessionMetrics,
} from './types';

// Baseline
export {
  type VelocityBaseline,
  type StoredVelocityBaseline,
  createVelocityBaseline,
  getBaselineVelocity,
  interpolateBaseline,
  updateBaseline,
  setBaselineValue,
  baselineToStored,
  storedToBaseline,
  exportBaselines,
  importBaselines,
} from './baseline';

// Session metrics computation
export {
  computeSessionMetrics,
  computeStrengthEstimate,
  computeReadinessEstimate,
  estimateReadinessFromFirstRep,
  computeFatigueEstimate,
  checkVelocityRecovery,
  hasAdequateProfileData,
  isSetWithinExpectations,
  getExpectedPerformance,
} from './session-metrics';
