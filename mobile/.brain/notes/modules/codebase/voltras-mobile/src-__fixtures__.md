---
title: "Architecture: src/__fixtures__"
type: architecture
tier: slow
module: codebase
module-path: src/__fixtures__
language: typescript
exports-hash: "335ade017f0871844c7576c99ee900ef62b2d7635b88489ef78b16055604ea4f"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.415Z
modified: 2026-03-14T15:53:10.415Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| clearSeedData | const | export |
| clearSeedData | function | export async function clearSeedData(): Promise<void> |
| seedDatabase | const | export |
| seedDatabase | function | export async function seedDatabase(options: SeedOptions = |
| SeedOptions | interface | export interface SeedOptions |
| SeedResult | interface | export interface SeedResult |
| type SeedOptions | const | export |
| type SeedResult | const | export |

## Dependencies

### Internal

- `./generators` — generateRecording, generateStoredSession

### External

- `@/data/provider` — getRecordingRepository, getSessionRepository

## Invariants

*(none yet)*
