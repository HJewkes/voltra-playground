# Mode Controls Redesign

## Problem

The current mode configuration has two separate components with opposite UX issues:

**WeightTrainingConfig** (LoadProfileChart) — an interactive SVG chart with 3 draggable handles:
- Visually complex: orange/blue gradient lines, axis ticks, phase labels
- Not obvious what dragging a circle on a graph does
- No increment buttons — drag-only precision
- Conflates "what you're setting" with "how the rep will feel"
- The summary line at the bottom is where actual understanding happens

**BasicModeConfig** — a single slider 5-200 lbs:
- No increment buttons for precision
- Hard to land on exact values with a 195-point range slider
- Eccentric slider (-195 to +195) has cryptic values and huge range

Neither supports presets (SmartPin), mid-workout adjustment, or quick weight switching for supersets — features Beyond+ users have explicitly requested.

## Research

From Beyond+ app research and user feedback:
- Users want a **big prominent weight number** with fast increment controls
- **+1, +5, +10, +25 buttons** were added to Beyond+ after scroll-only feedback
- **SmartPin** (save 2-3 weights for quick switching) is a top feature
- **Eccentric** should be a simple percentage, not a -195 to +195 range
- **Chains** are a secondary concern — type toggle + amount
- Controls should work **during exercise**, not just during setup

## Solution

Replace both `WeightTrainingConfig` and `BasicModeConfig` with a single `ModeControls` component that adapts to the current training mode.

### Layout

```
┌───────────────────────────────────┐
│           150 lbs                 │  ← big tappable number (type exact weight)
│                                   │
│  [-10] [-5] [-1]  [+1] [+5] [+10]│  ← increment buttons
│                                   │
│  [Pin 1: 100] [Pin 2: 150]  [+]  │  ← SmartPin presets
│───────────────────────────────────│
│  ┌─ rep shape preview ─ ─ ─ ─ ┐  │  ← read-only mini chart
│  │  ╱‾‾‾╲___                  │  │     (weight training only)
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                   │
│  Eccentric    [━━━━━━○━━] +30%   │  ← compact slider
│  Chains       [Normal ▾]  20 lbs │  ← type toggle + amount
└───────────────────────────────────┘
```

### Per-Mode Visibility

| Section              | Weight Training | Resistance Band | Rowing | Damper | Isokinetic | Isometric |
|----------------------|-----------------|-----------------|--------|--------|------------|-----------|
| Weight + increments  | yes             | yes             | yes    | yes    | yes        | yes       |
| SmartPin presets     | yes             | yes             | yes    | yes    | yes        | yes       |
| Mini preview chart   | yes             | no              | no     | no     | no         | no        |
| Eccentric slider     | yes             | yes             | no     | no     | no         | no        |
| Chains selector      | yes             | no              | no     | no     | no         | no        |

### Weight Label Per Mode

| Mode            | Label        | Subtitle hint          |
|-----------------|--------------|------------------------|
| Weight Training | Weight       | Base resistance         |
| Resistance Band | Weight       | Peak band tension       |
| Rowing          | Weight       | Drag resistance         |
| Damper          | Weight       | Fluid resistance        |
| Isokinetic      | Max Force    | Force cap at set speed  |
| Isometric       | Hold Force   | Static hold resistance  |

### Component Structure

```
ModeControls (new, replaces both configs)
├── WeightControl (new)
│   ├── Big number display (tappable → keyboard input)
│   ├── IncrementRow (new) — [-10][-5][-1][+1][+5][+10]
│   └── SmartPinRow (new) — saved weight presets
├── LoadProfilePreview (simplified from LoadProfileChart)
│   └── Read-only SVG, no drag handles, compact height
├── EccentricControl (refactored from EccentricSlider)
│   └── Compact horizontal slider with label
└── ChainsControl (refactored from ChainsSelector)
    └── Type toggle + weight stepper
```

### Key Design Decisions

1. **Tappable weight number** — tap to open a numeric input for exact weight entry (SmartPin concept). Replaces scroll-through-195-values.

2. **Increment buttons** — fixed set: [-10, -5, -1, +1, +5, +10]. Clamped to 5-200 range. Buttons disable at bounds.

3. **SmartPins** — up to 3 saved weights per mode. Stored in AsyncStorage (not device). Tap to apply instantly. Long-press to update. "+" to add current weight.

4. **Read-only preview** — the LoadProfileChart becomes non-interactive. It just shows the resulting rep shape based on current weight + chains + eccentric. Only shown for Weight Training where the shape actually varies.

5. **Eccentric simplification** — keep the -195 to +195 range (SDK constraint) but display as percentage with clear labels: "Overload +30%" or "Underload -20%" or "Balanced".

6. **Chains** — keep existing RadioGroup (Normal/Inverse) + weight picker pattern from ChainsSelector, just restyle to be more compact.

7. **Commit-on-release** — keep the existing local-state-during-drag, commit-to-store-on-release pattern for all controls. This prevents BLE churn.

### What Gets Removed

- `WeightTrainingConfig.tsx` — replaced by ModeControls
- `BasicModeConfig.tsx` — replaced by ModeControls
- LoadProfileChart drag handles and PanResponder logic
- The full-height (220px) interactive chart

### What Stays

- `LoadProfileChart.tsx` — simplified to read-only preview mode (remove PanResponder, reduce height)
- `EccentricSlider.tsx` — refactored to compact layout
- `ChainsSelector.tsx` — refactored to compact layout
- All store state and BLE commit patterns unchanged

### Accessibility

- Weight number: `accessibilityRole="adjustable"`, increment/decrement actions
- Increment buttons: `accessibilityRole="button"`, labels like "Increase by 5 pounds"
- SmartPins: `accessibilityRole="button"`, labels like "Set weight to 100 pounds"
- Sliders: existing `@react-native-community/slider` a11y
- Preview chart: `accessibilityRole="image"`, label describing the load profile

### Future: Exercise Screen

This same `ModeControls` component (or a subset — just WeightControl) can be embedded in the exercise screen for mid-workout adjustment. The increment buttons and SmartPins are designed for quick one-tap changes during a set break.
