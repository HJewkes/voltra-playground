---
title: "Architecture: src/domain/history/services"
type: architecture
tier: slow
module: codebase
module-path: src/domain/history/services
language: typescript
exports-hash: "11aad453dde017d8ea4bc5cccd502bc64c5cea099dfeaec3b47e651ebeafd29c"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.412Z
modified: 2026-03-14T15:53:10.412Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| AggregateStats | interface | export interface AggregateStats |
| computeAggregateStats | function | export function computeAggregateStats(sets: CompletedSet[]): AggregateStats |
| computePersonalRecords | function | export function computePersonalRecords(sets: CompletedSet[]): PersonalRecord[] |
| computeVelocityBaseline | function | export function computeVelocityBaseline( exerciseId: string, sets: CompletedSet[] ): VelocityBaseline |
| interpolateVelocity | function | export function interpolateVelocity(baseline: VelocityBaseline, weight: number): number \| null |

## Dependencies

### Internal

- `../models` — PersonalRecord, VelocityBaseline, VelocityDataPoint

### External

- `@/domain/workout` — CompletedSet
- `@voltras/workout-analytics` — getSetFirstRepVelocity, getSetPeakVelocity

## Invariants

*(none yet)*
