/**
 * Voltra Analytics Module
 * 
 * Velocity-based training analytics, metrics computation, and profile building.
 */

// Core VBT constants and utilities (canonical source)
export * from './velocity-constants';

// Load-velocity profile building
export * from './velocity-profile';

// Advanced workout analytics (tempo, work, quality)
// Note: VELOCITY_LOSS_TARGETS is re-exported from velocity-constants in advancedAnalytics
// for backward compatibility, but we exclude it here to avoid duplicate export
export {
  // Enums
  VelocityZone,
  RepQuality,
  
  // Types
  type RepQualityAnalysis,
  type IntentAnalysis,
  type TempoTarget,
  type TempoAnalysis,
  type VelocityMetrics,
  type RPEEstimate,
  type WorkMetrics,
  type RepAnalytics,
  type SetAnalytics,
  type LiveAnalytics,
  type WorkoutAnalytics,
  
  // Constants
  DEFAULT_TEMPO,
  
  // Classes
  WorkoutAnalyzer,
  
  // Functions - Tempo
  parseTempoString,
  formatTempo,
  getTempoTotal,
  
  // Functions - Analysis
  smoothVelocity,
  analyzeSet,
  getVelocityZoneDescription,
  getRepQualityDescription,
  getRepQualityColor,
  
  // Functions - VBT utilities
  computeVelocityLoss,
  estimateRIR,
  estimateRPE,
  getEffortLabel,
  getRIRDescription,
  getEffortBar,
  getRPEColor,
  computeLiveAnalytics,
  analyzeWorkout,
  getWorkoutSummaryMessage,
  getRecommendation,
} from './advancedAnalytics';
