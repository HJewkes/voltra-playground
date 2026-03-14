# Plan-As-You-Go Workout UX Redesign

**Date:** 2026-03-13
**Status:** In Progress
**Branch:** `feat/telemetry-redesign`

## Problem

The current exercise screen requires upfront configuration of sets, rest time, reps, tempo — all before the workout starts. This is backwards from how most lifters actually work: they do a set, decide how they feel, adjust weight/rest, and go again. The configuration card takes up significant screen real estate and the telemetry/chart data is split across multiple cards.

## Goals

1. **Plan-as-you-go**: Remove upfront set/rest planning. Users add sets on the fly.
2. **Consolidate**: Merge telemetry, charts, and set history into one unified set list.
3. **Simplify top config**: Reduce to three elements — Reps/RIR dial, Weight jog, Add Set button.
4. **Integrated rest**: Rest time lives as a scrubber between sets, doubles as progress bar.
5. **Unified chart view**: Per-rep and per-set views with phase timing integrated into the chart.

## Design

### 1. Top Config Bar (Simplified)

**Before:** Reps | Sets | Rest | Weight | Tempo (5 sections, 8+ dials)
**After:** Reps/RIR dial (left) | Weight jog (center) | Add Set button (right)

```
┌────────────────────────────────────────┐
│  [Reps]     ┌──────┐     [ + Add Set ] │
│   ──        │  0   │      (disabled    │
│  dial       │ LBS  │      until reps   │
│             └──────┘      configured)  │
└────────────────────────────────────────┘
```

- **Reps/RIR**: Same cycling EnablePill (Reps → RIR → Off) with ScrollDial below
- **Weight**: Existing VerticalWeightJog, centered
- **Add Set**: Large + button. Disabled until Reps/RIR is configured. Tap appends a PlannedSet to the session plan with current weight and targets.
- **Sets/Rest dials**: Removed from top config. Rest time is per-set in the set list.

### 2. Advanced Accordion (Tempo + Hardware)

Tempo moves into the Advanced section. Layout: two columns, half width each.

```
┌─────────── Advanced ▼ ──────────────┐
│  ┌──────────┐   ┌─────────────────┐ │
│  │Eccentric │   │ Tempo           │ │
│  │ slider   │   │ [C][H][E][P]   │ │
│  │          │   │  2  1  3  1    │ │
│  │Chains    │   │                 │ │
│  │ slider   │   │                 │ │
│  └──────────┘   └─────────────────┘ │
└─────────────────────────────────────┘
```

### 3. Set List (Unified Workout View)

The set list becomes the primary workout view. It contains:
- **Planned sets** (from Add Set taps)
- **Active set** with live telemetry and chart
- **Completed sets** with expandable chart replay
- **Rest scrubbers** between sets

```
┌─────────────────────────────────────────┐
│ Set 3 (active)                          │
│ 5 reps · 135 lbs    RPE 7.2   RIR ~3   │
│ ┌─ Set/Rep ─┐  ┌─ Vel/Force/Pos ─┐     │
│ │           │  │                  │     │
│ │  [chart]  │  │                  │     │
│ │           │  │                  │     │
│ └───────────┘  └──────────────────┘     │
├─────────────────────────────────────────┤
│ ◀━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━▶ 1:30 │  ← rest scrubber (90s default)
├─────────────────────────────────────────┤
│ Set 2 · 5 reps · 135 lbs · 0.52 m/s  ▼ │
├─────────────────────────────────────────┤
│ ◀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ 1:30 │
├─────────────────────────────────────────┤
│ Set 1 · 5 reps · 135 lbs · 0.67 m/s  ▼ │
└─────────────────────────────────────────┘
```

### 4. Rest Scrubber

A narrow horizontal dial between sets that:
- **Before workout**: Shows editable rest time (scrub left/right in 15s increments, default 90s)
- **During rest**: Becomes a progress bar filling left→right, showing elapsed/target
- **Visual**: Thin track with thumb, time label. ~24px tall.

### 5. Toggle Switches

Two cycling toggles at the top of the chart area:

**View toggle** (cycling button):
`Set` → `Rep` → (cycles back)

