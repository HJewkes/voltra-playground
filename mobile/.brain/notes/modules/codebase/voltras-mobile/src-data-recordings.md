---
title: "Architecture: src/data/recordings"
type: architecture
tier: slow
module: codebase
module-path: src/data/recordings
language: typescript
exports-hash: "c4f27945f91d80f71593a94769ac487ffa7e9f125c8a375a99241089035aadcb"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.412Z
modified: 2026-03-14T15:53:10.412Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| createRecordingRepository | const | export |
| createRecordingRepository | function | export function createRecordingRepository(adapter: StorageAdapter): RecordingRepository |
| export | type | export type |
| RecordingMetadata | interface | export interface RecordingMetadata |
| RecordingRepository | interface | export interface RecordingRepository |
| RecordingRepositoryImpl | const | export |
| RecordingRepositoryImpl | class | export class RecordingRepositoryImpl implements RecordingRepository |
| SampleRecording | interface | export interface SampleRecording |

## Dependencies

### Internal

- `./recording-schema` — SampleRecording

### External

- `@/data/adapters/types` — STORAGE_KEYS, StorageAdapter
- `@/domain/workout` — WorkoutSample

## Invariants

*(none yet)*
