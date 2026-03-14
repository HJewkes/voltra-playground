---
title: "Architecture: src/data"
type: architecture
tier: slow
module: codebase
module-path: src/data
language: typescript
exports-hash: "994810a7932d6276283b21b846c32b907d14a9aee446eda281abfb2c9508cf28"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.412Z
modified: 2026-03-14T15:53:10.412Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| getAdapter | function | export function getAdapter(): StorageAdapter |
| getExerciseRepository | function | export function getExerciseRepository(): ExerciseRepository |
| getRecordingRepository | function | export function getRecordingRepository(): RecordingRepository |
| getSessionRepository | function | export function getSessionRepository(): ExerciseSessionRepository |
| isDebugTelemetryEnabled | function | export function isDebugTelemetryEnabled(): boolean |
| isDebugTelemetryEnabled | const | export |
| setDebugTelemetryEnabled | function | export function setDebugTelemetryEnabled(enabled: boolean): void |
| setDebugTelemetryEnabled | const | export |
| setTestAdapter | function | export function setTestAdapter(adapter: StorageAdapter \| null): void |

## Dependencies

### Internal

- `./adapters/async-storage-adapter` — AsyncStorageAdapter
- `./adapters/types` — StorageAdapter
- `./exercises/exercise-repository` — ExerciseRepository, createExerciseRepository

### External

*(none)*

## Invariants

*(none yet)*
