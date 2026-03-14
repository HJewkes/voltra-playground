---
title: "Architecture: src/data/exercises"
type: architecture
tier: slow
module: codebase
module-path: src/data/exercises
language: typescript
exports-hash: "3a3434be26daca6352457610c75b3c839496aed1de918ef10f10b8b5df16d52d"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.413Z
modified: 2026-03-14T15:53:10.413Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| bootstrapExercises | function | export async function bootstrapExercises( repo: ExerciseRepository, adapter: StorageAdapter ): Promise< |
| bootstrapExercises | const | export |
| createExerciseRepository | function | export function createExerciseRepository(adapter: StorageAdapter): ExerciseRepository |
| createExerciseRepository | const | export |
| EXERCISE_CATALOG_VERSION | const | export const EXERCISE_CATALOG_VERSION = 1 |
| ExerciseRepository | interface | export interface ExerciseRepository |
| ExerciseRepositoryImpl | class | export class ExerciseRepositoryImpl implements ExerciseRepository |
| ExerciseRepositoryImpl | const | export |
| export | type | export type |
| forceReseedCatalog | function | export async function forceReseedCatalog( repo: ExerciseRepository, adapter: StorageAdapter ): Promise< |
| forceReseedCatalog | const | export |
| StoredExercise | interface | export interface StoredExercise |

## Dependencies

### Internal

- `./exercise-repository` — ExerciseRepository
- `./exercise-schema` — EXERCISE_CATALOG_VERSION, StoredExercise

### External

- `@/data/adapters/types` — STORAGE_KEYS, StorageAdapter
- `@/domain/exercise` — EXERCISE_CATALOG, Exercise, MovementPattern, MuscleGroup, VoltrasSetup
- `@/domain/workout` — TempoTarget

## Invariants

*(none yet)*
