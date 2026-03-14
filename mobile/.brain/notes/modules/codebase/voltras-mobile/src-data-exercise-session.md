---
title: "Architecture: src/data/exercise-session"
type: architecture
tier: slow
module: codebase
module-path: src/data/exercise-session
language: typescript
exports-hash: "1b3bb9ebfab94c6bdf9f7ad164e11337331207ffe929231b6a46a4ea6a6ad2e4"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.413Z
modified: 2026-03-14T15:53:10.413Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| createExerciseSessionRepository | function | export function createExerciseSessionRepository( adapter: StorageAdapter ): ExerciseSessionRepository |
| ExerciseSessionRepository | interface | export interface ExerciseSessionRepository |
| ExerciseSessionRepositoryImpl | class | export class ExerciseSessionRepositoryImpl implements ExerciseSessionRepository |
| ExerciseSessionSummary | interface | export interface ExerciseSessionSummary |
| fromLegacyStoredSessionSet | function | export function fromLegacyStoredSessionSet(stored: LegacyStoredSessionSet): CompletedSet |
| fromStoredExerciseSession | function | export function fromStoredExerciseSession(stored: StoredExerciseSession): ExerciseSession |
| fromStoredPlan | function | export function fromStoredPlan(stored: StoredExercisePlan): ExercisePlan |
| fromStoredSessionSet | function | export function fromStoredSessionSet(stored: StoredSessionSet): CompletedSet |
| LegacyStoredRep | interface | export interface LegacyStoredRep |
| LegacyStoredSessionSet | interface | export interface LegacyStoredSessionSet |
| SessionStatus | type | export type SessionStatus = 'in_progress' \| 'completed' \| 'abandoned' |
| StoredExercisePlan | interface | export interface StoredExercisePlan |
| StoredExerciseSession | interface | export interface StoredExerciseSession |
| StoredPhaseAggregates | interface | export interface StoredPhaseAggregates |
| StoredRep | interface | export interface StoredRep |
| StoredSessionSet | interface | export interface StoredSessionSet |
| TerminationReason | type | export type TerminationReason = |
| toExerciseSessionSummary | function | export function toExerciseSessionSummary(session: StoredExerciseSession): ExerciseSessionSummary |
| toStoredExerciseSession | function | export function toStoredExerciseSession( session: ExerciseSession, status: 'in_progress' \| 'completed' \| 'abandoned', terminationReason?: TerminationReason, rawSamplesForLastSet?: WorkoutSample[] ): StoredExerciseSession |
| toStoredPlan | function | export function toStoredPlan(plan: ExercisePlan): StoredExercisePlan |
| toStoredSessionSet | function | export function toStoredSessionSet( set: CompletedSet, setIndex: number, rawSamples?: WorkoutSample[] ): StoredSessionSet |

## Dependencies

### Internal

- `./exercise-session-converters` — toExerciseSessionSummary
- `./exercise-session-schema` — ExerciseSessionSummary, StoredExerciseSession

### External

- `@/data/adapters` — STORAGE_KEYS, StorageAdapter
- `@/data/debug-config` — isDebugTelemetryEnabled
- `@/domain/exercise` — EXERCISE_CATALOG, createExercise
- `@/domain/planning` — TrainingGoal
- `@/domain/workout` — PlanSource, PlannedSet
- `@voltras/workout-analytics` — WorkoutSample

## Invariants

*(none yet)*
