---
title: "Architecture: src/domain/workout/session"
type: architecture
tier: slow
module: codebase
module-path: src/domain/workout/session
language: typescript
exports-hash: "1e1736b27e0e0a9a965118fa69245ec050d4004f41f23933970f8fe01ef28e16"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.409Z
modified: 2026-03-14T15:53:10.409Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| checkTermination | function | export function checkTermination( session: ExerciseSession, lastSet: CompletedSet, config: TerminationConfig = DEFAULT_TERMINATION_CONFIG ): TerminationResult |
| createUserStoppedTermination | function | export function createUserStoppedTermination(): TerminationResult |
| DEFAULT_TERMINATION_CONFIG | const | export const DEFAULT_TERMINATION_CONFIG: TerminationConfig = |
| getTerminationMessage | function | export function getTerminationMessage(reason: TerminationReason): string |
| TerminationConfig | interface | export interface TerminationConfig |
| TerminationReason | type | export type TerminationReason = |
| TerminationResult | interface | export interface TerminationResult |

## Dependencies

### Internal

- `../models/completed-set` — CompletedSet
- `../models/session` — ExerciseSession

### External

- `@voltras/workout-analytics` — getSetMeanVelocity

## Invariants

*(none yet)*
