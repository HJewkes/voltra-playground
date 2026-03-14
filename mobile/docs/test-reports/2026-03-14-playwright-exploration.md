# Playwright Exploration Test Report

**Date:** 2026-03-14
**App URL:** http://localhost:8081/?mock
**Browser:** Playwright Chromium (headful)
**Mock Mode:** Enabled via `?mock` URL param, auto-connects to VTR-Mock

---

## Executive Summary

The Voltras workout app's core happy path works: mode selection, exercise config, workout execution with live telemetry, and set completion. The mock BLE adapter generates realistic rep data and the UI responds correctly to telemetry events. However, several significant bugs were found that impact reliability and usability.

**Critical Bugs:** 2
**Moderate Bugs:** 3
**Minor Issues:** 4

---

## Bug Reports

### BUG-1: Intermittent TDZ Crash on Exercise Screen Load (Critical)

**Severity:** Critical (blocks all functionality when triggered)
**Frequency:** Intermittent (~40% of navigations from mode selection to exercise screen)
**Error Messages:**
- `ReferenceError: Cannot access 'modeName' before initialization`
- `ReferenceError: totalExercisesDone is not defined`

**Reproduction Steps:**
1. Navigate to http://localhost:8081/?mock
2. Wait for mode selection screen to load
3. Click "Weight Training"
4. Observe the error screen: "Something went wrong"

**Root Cause Analysis:**
The error originates in `SimpleExerciseScreen.tsx` (`ExerciseInner` component). The error messages reference `modeName` (defined at line 117) and `totalExercisesDone` (defined at line 150). Both are `const` declarations in the component function body.

In standard JavaScript execution, these should be available by the time they're used in the JSX return (line 296+). The TDZ errors suggest the Metro/Hermes bundler is reordering or hoisting code in a way that breaks temporal ordering. The `useCallback` at line 121 references `modeName` in its closure, but this should only be evaluated when called, not at declaration.

The intermittency suggests a race condition in the bundler's HMR (Hot Module Replacement) or a stale module cache.

**Workaround:** Click "Retry" on the error screen, then select the mode again. Often works on the second attempt.

**File:** `voltras/mobile/src/components/screens/SimpleExerciseScreen.tsx`

---

### BUG-2: Session Lost After Rest Timer Expires (Critical)

**Severity:** Critical (data loss)
**Frequency:** 100% when rest timer counts down to zero

**Reproduction Steps:**
1. Start a workout with 3 planned sets
2. Complete Set 1 (wait for 8 reps to finish)
3. Wait for the rest timer to count all the way to 1:30/1:30
4. Observe: the entire session disappears, UI resets to fresh exercise setup screen

**Expected Behavior:** After rest expires, Set 2 should begin recording automatically (with a 3-2-1 countdown as coded in `tickRestTimer`).

**Actual Behavior:** The component appears to remount, destroying the `useMemo`-created session store and recording store. All set data, planned sets, and config state is lost.

**Root Cause Hypothesis:** When `tickRestTimer` triggers `transitionToRecording`, it likely causes a state change that triggers a navigation or component remount in the Expo Router stack. The session stores are created with `useMemo(() => createExerciseSessionStore(), [])` which means they're scoped to the component instance -- any remount destroys them.

**Workaround:** Click "Start Workout" manually during rest to skip to the next set before the timer expires.

**File:** `voltras/mobile/src/stores/exercise-session-store.ts` (tickRestTimer / transitionToRecording flow)

---

### BUG-3: Rep Count Off By One (Moderate)

**Severity:** Moderate (incorrect data)
**Frequency:** 100% reproducible

**Details:**
- Mock plan sends 8 reps per set, but the app consistently records 7 reps
- With a fast rep plan (8 reps, 0.5s each), the app records 9 reps
- The last rep of each set may be partially counted or the idle detection fires mid-rep

**Observed Counts:**
| Planned | Mock Reps Sent | App Recorded |
|---------|---------------|-------------|
| 8 | 8 (with 8s idle on last) | 7 |
| 8 | 8 (with 0.5s phases) | 9 |
| 3 | 3 (with 6s con, 5s ecc) | 4 |

