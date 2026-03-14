---
title: "Architecture: src/domain/workout/models"
type: architecture
tier: slow
module: codebase
module-path: src/domain/workout/models
language: typescript
exports-hash: "2c77206e7e6edb45b688e33fae7390c8a5c200292c9faf3d40579cb7cf24a4ac"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.409Z
modified: 2026-03-14T15:53:10.409Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| addCompletedSet | function | export function addCompletedSet(session: ExerciseSession, set: CompletedSet): ExerciseSession |
| clearRest | function | export function clearRest(session: ExerciseSession): ExerciseSession |
| ClusterBoundary | interface | export interface ClusterBoundary |
| compareSetAtIndex | function | export function compareSetAtIndex( session: ExerciseSession, index: number ): SetComparison \| undefined |
| CompletedSet | interface | export interface CompletedSet |
| computeWorkoutStats | const | export |
| computeWorkoutStats | function | export function computeWorkoutStats( reps: readonly Rep[], startTime: number \| null, weightLbs: number \| null ): WorkoutStats |
| createCompletedSet | function | export function createCompletedSet( data: AnalyticsSet, metadata: |
| createCompletedSet | const | export |
| createEmptyPlan | function | export function createEmptyPlan(exerciseId: string): ExercisePlan |
| createEmptyWorkoutStats | const | export |
| createEmptyWorkoutStats | function | export function createEmptyWorkoutStats(): WorkoutStats |
| createExerciseSession | function | export function createExerciseSession(exercise: Exercise, plan: ExercisePlan): ExerciseSession |
| createRep | function | export function createRep( repNumber: number, concentric: Phase, eccentric: Phase, holdAtTop: Phase \| null, holdAtBottom: Phase \| null, metrics: RepMetrics ): Rep |
| createSample | function | export function createSample( sequence: number, timestamp: number, phase: MovementPhase, position: number, velocity: number, force: number ): WorkoutSample |
| EffortEstimate | interface | export interface EffortEstimate |
| ExercisePlan | interface | export interface ExercisePlan |
| ExerciseSession | interface | export interface ExerciseSession |
| export | type | export type |
| FatigueAnalysis | interface | export interface FatigueAnalysis |
| getAllSetComparisons | function | export function getAllSetComparisons(session: ExerciseSession): SetComparison[] |
| getCompletedVolume | function | export function getCompletedVolume(session: ExerciseSession): number |
| getCurrentPlannedSet | function | export function getCurrentPlannedSet(session: ExerciseSession): PlannedSet \| undefined |
| getCurrentSetIndex | function | export function getCurrentSetIndex(plan: ExercisePlan, completedCount: number): number |
| getPlannedSet | function | export function getPlannedSet(plan: ExercisePlan, index: number): PlannedSet \| undefined |
| getPlanVolume | function | export function getPlanVolume(plan: ExercisePlan): number |
| getRemainingRestSeconds | function | export function getRemainingRestSeconds(session: ExerciseSession): number |
| getSessionCurrentSetIndex | function | export function getSessionCurrentSetIndex(session: ExerciseSession): number |
| getTotalReps | function | export function getTotalReps(session: ExerciseSession): number |
| isDiscoveryPlan | function | export function isDiscoveryPlan(plan: ExercisePlan): boolean |
| isDiscoverySession | function | export function isDiscoverySession(session: ExerciseSession): boolean |
| isResting | function | export function isResting(session: ExerciseSession): boolean |
| isSessionComplete | function | export function isSessionComplete(session: ExerciseSession): boolean |
| MovementPhase | enum | export enum MovementPhase |
| Phase | interface | export interface Phase |
| PhaseMetrics | interface | export interface PhaseMetrics |
| PhaseNames | const | export const PhaseNames: Record<MovementPhase, string> = |
| PlannedSet | interface | export interface PlannedSet |
| PlanSource | type | export type PlanSource = 'manual' \| 'standard' \| 'discovery' |
| Rep | interface | export interface Rep |
| RepMetrics | interface | export interface RepMetrics |
| Set | interface | export interface Set |
| SetComparison | interface | export interface SetComparison |
| SetLogEntry | interface | export interface SetLogEntry |
| SetMetrics | interface | export interface SetMetrics |
| startRest | function | export function startRest(session: ExerciseSession, restSeconds: number): ExerciseSession |
| StoredRep | interface | export interface StoredRep |
| TempoTarget | interface | export interface TempoTarget |
| TrainingGoal | const | export |
| VelocityMetrics | interface | export interface VelocityMetrics |
| WorkoutSample | interface | export interface WorkoutSample |
| WorkoutStats | interface | export interface WorkoutStats |

## Dependencies

### Internal

- `./completed-set` — CompletedSet
- `./phase` — Phase
- `./plan` — ExercisePlan, PlannedSet
- `./rep` — Rep
- `./sample` — WorkoutSample
- `./types` — MovementPhase

### External

- `@/domain/exercise` — Exercise
- `@/domain/planning/types` — TrainingGoal
- `@voltras/workout-analytics` — AnalyticsSet, Rep, WorkoutSample, getRepDuration, getRepPeakForce

## Invariants

*(none yet)*
