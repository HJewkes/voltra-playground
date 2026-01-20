/**
 * VBT (Velocity-Based Training) Domain
 * 
 * Provides reference data, constants, and profile building for VBT.
 * Used by training planning, weight discovery, and analytics.
 */

// Constants and utility functions
export {
  // Reference data
  VELOCITY_AT_PERCENT_1RM,
  MINIMUM_VELOCITY_THRESHOLD,
  TRAINING_ZONES,
  REP_RANGES,
  VELOCITY_LOSS_TARGETS,
  VELOCITY_RIR_MAP,
  DISCOVERY_START_PERCENTAGES,
  PROFILE_CONFIDENCE_REQUIREMENTS,
  // Utility functions
  estimatePercent1RMFromVelocity,
  getTargetVelocityForGoal,
  categorizeVelocity,
  suggestNextWeight,
  // Types
  type VelocityTrend,
} from './constants';

// Load-velocity profile building
export {
  // Functions
  buildLoadVelocityProfile,
  estimateWeightForPercent1RM,
  estimateWeightForVelocity,
  predictVelocityAtWeight,
  addDataPointToProfile,
  generateWorkingWeightRecommendation,
  generateWarmupSets,
  estimate1RMFromSet,
  // Types
  type LoadVelocityDataPoint,
  type LoadVelocityProfile,
  type WorkingWeightRecommendation,
  type WarmupSet,
} from './profile';
