# domain/planning

Unified planning system for exercise sessions - handles initial planning, intra-workout adaptation, and session-over-session progression through a single interface.

## Architecture

```
PlanningContext → planExercise() → PlanResult
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Initial       Adaptation     Discovery
     Plan          Strategy       Strategy
```

## Key Types

### TrainingGoal (Enum)

```typescript
import { TrainingGoal } from '@/domain/planning';

// Use enum values, not string literals
TrainingGoal.STRENGTH     // 'strength'
TrainingGoal.HYPERTROPHY  // 'hypertrophy'  
TrainingGoal.ENDURANCE    // 'endurance'
```

### PlanningContext (Input)

```typescript
interface PlanningContext {
  exerciseId: string;
  goal: TrainingGoal;
  sessionMetrics?: SessionMetrics;      // Current fatigue/readiness
  historicalMetrics?: HistoricalMetrics; // Past performance
  completedSets: Set[];                  // Sets done so far
  overrides?: PlanningOverrides;         // Manual adjustments
}
```

### PlanResult (Output)

```typescript
interface PlanResult {
  nextSet: PlannedSet | null;      // Next set to perform
  remainingSets: PlannedSet[];     // Future sets
  restSeconds: number;             // Recommended rest
  adjustments: PlanAdjustment[];   // What changed and why
  message?: string;                // User feedback
  shouldStop?: boolean;            // Terminate session?
}
```

## Strategies

### Standard Strategy (`strategies/standard.ts`)

Intra-workout adaptation based on current performance:

- `calculateWeightAdjustment()` - Adjust weight based on fatigue
- `calculateRestAdjustment()` - Adjust rest based on performance
- `shouldStop()` - Detect if session should terminate
- `canAddSet()` - Evaluate adding extra sets

### Discovery Strategy (`strategies/discovery.ts`)

Weight discovery workflow for new exercises:

- `getFirstDiscoveryStep()` - Initial weight recommendation
- `getNextDiscoveryStep()` - Progress through discovery
- `generateRecommendation()` - Final working weight recommendation

### Progression Strategy (`strategies/progression.ts`)

Session-over-session progression:

- `getProgressionRecommendation()` - Next session's plan
- `checkDeloadNeeded()` - Detect overreaching
- `createDeloadPlan()` - Generate recovery plan

## Usage

```typescript
import { planExercise, TrainingGoal } from '@/domain/planning';

// Initial plan (no completed sets)
const initialResult = planExercise({
  exerciseId: 'bench_press',
  goal: TrainingGoal.HYPERTROPHY,
  completedSets: [],
});

// Mid-workout adaptation (has completed sets)
const adaptedResult = planExercise({
  exerciseId: 'bench_press', 
  goal: TrainingGoal.HYPERTROPHY,
  completedSets: session.completedSets,
  sessionMetrics: currentMetrics,
});

// Use the result
if (adaptedResult.nextSet) {
  console.log(`Next: ${adaptedResult.nextSet.weight} lbs × ${adaptedResult.nextSet.targetReps}`);
}
```

## Constants

Research-backed defaults exported from `types.ts`:

```typescript
// Velocity loss targets by goal [min, max]
VELOCITY_LOSS_TARGETS[TrainingGoal.STRENGTH]     // [5, 15]
VELOCITY_LOSS_TARGETS[TrainingGoal.HYPERTROPHY]  // [20, 30]

// Rest periods by goal (seconds)
REST_DEFAULTS[TrainingGoal.STRENGTH]     // 180
REST_DEFAULTS[TrainingGoal.HYPERTROPHY]  // 120

// RIR targets by exercise type
RIR_DEFAULTS.compound   // 2
RIR_DEFAULTS.isolation  // 1
```

## Related Domains

- `domain/workout` - Session execution, metrics computation, plan/session models
- `domain/vbt` - Load-velocity profiles, 1RM estimation
- `domain/exercise` - Exercise definitions and metadata
