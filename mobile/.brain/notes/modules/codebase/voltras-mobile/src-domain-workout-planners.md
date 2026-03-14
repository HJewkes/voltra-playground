---
title: "Architecture: src/domain/workout/planners"
type: architecture
tier: slow
module: codebase
module-path: src/domain/workout/planners
language: typescript
exports-hash: "233dfbb79324243678254b2f498f9f104168ba0a3329221ba2fe72ea79542192"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.409Z
modified: 2026-03-14T15:53:10.409Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| checkDiscoveryContinuation | function | export function checkDiscoveryContinuation( repsCompleted: number, meanVelocity: number, rpe?: number ): DiscoveryContinuationCheck |
| createDiscoveryPlan | function | export function createDiscoveryPlan(options: DiscoveryPlanOptions): ExercisePlan |
| createDiscoveryPlanWithWeights | function | export function createDiscoveryPlanWithWeights( exerciseId: string, weights: number[], goal: TrainingGoal, repsPerSet: number = DISCOVERY_DEFAULTS.repsPerSet ): ExercisePlan |
| createStandardPlan | function | export function createStandardPlan(options: StandardPlanOptions): ExercisePlan |
| createStandardPlanWithWarmups | function | export function createStandardPlanWithWarmups( options: StandardPlanOptions, warmupScheme: [number, number][] ): ExercisePlan |
| DiscoveryContinuationCheck | interface | export interface DiscoveryContinuationCheck |
| DiscoveryPlanOptions | interface | export interface DiscoveryPlanOptions |
| getNextDiscoveryWeight | function | export function getNextDiscoveryWeight( currentWeight: number, currentRPE: number, baseIncrement: number = 20 ): number |
| getRecommendedRepRange | function | export function getRecommendedRepRange(goal?: TrainingGoal): [number, number] |
| getRecommendedRest | function | export function getRecommendedRest(goal?: TrainingGoal): number |
| StandardPlanOptions | interface | export interface StandardPlanOptions |

## Dependencies

### Internal

- `../models/plan` — ExercisePlan, PlannedSet, TrainingGoal

### External

*(none)*

## Invariants

*(none yet)*
