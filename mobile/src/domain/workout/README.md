# domain/workout

Hardware-agnostic workout data models, rep detection, aggregation logic, and exercise session management.

## Architecture

### Data Flow (Rep Detection)

```
WorkoutSample → RepDetector → RepBoundary
                    ↓
            PhaseAggregator → Phase
                    ↓
             RepAggregator → Rep
                    ↓
             SetAggregator → Set/SetMetrics
```

### Session Flow

```
ExercisePlan (PlannedSet[]) → ExerciseSession → completedSets (Set[])
         ↑                                              │
    Planners                                    checkTermination()
(standard/discovery)                                    │
                                               TerminationResult
```

## SetMetrics Tiered Computation

SetAggregator uses a three-tier computation model with clear data flow:

```
Rep[] → VelocityMetrics → FatigueAnalysis → EffortEstimate
        (measurements)    (patterns)        (RIR/RPE)
```

- **VelocityMetrics** - Raw quantitative data: baselines, deltas, per-rep trends
- **FatigueAnalysis** - Pattern detection: fatigueIndex, eccentricControlScore
- **EffortEstimate** - Final output: rir, rpe, confidence

This separation makes it clear what data feeds into what computation.

## Why This Exists

- Separates "how we measure" from "what we measure"
- Makes workout analytics testable without hardware mocks
- Enables future support for other devices
- Centralizes all metric computation in one place

## Key Types

- `WorkoutSample` - Normalized data point from any device
- `Phase` - Concentric/eccentric phase with metrics
- `Rep` - Complete repetition with phase-specific velocities
- `Set` - Collection of reps with fatigue analysis
- `SetMetrics` - Nested sub-models (VelocityMetrics, FatigueAnalysis, EffortEstimate)

## Detectors

State machines for detecting workout events from sample streams:

- `RepDetector` - Detects rep boundaries from WorkoutSamples
  - State machine: idle → concentric → (hold) → eccentric → idle
  - Returns `RepBoundary` with phase-specific samples when rep completes
  - Generic - works with any device that provides WorkoutSamples

```typescript
const detector = new RepDetector();

for (const sample of samples) {
  const boundary = detector.processSample(sample);
  if (boundary) {
    // Rep completed - aggregate phases
    const rep = aggregateRepFromBoundary(boundary);
  }
}
```

## Aggregators

All metric computation happens in `aggregators/`:

- `aggregatePhase()` - Computes PhaseMetrics from samples
- `aggregateRep()` - Computes RepMetrics from phases
- `aggregateSet()` - Computes SetMetrics using tiered computation

## Stats

Recording session statistics:

- `WorkoutStats` - Aggregate statistics for a recording (rep count, duration, force, etc.)
- `computeWorkoutStats()` - Computes stats from Rep array

## Configuration

The SetAggregator accepts a configuration object:

```typescript
interface SetAggregatorConfig {
  concentricWeight: number;       // Default: 0.6
  eccentricWeight: number;        // Default: 0.4
  eccentricSpeedupPenalty: number; // Default: 1.5
  baselineReps: number;           // Default: 2
}
```

## Adding New Metrics

To add a new metric:

1. Decide which tier it belongs to (velocity/fatigue/effort)
2. Add field to appropriate sub-model interface in `models/set.ts`
3. Add computation to the relevant function in `aggregators/set-aggregator.ts`
4. Done - no hardware code changes needed

## Utilities

UI helper functions in `utils/`:

- `getEffortLabel(rpe)` - Human-readable effort description
- `getRIRDescription(rir)` - Reps-in-reserve text
- `getEffortBar(rpe, width)` - Visual effort bar (█████░░░░░)
- `getRPEColor(rpe)` - Color code for RPE values

## Storage Models

For persistence, use stripped versions that omit phase objects:

- `StoredRep` - Rep with only `repNumber`, `timestamp`, and `metrics`
- `StoredSet` - Set metrics without raw rep data

Convert before saving:
```typescript
const storedReps = reps.map(r => ({
  repNumber: r.repNumber,
  timestamp: r.timestamp,
  metrics: r.metrics,
}));
```

## Usage

```typescript
import { 
  aggregateSet, 
  getEffortLabel,
  getRPEColor,
  type Rep, 
  type SetMetrics 
} from '@/domain/workout';

// Compute set metrics from completed reps
const metrics: SetMetrics = aggregateSet(reps, targetTempo);

// Access tiered data
console.log(metrics.velocity.concentricDelta);    // % change
console.log(metrics.fatigue.fatigueIndex);        // 0-100
console.log(metrics.effort.rir);                  // Reps in reserve
console.log(metrics.effort.confidence);           // 'high' | 'medium' | 'low'

// UI helpers
console.log(getEffortLabel(metrics.effort.rpe)); // "Hard"
console.log(getRPEColor(metrics.effort.rpe));    // "#f97316"
```

## Session & Plan Models

Exercise sessions and plans are defined in this domain (not in `domain/exercise`).

### PlannedSet

```typescript
interface PlannedSet {
  setNumber: number;      // 1-based display number
  weight: number;         // Target weight in lbs
  targetReps: number;     // Target rep count
  repRange?: [number, number];  // For double progression
  rirTarget: number;      // Target RIR (reps in reserve)
  isWarmup: boolean;      // Warmup vs working set
  targetTempo?: TempoTarget;
  targetROM?: number;
}
```

### ExercisePlan

```typescript
interface ExercisePlan {
  exerciseId: string;
  sets: PlannedSet[];
  defaultRestSeconds: number;
  goal?: TrainingGoal;    // From @/domain/planning
  generatedAt: number;
  generatedBy: PlanSource;
}
```

### Planners

Located in `planners/`:

- `createStandardPlan()` - Warmup + working sets
- `createDiscoveryPlan()` - Fixed weight increments for discovery

### Termination

Located in `session/termination.ts`:

```typescript
function checkTermination(
  session: ExerciseSession,
  lastSet: Set,
  isDiscovery: boolean
): TerminationResult;
```

Termination reasons:
- `plan_exhausted` - All planned sets complete
- `failure` - Zero reps on a set
- `velocity_grinding` - Velocity dropped below threshold
- `junk_volume` - 50%+ rep drop (standard only)
- `user_stopped` - Manual termination
