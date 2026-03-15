# voltras/mobile

React Native/Expo app for Voltra fitness devices. Consumes `@voltras/node-sdk` and `@voltras/workout-analytics` from npm.

## Commands

```
npm test              # Vitest unit tests
npm run lint          # ESLint 9
npm run typecheck     # tsc --noEmit
npm run build         # Expo export
```

## Action Ownership

Each store owns a distinct slice of responsibility. Route actions to the correct store.

| Action | Store | Notes |
|--------|-------|-------|
| `processSample` | recording-store | Processes WorkoutSample through analytics pipeline |
| `startRecording` | recording-store | Begins intra-set rep detection |
| `stopRecording` | recording-store | Finalises set, returns CompletedSet |
| `reset` | recording-store | Clears all intra-set state |
| `prepareFirstSet` | exercise-session-store | Async preparation before first set begins |
| `startFirstSet` | exercise-session-store | Transitions session into recording state |
| `onSetCompleted` | exercise-session-store | Post-set processing, rest timer, termination check |
| `dispose` | exercise-session-store | Tears down session, stops device recording |
| `setMode` | voltra-store | Sets training mode on device via SDK |
| `setWeight` | voltra-store | Sends weight to device via SDK |
| `connect` | voltra-store | Connects to a specific VoltraClient |
| `disconnect` | voltra-store | Disconnects from the device |
| `scan` | connection-store | BLE scan for nearby Voltra devices |
| `connectDevice` | connection-store | Connects and registers device in fleet |
| `disconnectDevice` | connection-store | Disconnects and removes device from fleet |
| `restoreLastConnection` | connection-store | Auto-reconnects to last known device |
| `enqueueCue` | coaching-store | Buffers a coaching cue during recording |
| `flushQueue` | coaching-store | Moves queued cues to display (called on rest) |
| `reactToCue` | coaching-store | Records athlete thumbs-up/down reaction |
| `dismissActiveCue` | coaching-store | Clears the currently displayed cue |
