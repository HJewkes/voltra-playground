---
title: "Architecture: src/domain/planning/strategies"
type: architecture
tier: slow
module: codebase
module-path: src/domain/planning/strategies
language: typescript
exports-hash: "7d7479f803031ce809551482fa3d523f7bdc4d9b73d3574adefb02ac1ccfceee"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.411Z
modified: 2026-03-14T15:53:10.411Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| autoregulatedProgression | function | export function autoregulatedProgression(context: ProgressionContext): ProgressionDecision |
| calculateRestAdjustment | function | export function calculateRestAdjustment( metrics: SessionMetrics, lastSetVelocityLoss: number, config: StandardStrategyConfig ): RestAdjustmentResult |
| calculateWeightAdjustment | function | export function calculateWeightAdjustment( metrics: SessionMetrics, lastSetVelocityLoss: number, config: StandardStrategyConfig ): WeightAdjustmentResult |
| canAddSet | function | export function canAddSet( metrics: SessionMetrics, lastSet: SetPerformance, setsCompleted: number, config: StandardStrategyConfig ): ExtraSetEligibility |
| checkDeloadNeeded | function | export function checkDeloadNeeded( level: TrainingLevel, weeksSinceDeload: number, recentSessions: Array< |
| checkJunkVolume | function | export function checkJunkVolume(fatigue: FatigueEstimate): boolean |
| createAdjustment | function | export function createAdjustment( type: PlanAdjustment['type'], reason: string, confidence: PlanAdjustment['confidence'], from?: number \| [number, number], to?: number \| [number, number] ): PlanAdjustment |
| createDeloadPlan | function | export function createDeloadPlan(trigger: DeloadTrigger): DeloadWeek |
| createDiscoveryState | function | export function createDiscoveryState( exerciseId: string, exerciseType: 'compound' \| 'isolation', goal: TrainingGoal ): DiscoveryState |
| DEFAULT_DELOAD | const | export const DEFAULT_DELOAD: DeloadWeek = |
| DeloadTrigger | interface | export interface DeloadTrigger |
| DeloadWeek | interface | export interface DeloadWeek |
| DiscoveryRecommendation | interface | export interface DiscoveryRecommendation |
| DiscoveryState | interface | export interface DiscoveryState |
| doubleProgression | function | export function doubleProgression(context: ProgressionContext): ProgressionDecision |
| ExerciseTrend | interface | export interface ExerciseTrend |
| EXPECTED_REP_DROP | const | export const EXPECTED_REP_DROP: Record<number, number> = |
| ExtraSetEligibility | interface | export interface ExtraSetEligibility |
| getExerciseTrend | function | export function getExerciseTrend( sessions: Array< |
| getExpectedPerformance | function | export function getExpectedPerformance( setNumber: number, firstSetReps: number, restSeconds: number ): |
| getFirstDiscoveryStep | function | export function getFirstDiscoveryStep( state: DiscoveryState, userEstimate?: UserEstimate ): |
| getNextDiscoveryStep | function | export function getNextDiscoveryStep( state: DiscoveryState, result: DiscoverySetResult ): |
| getProgressionRecommendation | function | export function getProgressionRecommendation(context: ProgressionContext): ProgressionDecision |
| getQuickRecommendation | function | export function getQuickRecommendation( exerciseId: string, goal: TrainingGoal, lightSet: DiscoverySetResult, moderateSet: DiscoverySetResult ): DiscoveryRecommendation |
| getVelocityExpectation | function | export function getVelocityExpectation(trend: VelocityTrend): string |
| isSetWithinExpectations | function | export function isSetWithinExpectations( actualReps: number, expectedReps: number, actualVelocity: number, expectedVelocity: number, tolerance: number = 0.15 ): |
| linearProgression | function | export function linearProgression(context: ProgressionContext): ProgressionDecision |
| ProgressionContext | interface | export interface ProgressionContext |
| ProgressionDecision | interface | export interface ProgressionDecision |
| RestAdjustmentResult | interface | export interface RestAdjustmentResult |
| SetPerformance | interface | export interface SetPerformance |
| shouldStop | function | export function shouldStop( metrics: SessionMetrics, setsCompleted: number, plannedSets: number, config: StandardStrategyConfig ): StopDecision |
| StandardStrategyConfig | interface | export interface StandardStrategyConfig |
| StopDecision | interface | export interface StopDecision |
| UserEstimate | interface | export interface UserEstimate |
| WeightAdjustmentResult | interface | export interface WeightAdjustmentResult |

## Dependencies

### Internal

- `../types` — DiscoveryPhase, DiscoverySetResult, DiscoveryStep, HistoricalMetrics, PROGRESSION_INCREMENTS, PlanAdjustment, ProgressionScheme, TrainingGoal, TrainingLevel, VELOCITY_LOSS_TARGETS

### External

- `@/domain/workout/metrics/types` — FatigueEstimate, SessionMetrics

## Invariants

*(none yet)*