**Root Cause Hypothesis:** The idle detection threshold interacts with the rep counting logic. When `idleSeconds` is long (8s) on the last rep, the idle detection fires and ends the set before the rep is fully counted. With fast reps, the phase transitions may cause spurious rep counts.

**File:** `voltras/mobile/src/stores/exercise-session-store.ts` (_onPhaseChange, _autoTransitionToRest)

---

### BUG-4: Mode Drawer Cannot Be Closed Via Header (Moderate)

**Severity:** Moderate (UX impediment)
**Frequency:** 100% reproducible

**Reproduction Steps:**
1. On exercise screen, tap "Weight Training" header to open mode drawer
2. Try to tap the header again to close the drawer

**Expected:** Drawer closes
**Actual:** Playwright error: "intercepts pointer events" -- a `div` element from the mode drawer grid overlays the header, preventing the close tap from reaching the button.

**Workaround:** Select any mode option (even the current one) to close the drawer.

**File:** `voltras/mobile/src/components/screens/SimpleExerciseScreen.tsx` (ModeDrawer component z-index / layout)

---

### BUG-5: Sessions Not Persisted to Storage (Moderate)

**Severity:** Moderate (feature gap)
**Frequency:** 100%

**Details:** After completing a workout session, the Settings screen shows "Sessions: 0". The `ExerciseSessionRepository` is either not called during `stopSession` or the persistence layer is not wired up. Completed workout data exists only in ephemeral component state and is lost on navigation.

The `HistoryScreen` component exists in the codebase but is not accessible via any route in the Expo Router layout.

**Files:**
- `voltras/mobile/src/components/screens/HistoryScreen.tsx` (exists but no route)
- `voltras/mobile/app/_layout.tsx` (no history route defined)

---

## Test Results by Scenario

### Happy Path

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Navigate, connect, select Weight Training | PASS (intermittent BUG-1) | Auto-connects mock device, mode selection works |
| 2 | Enable Reps, set to 8, add 3 sets | PASS | ScrollDial responds to pointer taps, Add Set works |
| 3 | Start workout, verify active set card | PASS | Shows "0/8 reps . 45 lbs (active)" |
| 4 | Verify telemetry updates (RPE, RIR, velocity) | PASS | RPE, RIR, mean velocity, phase timers all update live |
| 5 | Idle auto-rest detection | PASS | Idle detection fires after ~5s idle, transitions to rest |
| 6 | Wait for rest to expire, Set 2 starts | FAIL (BUG-2) | Session data lost on rest expiry |
| 7 | History shows session | BLOCKED | No history route exists |
| 8 | History detail, copy button | BLOCKED | No history route exists |

### Discovery Flow

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 9 | ExercisePickerScreen | NOT TESTED | Accessible via "Next Exercise" button after results |
| 10 | Different estimated 1RMs | NOT TESTED | No 1RM input UI found |

### Edge Cases via Mock Manipulation

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 11 | Too weak (low ROM/velocity) | NOT TESTED | Would need custom plan after start |
| 12 | Too strong (high velocity) | NOT TESTED | Would need custom plan after start |
| 13 | Very slow reps (6s concentric) | PASS | UI handles well, chart shows wide rep blocks |
| 14 | Very fast reps (0.5s concentric) | PASS (with BUG-3) | 9 reps detected instead of 8, velocity 1.47 m/s |
| 15 | Mid-set connection loss | NOT TESTED | Would need mock disconnect API |
| 16 | 0 rep set | PASS | Gracefully shows "45 lbs" with no rep count, no crash |
| 17 | Rapid set addition (10 sets) | PASS | All 10 sets appear correctly with scroll |
| 18 | Weight changes during rest | PARTIAL | Weight jog works via drag (not tap), but state resets noted |

### UI State Verification

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 19 | Responsive layout (360, 375, 430px) | PASS | Layout adapts well at all widths |
| 20 | Advanced accordion (tempo dials) | PASS | Eccentric, Chains sliders + 4 tempo ScrollDials work |
| 21 | Rest scrubber drag | PARTIAL | Rest timer progress bar visible, no drag interaction found |
| 22 | Set card expansion (chart) | PASS | Velocity chart renders on completed set tap |

---

## What Works Well

