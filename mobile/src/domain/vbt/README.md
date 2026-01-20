# VBT Domain

Velocity-Based Training (VBT) reference data, constants, and load-velocity profile building.

## Purpose

Provides the scientific foundation for VBT features:
- Reference constants for velocity-1RM relationships
- Training zone definitions
- Load-velocity profile building and analysis
- 1RM estimation from velocity data

## Architecture

```
domain/vbt/
├── constants.ts   # VBT reference data and utility functions
├── profile.ts     # Load-velocity profile building
└── index.ts       # Public API exports
```

## Key Exports

### Constants (`constants.ts`)
- `VELOCITY_AT_PERCENT_1RM` - Velocity values at different %1RM
- `TRAINING_ZONES` - Target %1RM ranges per training goal
- `REP_RANGES` - Target rep ranges per training goal
- `VELOCITY_LOSS_TARGETS` - VL thresholds for training goals
- `VELOCITY_RIR_MAP` - Velocity loss to RIR/RPE mapping

### Utility Functions
- `estimatePercent1RMFromVelocity(velocity)` - Estimate %1RM from velocity
- `getTargetVelocityForGoal(goal)` - Get target velocity range
- `categorizeVelocity(velocity)` - Categorize as fast/moderate/slow/grinding
- `suggestNextWeight(weight, velocity, goal)` - Weight adjustment recommendation

### Profile Building (`profile.ts`)
- `buildLoadVelocityProfile(exerciseId, dataPoints)` - Build profile from data
- `generateWorkingWeightRecommendation(profile, goal)` - Get weight recommendations
- `estimate1RMFromSet(weight, reps, velocity)` - Estimate 1RM from a set

## Usage

```typescript
import { 
  VELOCITY_AT_PERCENT_1RM,
  TRAINING_ZONES,
  buildLoadVelocityProfile,
  generateWorkingWeightRecommendation,
} from '@/domain/vbt';
import { TrainingGoal } from '@/domain/planning';

// Build profile from discovery sets
const profile = buildLoadVelocityProfile('bench-press', [
  { weight: 135, velocity: 0.85, timestamp: Date.now() },
  { weight: 185, velocity: 0.55, timestamp: Date.now() },
]);

// Get working weight recommendation (use enum values)
const rec = generateWorkingWeightRecommendation(profile, TrainingGoal.HYPERTROPHY);
console.log(`Working weight: ${rec.workingWeight} lbs`);
```

## Research Basis

- González-Badillo & Sánchez-Medina (2010) - Load-velocity relationship
- Pareja-Blanco et al. (2017) - VL thresholds and adaptations
- Sánchez-Medina & González-Badillo (2011) - Velocity loss as fatigue indicator
- Rodiles-Guerrero et al. (2020) - Cable machine VL thresholds

## Related Domains

- `domain/workout` - Real-time velocity computation and set metrics
- `domain/planning` - Training planning, adaptation, and weight discovery
