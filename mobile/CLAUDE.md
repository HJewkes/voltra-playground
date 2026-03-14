# Voltras Mobile — Development Rules

## Pre-Commit Checks
```bash
npm run typecheck        # Zero errors (except pre-existing connection-store TS2352)
npm run lint             # ESLint 9 flat config
npx vitest run           # 722+ tests passing
npx react-doctor@latest . --diff main  # Score 88+, no new errors
```

## Zustand Store Architecture

**CRITICAL: Stores must be module-level singletons, NOT created inside components.**

The app has had critical data-loss bugs from stores created via `useMemo(() => createStore(), [])`. On component remount, the old store's timers/subscriptions leak and all session data is lost.

### Store Hierarchy
```
connectionStore (singleton) → manages voltraStore instances (factory, per-device)
exerciseSessionStore (singleton) → imports recordingStore, binds voltraStore
recordingStore (singleton) → no deps, receives samples via processSample
```

### Rules
- Stores with timers MUST have `dispose()` that clears all intervals/timeouts
- Async actions MUST guard against stale state after `await`
- Fields prefixed with `_` are internal — components must NOT access them
- Use fine-grained selectors: `useStore(s => s.repCount)` not `useStore(s => s)`
- DO NOT use `zustand/middleware` persist for stores with non-serializable state

## React Native Rules
- All text MUST be in `<Text>` components (raw strings crash native)
- Use `useState(() => init())` for lazy initialization
- Extract `renderItem` to `useCallback` for FlatList
- Use stable keys (item.id), never array index for reorderable lists
- Add `{ passive: true }` to wheel event listeners
- Components over 300 lines should be split

## Exercise Catalog
- 22 cable exercises with VoltrasSetup (cable position, attachment, notes for 7'0" user)
- RP-style default tempos: compounds 1/3/0/1, isolation 1/2/1/1

## VBT Cable-Specific Thresholds
Cable velocities are 20-25% lower than barbell equivalents:
- MVT: 0.12 m/s compound, 0.08 m/s isolation (not 0.17 barbell)
- Hypertrophy zone: 0.40-0.55 m/s
- Set termination: 25% velocity loss (not 20% barbell)

## Testing
- Vitest for unit tests, Playwright for E2E
- Mock adapter via `?mock` URL param, `window.__mockBLE` for rep plan control
- `window.__coach` for real-time monitoring (status, metrics, export, profiles)
- `window.__exportSessions()` for session data access
