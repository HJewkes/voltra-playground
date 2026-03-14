---
title: "Architecture: src/domain/exercise"
type: architecture
tier: slow
module: codebase
module-path: src/domain/exercise
language: typescript
exports-hash: "c3befd6f86ceb78f0871d7204054e14a29b56e70c62173b2211df68c5f79d188"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.412Z
modified: 2026-03-14T15:53:10.412Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| createExercise | function | export function createExercise(base: Pick<Exercise, 'id' \| 'name'> & Partial<Exercise>): Exercise |
| Exercise | interface | export interface Exercise |
| EXERCISE_CATALOG | const | export const EXERCISE_CATALOG: Record<string, Exercise> = |
| EXERCISE_MUSCLE_GROUPS | const | export const EXERCISE_MUSCLE_GROUPS: Record<string, MuscleGroup> = |
| EXERCISE_TYPES | const | export const EXERCISE_TYPES: Record<string, ExerciseType> = |
| ExerciseType | type | export type ExerciseType = 'compound' \| 'isolation' |
| getAllExercises | function | export function getAllExercises(): Exercise[] |
| getExercise | function | export function getExercise(exerciseId: string): Exercise \| undefined |
| getExerciseMuscleGroup | function | export function getExerciseMuscleGroup(exerciseId: string): MuscleGroup \| undefined |
| getExerciseName | function | export function getExerciseName(exerciseId: string): string |
| getExercisesByMuscleGroup | function | export function getExercisesByMuscleGroup(muscleGroup: MuscleGroup): string[] |
| getExerciseType | function | export function getExerciseType(exerciseId: string): ExerciseType |
| getKnownExercises | function | export function getKnownExercises(): string[] |
| hasExercise | function | export function hasExercise(exerciseId: string): boolean |
| MovementPattern | type | export type MovementPattern = |
| MuscleGroup | const | export |
| MuscleGroup | enum | export enum MuscleGroup |
| type ExerciseType | const | export |
| type MovementPattern | const | export |
| type VoltrasSetup | const | export |
| VoltrasSetup | interface | export interface VoltrasSetup |

## Dependencies

### Internal

- `./types` — ExerciseType, MovementPattern, MuscleGroup, VoltrasSetup

### External

- `@/domain/workout` — TempoTarget

## Invariants

*(none yet)*
