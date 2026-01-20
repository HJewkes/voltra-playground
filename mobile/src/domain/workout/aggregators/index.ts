/**
 * Workout aggregators - pure functions that compute metrics at each level.
 */

// Phase aggregator
export { aggregatePhase, computePhaseMetrics } from './phase-aggregator';

// Rep aggregator
export { aggregateRep, computeRepMetrics } from './rep-aggregator';

// Set aggregator
export {
  aggregateSet,
  createEmptySetMetrics,
  DEFAULT_CONFIG,
  type SetAggregatorConfig,
} from './set-aggregator';