- **Set view**: Full-set chart (current SetCurveChart behavior)
- **Rep view**: Per-rep chart showing individual rep detail. Phase bands become the primary visualization with fill progress and timing labels at top. Basically the TempoBar data rendered into the chart canvas.

**Signal toggle** (cycling button):
`Velocity` → `Force` → `Position` → (cycles back)

These replace the current three pill buttons with two compact cycling buttons.

### 6. Active Set Telemetry

The active set row in the set list shows:
- **Left**: Rep count + weight (e.g., "5 reps · 135 lbs")
- **Right**: RPE + RIR (e.g., "RPE 7.2 RIR ~3")
- **Below**: Chart with toggle switches
- **Phase timing**: In rep view, integrated into chart phase bands with timing labels. In set view, shown above chart as compact bar.

### 7. Effort Message

The coaching message ("Good pace", "High effort - 1-2 reps left") can show as a subtle text overlay at the bottom of the chart area, or above the chart between the toggles and the chart canvas.

## Component Plan

### New Components
1. **`AddSetButton`** — Large + button, disabled state, appends set to plan
2. **`RestScrubber`** — Horizontal dial for rest time, doubles as progress bar
3. **`CycleToggle`** — Generic cycling toggle button (used for both view and signal)
4. **`RepCurveChart`** — Per-rep chart variant with phase fill and timing labels

### Modified Components
1. **`SetTargets`** → Simplified to Reps/RIR + Weight + AddSet
2. **`AdvancedAccordion`** → Add tempo dials in second column
3. **`SetLog`** → Becomes primary workout view with rest scrubbers and active chart
4. **`SimpleExerciseScreen`** → Restructured layout, telemetry card removed
5. **`SetCurveChart`** → Replace pill buttons with cycle toggles

### Unchanged Components
- `ScrollDial` (reused as-is)
- `VerticalWeightJog` (reused as-is)
- `ForceCurveChart` / `VelocityTrendChart` (kept as alternatives)

## Data Flow Changes

### Plan Building
**Before**: `buildPlanFromTargets()` creates N sets upfront at workout start.
**After**: Each "Add Set" tap appends one `PlannedSet` to `session.plan.sets`. The session starts with 0 planned sets and grows incrementally.

### Rest Time
**Before**: Global `defaultRestSeconds` on the plan.
**After**: Per-set rest time stored on each `PlannedSet` (new field: `restSeconds?: number`). RestScrubber edits the upcoming set's rest time.

### Session Lifecycle
- `startSession()` creates a session with an empty plan
- `addPlannedSet(weight, targetReps, rirTarget, tempo)` appends to plan
- Workout auto-starts recording when the first set is added (or on explicit start)
- `onSetCompleted()` transitions to rest using that set's `restSeconds`
- User can add more sets during rest

## Implementation Order

### Phase 1: Foundation Components
1. `CycleToggle` — generic cycling button
2. `RestScrubber` — horizontal rest dial/progress bar
3. `AddSetButton` — add set to plan

### Phase 2: Layout Restructure
4. Simplify `SetTargets` to Reps/Weight/AddSet
5. Move tempo into `AdvancedAccordion`
6. Restructure `SetLog` as primary workout view with rest scrubbers

### Phase 3: Chart Integration
7. Replace chart pills with `CycleToggle`s
8. Build `RepCurveChart` for per-rep view
9. Integrate TempoBar data into rep chart phase bands

### Phase 4: Data Flow
10. Add dynamic set addition to session store
11. Per-set rest time on PlannedSet
12. Wire AddSetButton → session store

### Phase 5: Polish
13. Effort message positioning
14. Animation and transitions
15. Edge cases (no sets planned, mid-workout weight change)

## Open Questions

- Should the Add Set button auto-start the workout for the first set, or require a separate Start?
- When viewing a completed set's chart, should the toggles be independent per-set or global?
- Should rest time be editable during rest (scrubbing the progress bar)?

## Screen Size Considerations

Minimum viewport: 360px (Galaxy S23).
Content area with padding: ~312px.
The simplified top bar (dial + weight + button) fits comfortably at all sizes.
