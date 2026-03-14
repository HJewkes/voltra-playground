---
title: "Architecture: src/data/preferences"
type: architecture
tier: slow
module: codebase
module-path: src/data/preferences
language: typescript
exports-hash: "1264d65f2165296859f3e18024bac6f30a10044c3ba7da50131dd0c5c9f5841a"
tags: [architecture, typescript, voltras-mobile]
created: 2026-03-14T15:53:10.413Z
modified: 2026-03-14T15:53:10.413Z
---

## Purpose

No module-level documentation found.

## Public API

| Export | Kind | Signature |
|--------|------|-----------|
| clearLastDevice | function | export async function clearLastDevice(): Promise<void> |
| Device | interface | export interface Device |
| export | type | export type |
| getLastDevice | function | export async function getLastDevice(): Promise<Device \| null> |
| isAutoReconnectEnabled | function | export async function isAutoReconnectEnabled(): Promise<boolean> |
| saveLastDevice | function | export async function saveLastDevice(device: Device): Promise<void> |
| setAutoReconnectEnabled | function | export async function setAutoReconnectEnabled(enabled: boolean): Promise<void> |

## Dependencies

### Internal

- `./preferences-schema` — Device

### External

- `@/data/adapters` — STORAGE_KEYS, asyncStorageAdapter

## Invariants

*(none yet)*
