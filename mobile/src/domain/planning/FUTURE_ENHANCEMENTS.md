# Future Enhancements: Exercise Session & Training Intelligence

This document captures future enhancement ideas and architectural directions deferred from V1 implementation. These represent the next evolution of the exercise session system.

---

## 1. Intelligent Planning & Adaptation

### Planning Intelligence

When generating a plan, consider:

- **Exercise goal**: Target fatigue level, intensity zone, volume targets
- **User training state**:
  - Muscle warmth/fatigue (from earlier exercises in session)
  - Strength levels / velocity profile
  - Training history for this exercise
- **Progression rules**: How to increase weight/reps over sessions

### Adaptation Intelligence

After each set, an adaptation controller could:

- Compare actual vs target RPE (using velocity profile to estimate RPE)
- Adjust remaining sets based on:
  - RPE deviation (too hard/easy)
  - Junk volume detection (rep drop > 50%)
  - ROM issues
  - Fatigue accumulation
- Return modified remaining sets with justification

**Potential interface:**

```typescript
interface AdaptationResult {
  modifiedPlan: PlannedSet[];  // Updated remaining sets
  justification: string;       // Why the change was made
  confidence: 'high' | 'medium' | 'low';
}

function adaptPlan(
  session: ExerciseSession,
  lastSet: Set,
  velocityProfile: LoadVelocityProfile
): AdaptationResult;
```

---

## 2. 1RM-Based Planning & Adaptation

### Core Insight

Use 1RM (one-rep max) as the common currency across discovery and training.

### 1RM Estimation from Set Data

```
weight + reps + RPE → estimated 1RM

Example: 200 lbs × 5 reps @ RPE 8
  RPE 8 = 2 RIR → could do 7 reps at this weight
  7 reps ≈ 83% 1RM (standard tables)
  1RM estimate = 200 / 0.83 ≈ 241 lbs
```

### Confidence Weighting

| History | In-session weight | Historical weight |
|---------|-------------------|-------------------|
| None (discovery) | 100% | 0% |
| Some | 30% | 70% |
| Extensive | 10% | 90% |

### Applications

**Discovery termination:** Look for 1RM estimate stability/convergence across sets rather than just velocity grinding.

**Edge case - very low RPE:** If RPE < 5, the weight is too light for reliable 1RM projection. Use fixed increment instead.

### Future Planning Model

```typescript
interface PlannedSet {
  // Instead of absolute weight:
  targetPercentage1RM?: number;  // e.g., 0.75 for 75% 1RM
  // Resolved to actual weight at execution time based on current 1RM estimate
}
```

This unifies:

- **Discovery** = building initial 1RM estimate
- **Training** = using 1RM estimate for load selection
- **Adaptation** = updating 1RM estimate from in-session performance

### V1 Enhancement Opportunity

Track estimated 1RM from each set during discovery (weight × reps → 1RM using standard tables). Could use 1RM convergence as additional termination signal alongside velocity grinding.

---

## 3. Overlap Between Planning & Adaptation

The line between "planning" and "adaptation" blurs:

- Current fatigue is input to planning
- Completed sets update fatigue, which could trigger re-planning
- Could be unified: planner generates next set dynamically based on all context
- **1RM estimate becomes the bridge** - plans specify % 1RM, adaptation updates the 1RM estimate

**Potential unified model:**

```typescript
interface DynamicPlanner {
  // Called before each set to get the next target
  getNextSet(session: ExerciseSession, context: TrainingContext): PlannedSet | null;
  
  // Context includes everything needed for intelligent decisions
  interface TrainingContext {
    velocityProfile: LoadVelocityProfile;
    estimated1RM: number;
    currentFatigue: FatigueState;
    trainingHistory: ExerciseHistory;
  }
}
```

---

## 4. Exercise Catalog

Full database with comprehensive exercise metadata:

```typescript
interface Exercise {
  id: string;
  name: string;
  
  // Muscle activation
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  activationPatterns?: MuscleActivationMap;
  
  // Movement classification
  movementPattern: MovementPattern;  // Push/Pull/Hinge/Squat/etc
  movementType: 'compound' | 'isolation';
  
  // Equipment
  equipmentRequired: Equipment[];
  voltrasSetup?: VoltrasSetup;  // Cable path, attachment, etc
  
  // Execution
  defaultTempo?: TempoTarget;
  rangeOfMotionNotes?: string;
  formCues?: string[];
  commonMistakes?: string[];
  
  // Metadata
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}
```

### Features

- Full ROM analysis with expected ranges
- Setup instructions with illustrations
- Form cues and common mistakes
- Equipment requirements and alternatives
- Muscle activation patterns

---

## 5. Workout Plans & Templates

Pre-defined workout templates with exercise ordering:

```typescript
interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  
  // Exercise sequence
  exercises: WorkoutExercise[];
  
  // Plan-level settings
  defaultRestBetweenExercises: number;
  estimatedDuration: number;  // minutes
  
  // Classification
  targetMuscleGroups: MuscleGroup[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  type: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom';
}

interface WorkoutExercise {
  exerciseId: string;
  
  // Can specify either concrete targets or % 1RM
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  targetPercentage1RM?: number;
  
  // Ordering
  supersetWith?: string[];  // Exercise IDs for supersets
  restAfter: number;
}
```

### Features

- Template library with common programs (PPL, Upper/Lower, etc.)
- Smart exercise ordering based on fatigue
- Superset/circuit support
- Time estimation

---

## 6. Mesocycles & Periodization

Multi-week progression planning:

