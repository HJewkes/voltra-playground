/**
 * Planning Strategies
 *
 * Strategy implementations for different planning scenarios:
 * - Standard: intra-workout adaptation (weight, rest, stop decisions)
 * - Discovery: weight discovery for new exercises
 * - Progression: workout-to-workout progression
 */

// Standard strategy (intra-workout)
export {
  type SetPerformance,
  type StandardStrategyConfig,
  type WeightAdjustmentResult,
  type RestAdjustmentResult,
  type StopDecision,
  type ExtraSetEligibility,
  EXPECTED_REP_DROP,
  calculateWeightAdjustment,
  calculateRestAdjustment,
  shouldStop,
  checkJunkVolume,
  canAddSet,
  getExpectedPerformance,
  isSetWithinExpectations,
  createAdjustment,
} from './standard';

// Discovery strategy
export {
  type DiscoveryState,
  type DiscoveryRecommendation,
  type UserEstimate,
  createDiscoveryState,
  getFirstDiscoveryStep,
  getNextDiscoveryStep,
  getVelocityExpectation,
  getQuickRecommendation,
} from './discovery';

// Progression strategy
export {
  type ProgressionContext,
  type ProgressionDecision,
  type DeloadTrigger,
  type DeloadWeek,
  type ExerciseTrend,
  DEFAULT_DELOAD,
  getProgressionRecommendation,
  linearProgression,
  doubleProgression,
  autoregulatedProgression,
  checkDeloadNeeded,
  createDeloadPlan,
  getExerciseTrend,
} from './progression';
