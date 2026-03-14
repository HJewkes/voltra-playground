---
title: "Architecture: src/domain/planning"
type: architecture
tier: slow
module: codebase
module-path: src/domain/planning
language: typescript
exports-hash: "7e2de6b699d9b28114350e3341c6e94c8790b738f1059be13edaeb30c7864d93"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.411Z
modified: 2026-03-14T15:53:10.411Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| createEmptyHistoricalMetrics | function | export function createEmptyHistoricalMetrics(): HistoricalMetrics |
| createPlanningContext | function | export function createPlanningContext( exerciseId: string, goal: TrainingGoal, level: TrainingLevel, exerciseType: 'compound' \| 'isolation', options?: |
| DEFAULT_WARMUP_SCHEME | const | export const DEFAULT_WARMUP_SCHEME: WarmupScheme = |
| DiscoveryPhase | type | export type DiscoveryPhase = 'not_started' \| 'exploring' \| 'dialing_in' \| 'complete' |
| DiscoverySetResult | interface | export interface DiscoverySetResult |
| DiscoveryStep | interface | export interface DiscoveryStep |
| getDefaultProgressionScheme | function | export function getDefaultProgressionScheme( level: TrainingLevel, goal: TrainingGoal ): ProgressionScheme |
| getWarmupSets | function | export function getWarmupSets( workingWeight: number, scheme: WarmupScheme = DEFAULT_WARMUP_SCHEME ): Array< |
| HistoricalMetrics | interface | export interface HistoricalMetrics |
| PlanAdjustment | interface | export interface PlanAdjustment |
| planExercise | const | export |
| planExercise | function | export function planExercise(context: PlanningContext): PlanResult |
| PlanningContext | interface | export interface PlanningContext |
| PlanningOverrides | interface | export interface PlanningOverrides |
| PlanResult | interface | export interface PlanResult |
| PROGRESSION_INCREMENTS | const | export const PROGRESSION_INCREMENTS = |
| ProgressionScheme | enum | export enum ProgressionScheme |
| REST_DEFAULTS | const | export const REST_DEFAULTS: Record<TrainingGoal, number> = |
| RIR_DEFAULTS | const | export const RIR_DEFAULTS: Record<'compound' \| 'isolation', number> = |
| SESSION_SET_LIMITS | const | export const SESSION_SET_LIMITS = |
| TrainingGoal | enum | export enum TrainingGoal |
| TrainingLevel | enum | export enum TrainingLevel |
| VELOCITY_LOSS_TARGETS | const | export const VELOCITY_LOSS_TARGETS: Record<TrainingGoal, [number, number]> = |
| VOLUME_LANDMARKS | const | export const VOLUME_LANDMARKS: Record<TrainingLevel, |
| WarmupScheme | interface | export interface WarmupScheme |

## Dependencies

### Internal

- `./types` — PlanAdjustment, PlanResult, PlanningContext

### External

- `@/domain/workout/models/completed-set` — CompletedSet
- `@/domain/workout/models/plan` — PlannedSet

## Invariants

*(none yet)*
