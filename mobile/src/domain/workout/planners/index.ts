/**
 * Plan generators barrel export.
 *
 * NOTE: These planners will move to domain/planning when that domain is created.
 */

export {
  type StandardPlanOptions,
  createStandardPlan,
  createStandardPlanWithWarmups,
  getRecommendedRest,
  getRecommendedRepRange,
} from './standard-planner';

export {
  type DiscoveryPlanOptions,
  type DiscoveryContinuationCheck,
  createDiscoveryPlan,
  createDiscoveryPlanWithWeights,
  getNextDiscoveryWeight,
  checkDiscoveryContinuation,
} from './discovery-planner';
