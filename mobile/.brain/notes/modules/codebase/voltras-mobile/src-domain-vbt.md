---
title: "Architecture: src/domain/vbt"
type: architecture
tier: slow
module: codebase
module-path: src/domain/vbt
language: typescript
exports-hash: "c451f87d98fc70ccfbd9a5e84ea3f510ff14d8f7b0dbefef8d3739d8b9111d41"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.410Z
modified: 2026-03-14T15:53:10.410Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| addDataPointToProfile | function | export function addDataPointToProfile( profile: LoadVelocityProfile, newPoint: LoadVelocityDataPoint ): LoadVelocityProfile |
| buildLoadVelocityProfile | function | export function buildLoadVelocityProfile( exerciseId: string, dataPoints: LoadVelocityDataPoint[] ): LoadVelocityProfile |
| categorizeVelocity | const | export const categorizeVelocity = libCategorizeVelocity |
| DISCOVERY_START_PERCENTAGES | const | export const DISCOVERY_START_PERCENTAGES = [30, 50, 65, 75, 85] |
| estimate1RMFromSet | function | export function estimate1RMFromSet(weight: number, reps: number, velocity?: number): number |
| estimatePercent1RMFromVelocity | const | export const estimatePercent1RMFromVelocity = libEstimatePercent1RM |
| estimateWeightForPercent1RM | function | export function estimateWeightForPercent1RM(profile: LoadVelocityProfile, percent: number): number |
| estimateWeightForVelocity | function | export function estimateWeightForVelocity( profile: LoadVelocityProfile, targetVelocity: number ): number |
| generateWarmupSets | function | export function generateWarmupSets(estimated1RM: number, workingWeight: number): WarmupSet[] |
| generateWorkingWeightRecommendation | function | export function generateWorkingWeightRecommendation( profile: LoadVelocityProfile, goal: TrainingGoal ): WorkingWeightRecommendation |
| getTargetVelocityForGoal | function | export function getTargetVelocityForGoal(goal: TrainingGoal): |
| LoadVelocityDataPoint | interface | export interface LoadVelocityDataPoint |
| LoadVelocityProfile | interface | export interface LoadVelocityProfile |
| MINIMUM_VELOCITY_THRESHOLD | const | export const MINIMUM_VELOCITY_THRESHOLD = DEFAULT_MVT |
| predictVelocityAtWeight | function | export function predictVelocityAtWeight(profile: LoadVelocityProfile, weight: number): number |
| PROFILE_CONFIDENCE_REQUIREMENTS | const | export const PROFILE_CONFIDENCE_REQUIREMENTS = |
| REP_RANGES | const | export const REP_RANGES: Record<TrainingGoal, [number, number]> = |
| suggestNextWeight | function | export function suggestNextWeight( currentWeight: number, currentVelocity: number, goal: TrainingGoal, increment: number = 5 ): |
| TRAINING_ZONES | const | export const TRAINING_ZONES: Record<TrainingGoal, |
| VELOCITY_AT_PERCENT_1RM | const | export const VELOCITY_AT_PERCENT_1RM = LIB_VELOCITY_TABLE |
| VELOCITY_LOSS_TARGETS | const | export const VELOCITY_LOSS_TARGETS = |
| VELOCITY_RIR_MAP | const | export const VELOCITY_RIR_MAP: [number, number, number][] = [ |
| VelocityTrend | type | export type VelocityTrend = VelocityZone |
| WarmupSet | interface | export interface WarmupSet |
| WorkingWeightRecommendation | interface | export interface WorkingWeightRecommendation |

## Dependencies

### Internal

*(none)*

### External

- `@/domain/planning/types` — TrainingGoal

## Invariants

*(none yet)*