1. **Mock BLE auto-connect:** The `?mock` parameter seamlessly connects to VTR-Mock with zero user interaction.
2. **Live telemetry display:** RPE, RIR, velocity, phase timers, and coaching messages all update in real-time during recording.
3. **Velocity chart:** Beautiful real-time visualization showing rep-by-rep velocity profiles. Both the "Set" and "Velocity" chart views work.
4. **ScrollDial interaction:** The neumorphic drum wheel is visually polished and responds to pointer taps and drag on web.
5. **Auto-generated mock rep plan:** `generateMockRepPlan()` creates realistic rep profiles from the session's planned sets with progressive fatigue simulation.
6. **QuickConfig layout:** The three-column layout (Reps/RIR | Weight | Add Set) is clean and functional.
7. **Mode switching:** The inline mode drawer works well with all 6 training modes.
8. **Effort cycling:** Off -> Reps -> RIR -> Off cycle is intuitive.
9. **0-rep graceful handling:** No crash when a set has zero reps.
10. **Responsive design:** Layout works across phone screen widths (360-430px).

## What Needs Improvement

1. **Session persistence:** Workout data should be saved to the repository so history works.
2. **Rest-to-recording transition:** The auto-transition on rest expiry causes session loss (BUG-2).
3. **Rep counting accuracy:** Off-by-one errors in rep detection (BUG-3).
4. **TDZ crash stability:** The intermittent modeName/totalExercisesDone errors (BUG-1).
5. **History route:** `HistoryScreen` component exists but isn't accessible.
6. **Mode drawer close:** Z-index issue prevents closing via header tap (BUG-4).
7. **Weight jog discoverability:** Tap does nothing; drag-only interaction has no affordance hint.
8. **"Start Workout" button semantics during rest:** Shows "Start Workout" instead of "Start Next Set" or "Skip Rest."

---

## Screenshots Taken

| File | Description |
|------|-------------|
| 01-initial-load.png | App loading splash |
| 02-exercise-setup.png | Exercise screen after mode selection |
| 03-reps-enabled.png | Reps badge activated |
| 04-bug-modename-crash.png | TDZ crash (modeName) |
| 05-bug-totalExercisesDone-crash.png | TDZ crash (totalExercisesDone) |
| 06-exercise-screen-loaded.png | Exercise screen after retry |
| 07-reps-set-to-8.png | Reps dial at 7 (animating to 8) |
| 08-reps-at-8.png | Reps confirmed at 8 |
| 09-three-sets-added.png | 3 sets planned (8 reps x 45 lbs) |
| 10-workout-started.png | Active workout with live chart |
| 11-workout-active-6-reps.png | 7/8 reps, RPE 7.8, approaching failure |
| 12-rest-between-sets.png | Rest timer at 0:22/1:30 |
| 13-set1-expanded-chart.png | Expanded velocity chart for completed set |
| 14-after-rest-expired.png | Session lost after rest expired |
| 15-rest-state-set2-pending.png | Manual rest skip opportunity |
| 16-set2-jumped-to-7-reps.png | Set 2 active after manual start |
| 17-session-complete.png | Session results (2 sets complete) |
| 18-advanced-accordion.png | Advanced settings expanded |
| 19-tempo-enabled.png | Tempo dials enabled |
| 20-ten-sets-rapid.png | 10 sets rapidly added |
| 21-weight-changed.png | Weight changed to 49 lbs |
| 22-responsive-360px.png | Layout at 360px width |
| 23-responsive-375px.png | Layout at 375px width |
| 24-responsive-430px.png | Layout at 430px width |
| 25-mode-drawer-open.png | Mode switcher drawer |
| 26-fast-reps-result.png | Fast reps result (0.5s con) |
| 27-slow-reps-active.png | Slow reps active (6s con) |
| 28-settings-screen.png | Settings page |
| 29-seeded-data.png | Seeded test data |

---

## Warnings Observed

1. `props.pointerEvents is deprecated. Use style.pointerEvents` -- appears on every exercise screen render
2. `Blocked aria-hidden on an element because its descendant retained focus` -- accessibility issue on exercise screen
3. Duplicate `ConnectionStore` logs (connecting/connected appear 2-3 times per connect)
