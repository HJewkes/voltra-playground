---
title: "Architecture: src/__fixtures__/generators"
type: architecture
tier: slow
module: codebase
module-path: src/__fixtures__/generators
language: typescript
exports-hash: "01e2f02a0911ce58544df163c088afdf0ffd8f66b84ae9a99900b703ac5d5a37"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.416Z
modified: 2026-03-14T15:53:10.416Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| BEHAVIOR_PRESETS | const | export const BEHAVIOR_PRESETS: Record<RepBehavior, RepTargets> = |
| createStubConcentricPhase | function | export function createStubConcentricPhase(options: Omit<StubPhaseOptions, 'startPosition' \| 'endPosition'> = |
| createStubEccentricPhase | function | export function createStubEccentricPhase(options: Omit<StubPhaseOptions, 'startPosition' \| 'endPosition'> = |
| createStubHoldPhase | function | export function createStubHoldPhase(options: StubPhaseOptions = |
| createStubPhase | function | export function createStubPhase(options: StubPhaseOptions = |
| createStubRep | function | export function createStubRep(options: StubRepOptions = |
| createStubReps | function | export function createStubReps( count: number, options: |
| createTestExercise | function | export function createTestExercise(idOrOverrides?: string \| Partial<Exercise>): Exercise |
| deepMerge | function | export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T |
| derivePhasesFromTotal | function | export function derivePhasesFromTotal(total: PhaseTargets): |
| deriveVelocities | function | export function deriveVelocities(phase: PhaseTargets): Required<PhaseTargets> |
| discoverySetResultBuilder | function | export function discoverySetResultBuilder(): DiscoverySetResultBuilder |
| DiscoverySetResultTargets | interface | export interface DiscoverySetResultTargets |
| export | type | export type |
| generateBellCurve | function | export function generateBellCurve( numSamples: number, targetMean: number, targetPeak: number ): number[] |
| generateDecliningMetrics | function | export function generateDecliningMetrics(workingWeight: number = 100): HistoricalMetrics |
| generateDiscoverySequence | function | export function generateDiscoverySequence( startWeight: number = 40, endWeight: number = 100, steps: number = 4 ): DiscoverySetResult[] |
| generateDiscoverySetResult | function | export function generateDiscoverySetResult( options: GenerateDiscoverySetResultOptions = |
| GenerateDiscoverySetResultOptions | interface | export interface GenerateDiscoverySetResultOptions |
| GeneratedPhase | interface | export interface GeneratedPhase |
| GeneratedRep | interface | export interface GeneratedRep |
| generateExperiencedMetrics | function | export function generateExperiencedMetrics( workingWeight: number = 100, estimated1RM: number = 150 ): HistoricalMetrics |
| generateExplosiveRep | function | export function generateExplosiveRep(options: RepBehaviorOptions = |
| generateFailedDiscoverySequence | function | export function generateFailedDiscoverySequence(maxWeight: number = 110): DiscoverySetResult[] |
| generateFailedRep | function | export function generateFailedRep(options: RepBehaviorOptions = |
| generateFatiguedSessionMetrics | function | export function generateFatiguedSessionMetrics(): SessionMetrics |
| generateFatiguingRep | function | export function generateFatiguingRep(options: RepBehaviorOptions = |
| generateFreshSessionMetrics | function | export function generateFreshSessionMetrics(): SessionMetrics |
| generateGrindingRep | function | export function generateGrindingRep(options: RepBehaviorOptions = |
| generateHighConfidenceProfile | function | export function generateHighConfidenceProfile(estimated1RM: number = 150): LoadVelocityProfile |
| generateHistoricalMetrics | function | export function generateHistoricalMetrics( options: GenerateHistoricalMetricsOptions = |
| GenerateHistoricalMetricsOptions | interface | export interface GenerateHistoricalMetricsOptions |
| generateHoldSamples | function | export function generateHoldSamples( duration: number, position: number, config: PhysicsConfig ): GeneratedPhase |
| generateImprovingMetrics | function | export function generateImprovingMetrics(workingWeight: number = 100): HistoricalMetrics |
| generateJunkVolumeSessionMetrics | function | export function generateJunkVolumeSessionMetrics(): SessionMetrics |
| generateLoadVelocityProfile | function | export function generateLoadVelocityProfile( options: GenerateLoadVelocityProfileOptions = |
| GenerateLoadVelocityProfileOptions | interface | export interface GenerateLoadVelocityProfileOptions |
| generateLowConfidenceProfile | function | export function generateLowConfidenceProfile(estimated1RM: number = 150): LoadVelocityProfile |
| generateNewExerciseMetrics | function | export function generateNewExerciseMetrics(): HistoricalMetrics |
| generateNormalRep | function | export function generateNormalRep(options: RepBehaviorOptions = |
| generatePartialRep | function | export function generatePartialRep(options: RepBehaviorOptions = |
| generatePhaseSamples | function | export function generatePhaseSamples( phaseType: MovementPhase, targets: Required<PhaseTargets>, config: PhysicsConfig ): GeneratedPhase |
| generatePlanningContext | function | export function generatePlanningContext( options: GeneratePlanningContextOptions = |
| GeneratePlanningContextOptions | interface | export interface GeneratePlanningContextOptions |
| generatePlateauCurve | function | export function generatePlateauCurve( numSamples: number, targetMean: number, targetPeak: number ): number[] |
| generateRecording | const | export |
| generateRecording | function | export function generateRecording(options: GenerateRecordingOptions = |
| GenerateRecordingOptions | interface | export interface GenerateRecordingOptions |
| generateRepFromTargets | function | export function generateRepFromTargets( targets: RepTargets, config: Partial<PhysicsConfig> = |
| generateRepSamples | function | export function generateRepSamples( behavior: RepBehavior, options: RepBehaviorOptions = |
| GenerateSampleOptions | interface | export interface GenerateSampleOptions |
| generateSampleStream | function | export function generateSampleStream(options: GenerateStreamOptions): WorkoutSample[] |
| generateSessionFromComposition | function | export function generateSessionFromComposition( composition: SessionComposition, options: GenerateSessionOptions ): SessionFromCompositionResult |
| generateSessionMetrics | function | export function generateSessionMetrics( options: GenerateSessionMetricsOptions = |
| GenerateSessionMetricsOptions | interface | export interface GenerateSessionMetricsOptions |
| GenerateSessionOptions | interface | export interface GenerateSessionOptions |
| generateSetFromBehaviors | function | export function generateSetFromBehaviors( behaviors: SetComposition, options: GenerateSetOptions = |
| GenerateSetOptions | interface | export interface GenerateSetOptions |
| generateSpikyCurve | function | export function generateSpikyCurve( numSamples: number, targetMean: number, targetPeak: number ): number[] |
| generateStoredSession | function | export function generateStoredSession(options: GenerateSessionOptions = |
| generateStoredSet | function | export function generateStoredSet(options: GenerateSetOptions = |
| GenerateStreamOptions | interface | export interface GenerateStreamOptions |
| generateVelocityCurve | function | export function generateVelocityCurve( duration: number, targetMean: number, targetPeak: number, sampleRate: number ): number[] |
| generateWorkoutSample | function | export function generateWorkoutSample(options: GenerateSampleOptions = |
| historicalMetricsBuilder | function | export function historicalMetricsBuilder(): HistoricalMetricsBuilder |
| HistoricalMetricsTargets | interface | export interface HistoricalMetricsTargets |
| LoadVelocityDataPoint | interface | export interface LoadVelocityDataPoint |
| LoadVelocityProfile | interface | export interface LoadVelocityProfile |
| mockAnalyticsSet | function | export function mockAnalyticsSet(options: |
| mockCompletedSet | function | export function mockCompletedSet(overrides: |
| mockPhase | function | export function mockPhase(overrides: |
| mockRep | function | export function mockRep( repNumber: number, concentricVelocity: number = 0.5, eccentricVelocity: number = concentricVelocity * 0.5, ): Rep |
| PhaseTargets | interface | export interface PhaseTargets |
| PhysicsConfig | interface | export interface PhysicsConfig |
| planBuilder | function | export function planBuilder(): PlanBuilder |
| PlannedSetTargets | interface | export interface PlannedSetTargets |
| planningContextBuilder | function | export function planningContextBuilder(): PlanningContextBuilder |
| PlanningContextTargets | interface | export interface PlanningContextTargets |
| PlanTargets | interface | export interface PlanTargets |
| REP_BEHAVIOR_PHYSICS | const | export const REP_BEHAVIOR_PHYSICS = |
| RepBehavior | type | export type RepBehavior = 'explosive' \| 'normal' \| 'fatiguing' \| 'grinding' \| 'failed' \| 'partial' |
| RepBehavior | enum | export enum RepBehavior |
| RepBehavior | const | export |
| RepBehaviorOptions | interface | export interface RepBehaviorOptions |
| repBuilder | function | export function repBuilder(): RepBuilder |
| RepSamplesResult | interface | export interface RepSamplesResult |
| RepTargets | interface | export interface RepTargets |
| resetSequence | function | export function resetSequence(): void |
| ResolvedRepTargets | interface | export interface ResolvedRepTargets |
| resolveRepTargets | function | export function resolveRepTargets(targets: RepTargets): ResolvedRepTargets |
| SESSION_PRESETS | const | export const SESSION_PRESETS = |
| sessionBuilder | function | export function sessionBuilder(): SessionBuilder |
| SessionComposition | type | export type SessionComposition = SessionSetSpec[] |
| SessionFromCompositionResult | interface | export interface SessionFromCompositionResult |
| sessionMetricsBuilder | function | export function sessionMetricsBuilder(): SessionMetricsBuilder |
| SessionMetricsTargets | interface | export interface SessionMetricsTargets |
| SessionPreset | type | export type SessionPreset = keyof typeof SESSION_PRESETS |
| sessionPresets | const | export const sessionPresets = |
| sessions | const | export const sessions = |
| SessionSetSpec | interface | export interface SessionSetSpec |
| SessionTargets | interface | export interface SessionTargets |
| SET_PRESETS | const | export const SET_PRESETS = |
| setBuilder | function | export function setBuilder(): SetBuilder |
| SetComposition | type | export type SetComposition = RepBehavior[] |
| SetFromBehaviorsResult | interface | export interface SetFromBehaviorsResult |
| SetPreset | type | export type SetPreset = keyof typeof SET_PRESETS |
| setPresets | const | export const setPresets = |
| sets | const | export const sets = |
| SetTargets | interface | export interface SetTargets |
| StubPhaseOptions | interface | export interface StubPhaseOptions |
| StubRepOptions | interface | export interface StubRepOptions |
| testExercises | const | export const testExercises = |
| TrainingGoal | const | export |
| TrainingLevel | const | export |
| type GenerateRecordingOptions | const | export |

## Dependencies

### Internal

- `./physics-engine` — PhysicsConfig, deepMerge
- `./plan-builder` — PlanTargets, planBuilder
- `./rep-behaviors` — RepBehavior, RepBehaviorOptions, generateRepSamples
- `./sample-generator` — generateSampleStream
- `./set-builder` — RepBehavior, SET_PRESETS, SetPreset, SetTargets, setBuilder
- `./set-compositions` — SetComposition, generateSetFromBehaviors, setPresets

### External

- `@/data/recordings` — SampleRecording
- `@/domain/exercise` — Exercise, MuscleGroup, createExercise
- `@/domain/planning` — TrainingGoal
- `@/domain/planning/types` — TrainingGoal
- `@/domain/workout` — CompletedSet, PlannedSet, createCompletedSet
- `@/domain/workout/models/completed-set` — CompletedSet, createCompletedSet
- `@/domain/workout/models/plan` — ExercisePlan, PlanSource, PlannedSet
- `@/domain/workout/models/session` — ExerciseSession
- `@voltras/workout-analytics` — MovementPhase, Phase, Rep, WorkoutSample
- `uuid` — uuid

## Invariants

*(none yet)*
