---
title: "Architecture: src/domain/workout/metrics"
type: architecture
tier: slow
module: codebase
module-path: src/domain/workout/metrics
language: typescript
exports-hash: "69fb38d1efac0e61d74163201c28ea3e5dcb7689b35f56f9c9a9349503f8e570"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.410Z
modified: 2026-03-14T15:53:10.410Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| baselineToStored | function | export function baselineToStored(baseline: VelocityBaseline): StoredVelocityBaseline |
| checkVelocityRecovery | function | export function checkVelocityRecovery( currentFirstRepVelocity: number, set1FirstRepVelocity: number, targetRecoveryPercent: number = 0.9 ): |
| computeFatigueEstimate | function | export function computeFatigueEstimate( currentSet: CompletedSet, firstSet: CompletedSet ): FatigueEstimate |
| computeReadinessEstimate | function | export function computeReadinessEstimate( actualVelocity: number, baselineVelocity: number, weight: number, weightIncrement: number = 5 ): ReadinessEstimate |
| computeSessionMetrics | function | export function computeSessionMetrics( session: ExerciseSession, baseline?: VelocityBaseline, velocityProfile?: LoadVelocityProfile ): SessionMetrics |
| computeStrengthEstimate | function | export function computeStrengthEstimate( weight: number, reps: number, velocity?: number ): StrengthEstimate |
| createDefaultReadinessEstimate | function | export function createDefaultReadinessEstimate(): ReadinessEstimate |
| createEmptyFatigueEstimate | function | export function createEmptyFatigueEstimate(): FatigueEstimate |
| createEmptySessionMetrics | function | export function createEmptySessionMetrics(): SessionMetrics |
| createEmptyStrengthEstimate | function | export function createEmptyStrengthEstimate(): StrengthEstimate |
| createVelocityBaseline | function | export function createVelocityBaseline(exerciseId: string): VelocityBaseline |
| estimateReadinessFromFirstRep | function | export function estimateReadinessFromFirstRep( firstRepVelocity: number, baselineVelocity: number \| null ): ReadinessEstimate |
| EXPECTED_REP_DROP | const | export const EXPECTED_REP_DROP: Record<number, number> = |
| exportBaselines | function | export function exportBaselines( baselines: Map<string, VelocityBaseline> ): Record<string, StoredVelocityBaseline> |
| FatigueEstimate | interface | export interface FatigueEstimate |
| getBaselineVelocity | function | export function getBaselineVelocity(baseline: VelocityBaseline, weight: number): number \| null |
| getExpectedPerformance | function | export function getExpectedPerformance( setNumber: number, firstSetReps: number, restSeconds: number ): |
| hasAdequateProfileData | function | export function hasAdequateProfileData(sets: CompletedSet[]): boolean |
| importBaselines | function | export function importBaselines( stored: Record<string, StoredVelocityBaseline> ): Map<string, VelocityBaseline> |
| interpolateBaseline | function | export function interpolateBaseline(baseline: VelocityBaseline, weight: number): number \| null |
| isSetWithinExpectations | function | export function isSetWithinExpectations( actualReps: number, expectedReps: number, actualVelocity: number, expectedVelocity: number, tolerance: number = 0.15 ): |
| JUNK_VOLUME_THRESHOLD | const | export const JUNK_VOLUME_THRESHOLD = 0.5 |
| READINESS_THRESHOLDS | const | export const READINESS_THRESHOLDS = |
| ReadinessAdjustments | interface | export interface ReadinessAdjustments |
| ReadinessEstimate | interface | export interface ReadinessEstimate |
| SessionMetrics | interface | export interface SessionMetrics |
| setBaselineValue | function | export function setBaselineValue( baseline: VelocityBaseline, weight: number, velocity: number ): VelocityBaseline |
| storedToBaseline | function | export function storedToBaseline(stored: StoredVelocityBaseline): VelocityBaseline |
| StoredVelocityBaseline | interface | export interface StoredVelocityBaseline |
| StrengthEstimate | interface | export interface StrengthEstimate |
| updateBaseline | function | export function updateBaseline( baseline: VelocityBaseline, weight: number, velocity: number, wasMaxEffort: boolean = true, learningRate: number = 0.2 ): VelocityBaseline |
| VELOCITY_GRINDING_THRESHOLD | const | export const VELOCITY_GRINDING_THRESHOLD = 0.3 |
| VelocityBaseline | interface | export interface VelocityBaseline |

## Dependencies

### Internal

- `../models/completed-set` — CompletedSet
- `../models/session` — ExerciseSession
- `./baseline` — VelocityBaseline, getBaselineVelocity

### External

- `@/domain/vbt` — LoadVelocityProfile
- `@voltras/workout-analytics` — getSetMeanVelocity, getSetVelocityLossPct

## Invariants

*(none yet)*