```typescript
interface Mesocycle {
  id: string;
  name: string;
  
  // Duration
  weeks: number;
  currentWeek: number;
  
  // Progression
  weeklyPlans: WeeklyPlan[];
  progressionScheme: ProgressionScheme;
  
  // Goals
  primaryGoal: TrainingGoal;
  targetExercises: string[];
}

interface WeeklyPlan {
  weekNumber: number;
  workouts: WorkoutPlan[];
  volumeMultiplier: number;  // For progressive overload
  intensityTarget: number;   // % 1RM target
  isDeload: boolean;
}

type ProgressionScheme = 
  | 'linear'           // Add weight each week
  | 'undulating'       // Vary intensity throughout week
  | 'block'            // Hypertrophy → Strength → Peak
  | 'autoregulated';   // Adjust based on performance
```

### Features

- Deload week automation
- Progressive overload tracking
- Volume and intensity periodization
- Performance-based adjustments

---

## 7. Fatigue Management

Cross-exercise and systemic fatigue tracking:

```typescript
interface FatigueState {
  // Per muscle group
  muscleGroupFatigue: Map<MuscleGroup, FatigueLevel>;
  
  // Systemic
  systemicFatigue: FatigueLevel;
  
  // Time-based recovery
  lastWorkoutByMuscle: Map<MuscleGroup, number>;  // timestamp
  
  // Accumulated
  weeklyVolumeByMuscle: Map<MuscleGroup, number>;
}

interface FatigueLevel {
  current: number;       // 0-100
  recoveryRate: number;  // Per hour
  peakAllowed: number;   // Before performance degrades
}
```

### Features

- Real-time fatigue estimation during workout
- Recovery time predictions
- Workout readiness scoring
- Fatigue-aware exercise selection

---

## 8. Volume Tracking

Weekly muscle group volume accumulation:

```typescript
interface VolumeMetrics {
  exerciseId: string;
  muscleGroup: MuscleGroup;
  
  // Volume calculation
  sets: number;
  reps: number;
  totalVolume: number;  // weight × reps
  effectiveVolume: number;  // Adjusted for RPE/proximity to failure
  
  // Context
  timestamp: number;
  sessionId: string;
}

interface WeeklyVolumeSummary {
  weekStart: number;
  
  // By muscle group
  volumeByMuscle: Map<MuscleGroup, {
    totalSets: number;
    totalReps: number;
    totalVolume: number;
    effectiveVolume: number;
  }>;
  
  // Targets
  targetVolume: Map<MuscleGroup, number>;
  volumeStatus: Map<MuscleGroup, 'under' | 'optimal' | 'over'>;
}
```

### Features

- Weekly volume targets by muscle group
- Effective volume calculation (sets to failure)
- Volume landmarks (MRV, MEV, MAV)
- Visual volume distribution charts

---

## 9. Velocity Profile Evolution

Enhanced velocity-based training features:

```typescript
interface AdvancedVelocityProfile {
  exerciseId: string;
  
  // Core profile
  loadVelocityPoints: LoadVelocityDataPoint[];
  
  // Derived metrics
  estimated1RM: number;
  minVelocityThreshold: number;  // Velocity at 1RM
  loadVelocitySlope: number;
  r2: number;  // Regression quality
  
  // Fatigue tracking
  velocityLossCurve: VelocityLossProfile;
  
  // Historical
  profileHistory: ProfileSnapshot[];  // Track changes over time
}

interface VelocityLossProfile {
  // How velocity drops as fatigue accumulates
  velocityBySet: number[];
  velocityByRep: number[];
  
  // Thresholds
  junkVolumeVelocity: number;  // Below this = junk reps
  optimalStopVelocity: number;  // Recommended stop point
}
```

### Features

- Velocity loss patterns for fatigue estimation
- Personalized velocity zones (speed-strength, etc.)
- Velocity-based autoregulation
- Profile tracking over time

---

## 10. Smart Auto-Stop Enhancements

More sophisticated recording termination:

```typescript
interface AutoStopConfig {
  // Rep-based
  targetReps: number;
  autoStopOnTarget: boolean;
  
  // Velocity-based
  velocityFloorThreshold: number;  // Absolute minimum
  velocityDropThreshold: number;   // % drop from baseline
  
  // RPE-based
  targetRPE?: number;
  stopAtTargetRPE: boolean;
  
  // Time-based
  maxRepDuration: number;  // Stop if rep takes too long
  idleTimeout: number;
  
  // Form-based (future)
  stopOnROMIssue: boolean;
  romThreshold: number;
}
```

### Features

- Velocity-based fatigue detection
- ROM monitoring for partial detection
- Personalized thresholds based on history
- Haptic feedback for approaching limits

---

## 11. Session Resumption

Handle interrupted sessions gracefully:

```typescript
interface SessionResumption {
  // Detection
  hasInProgressSession(): Promise<boolean>;
  getInProgressSession(): Promise<StoredExerciseSession | null>;
  
  // Options
  resumeSession(sessionId: string): Promise<ExerciseSession>;
  discardSession(sessionId: string): Promise<void>;
  
  // Recovery
  recoverFromCrash(): Promise<RecoveryResult>;
}

interface RecoveryResult {
  recovered: boolean;
  session?: ExerciseSession;
  lostData?: {
    sets: number;
    reps: number;
  };
}
```

### Features

- App crash recovery
- Background termination handling
- Session state persistence
- Partial data recovery

---

## Implementation Priority

### Near-term (Post-V1)
1. Session resumption
2. 1RM tracking during discovery
3. Velocity profile history

### Medium-term
4. Exercise catalog expansion
5. Weekly volume tracking
6. Basic workout templates

### Long-term
7. Intelligent adaptation
8. Mesocycle planning
9. Fatigue management
10. Advanced auto-stop

---

## Related Documents

- `mobile/.cursor/rules/exercise-session.mdc` - Current patterns
- `mobile/.cursor/rules/domain.mdc` - Domain structure
- `mobile/src/domain/exercise/` - V1 implementation
