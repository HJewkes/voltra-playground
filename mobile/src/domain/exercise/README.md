# domain/exercise

Pure exercise definitions - metadata about exercises, not session state.

## Purpose

This domain contains exercise **definitions only**:
- What exercises exist
- Their muscle groups and movement patterns
- Display names and categorization

**Not in this domain:**
- Exercise sessions → `domain/workout/models/session.ts`
- Exercise plans → `domain/workout/models/plan.ts`
- Planning logic → `domain/planning/`

## Structure

```
domain/exercise/
├── types.ts      # Exercise interface, MuscleGroup enum
├── catalog.ts    # EXERCISE_CATALOG, getExercise, getAllExercises, createExercise
├── mappings.ts   # EXERCISE_MUSCLE_GROUPS, EXERCISE_TYPES, getExerciseName
└── index.ts      # Public exports
```

## Key Types

```typescript
// MuscleGroup enum
enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  QUADS = 'quads',
  HAMSTRINGS = 'hamstrings',
  GLUTES = 'glutes',
  CORE = 'core',
  CALVES = 'calves',
}

// Exercise interface
interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  isCompound: boolean;
}
```

## Usage

```typescript
import { 
  getExercise,
  getAllExercises,
  getExerciseName,
  MuscleGroup,
  EXERCISE_MUSCLE_GROUPS,
} from '@/domain/exercise';

// Get exercise by ID
const bench = getExercise('bench_press');
console.log(bench?.name); // "Bench Press"

// Get all exercises
const exercises = getAllExercises();

// Get display name (handles unknown IDs)
const name = getExerciseName('bench_press'); // "Bench Press"
const unknown = getExerciseName('custom_123'); // "Unknown Exercise"

// Filter by muscle group
const chestExercises = exercises.filter(e => 
  e.muscleGroups.includes(MuscleGroup.CHEST)
);
```

## Adding Exercises

Add to `EXERCISE_CATALOG` in `catalog.ts`:

```typescript
export const EXERCISE_CATALOG: Record<string, Exercise> = {
  bench_press: {
    id: 'bench_press',
    name: 'Bench Press',
    muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS, MuscleGroup.SHOULDERS],
    isCompound: true,
  },
  // Add new exercises here...
};
```

## Related Domains

- `domain/workout` - ExerciseSession, ExercisePlan (execution models)
- `domain/planning` - Planning logic for exercise sessions
