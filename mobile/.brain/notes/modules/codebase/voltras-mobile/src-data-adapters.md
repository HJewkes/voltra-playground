---
title: "Architecture: src/data/adapters"
type: architecture
tier: slow
module: codebase
module-path: src/data/adapters
language: typescript
exports-hash: "a3d2274e454e943172a9c615d48f5fef5657097a5b8259268cc450cca4fea639"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.413Z
modified: 2026-03-14T15:53:10.413Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| AsyncStorageAdapter | class | export class AsyncStorageAdapter implements StorageAdapter |
| asyncStorageAdapter | const | export const asyncStorageAdapter = new AsyncStorageAdapter() |
| CURRENT_STORAGE_VERSION | const | export const CURRENT_STORAGE_VERSION = 2 |
| InMemoryAdapter | class | export class InMemoryAdapter implements StorageAdapter |
| STORAGE_KEYS | const | export const STORAGE_KEYS = |
| StorageAdapter | interface | export interface StorageAdapter |

## Dependencies

### Internal

- `./types` — CURRENT_STORAGE_VERSION, STORAGE_KEYS, StorageAdapter

### External

- `@react-native-async-storage/async-storage` — AsyncStorage

## Invariants

*(none yet)*
