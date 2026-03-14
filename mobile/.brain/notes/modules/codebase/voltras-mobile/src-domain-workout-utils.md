---
title: "Architecture: src/domain/workout/utils"
type: architecture
tier: slow
module: codebase
module-path: src/domain/workout/utils
language: typescript
exports-hash: "1778209832a91f14a26e074cfcc8041c1133ab1c31a56fbe6f358ea7bff7bff3"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.409Z
modified: 2026-03-14T15:53:10.409Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| getEffortBar | function | export function getEffortBar(rpe: number, width: number = 10): string |
| getEffortLabel | function | export function getEffortLabel(rpe: number): string |
| getLiveEffortMessage | function | export function getLiveEffortMessage(rpe: number, repCount: number): string |
| getRIRDescription | function | export function getRIRDescription(rir: number): string |
| getRPEColor | function | export function getRPEColor(rpe: number): string |

## Dependencies

### Internal

*(none)*

### External

- `@titan-design/react-ui` — getSemanticColors

## Invariants

*(none yet)*
