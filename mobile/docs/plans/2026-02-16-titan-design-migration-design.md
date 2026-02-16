# Titan Design System Migration

**Date**: 2026-02-16
**Status**: Approved
**Scope**: voltras/mobile + titan-design

## Goal

Migrate the voltras mobile app from its custom `@/theme` system to the titan-design system (`@titan-design/react-ui`). This is a full visual refresh — not a 1:1 swap — leveraging titan's elevation system, semantic tokens, compound component patterns, and accessibility infrastructure.

## Guiding Principles

1. **The design system leads, the app adapts.** Don't reshape titan to mirror the app's current look. Adopt titan's tokens, elevation, and patterns. Only extend titan for genuinely reusable capabilities.
2. **Strong generics bar.** Components promoted to titan-design must be domain-agnostic. Split mega-components into composable primitives rather than promoting monoliths.
3. **No functionality loss.** Every capability the app has today must be preserved, even if the implementation changes.

## Approach: Bottom-Up Component Replacement

Three layers, bottom to top:

1. **Foundation** — Align tokens and elevation between the two systems
2. **Component palette** — Add missing components to titan-design, then replace app primitives
3. **Screen recomposition** — Rebuild each screen using the new palette

Parallelization is maximized within each layer for independent work items.

---

## Phase 1: Foundation

### 1a. Color Token Alignment

The app adapts to titan's semantic token palette. No changes to titan required.

| App Token | Titan Token | Action |
|-----------|-------------|--------|
| `primary.*` (#f97316 orange) | `brand-primary` (#FF7900 accent) | Adopt titan's orange. ~3% hue shift. |
| `surface.*` (8 hardcoded levels) | `surface-*` (5 semantic) + elevation-derived | Titan's 5 tokens + dynamic elevation covers the range. Delete app's 8 levels. |
| `content/text.*` | `text-*` | Direct mapping. Adopt titan's. |
| `success` (#22c55e green) | `status-success` (#14B8A6 teal) | Adopt titan's teal. More accessible. |
| `warning` (#eab308) | `status-warning` (#FFB020) | Adopt titan's amber. |
| `danger/error` (#ef4444) | `status-error` (#D14343) | Adopt titan's red. |
| `info` (#3b82f6) | `status-info` (#2196F3) | Adopt titan's blue. |
| (none) | `result-*` (improve/degrade/inconclusive) | New for app. Use for VBT trend display. |
| (none) | `data-*` (10 chart series colors) | New for app. Replace inline chart colors. |

**App color utility functions** (`theme/utils.ts` — `getRPEColor()`, `getVelocityColor()`, etc.) stay in the app but are updated to reference titan semantic tokens instead of raw hex values.

### 1b. Elevation Alignment

The app adopts titan's elevation system wholesale.

**Current app**: 4 levels (0, 1, 2, inset) with hardcoded backgrounds + simple single-shadow.

**Titan**: 8 levels (-2 to +5) with dynamic surface colors, dual neumorphic shadows (rim light + cast shadow), component-specific ranges, hover states, LRU caching.

The visual change is intentional — this is a refresh.

**One titan addition: glow shadows.** The app uses glow variants (orange glow when recording, green on success, red on danger) for active/emphasis states. This is a genuinely reusable pattern beyond fitness apps.

Proposed addition to titan-design: optional glow/emphasis shadow support parameterized by semantic color on elevated components. Small surface area, high reuse.

### 1c. Tailwind Config Swap

Replace the app's `tailwind.config.js` (which hardcodes colors matching `@/theme`) with a config that extends titan-design's token-based configuration. After this, all Tailwind classes (`bg-surface-elevated`, `text-brand-primary`, etc.) resolve to titan tokens.

### 1d. Delete `@/theme`

After all replacements complete, delete the entire `src/theme/` directory:
- `colors.ts` — replaced by titan semantic tokens
- `shadows.ts` — replaced by titan elevation system
- `styles.ts` — replaced by titan components + Tailwind classes
- `utils.ts` — domain-specific color functions move to a domain utility file, referencing titan tokens

---

## Phase 1: Component Palette

### Direct Replacements (11 components)

App components with existing titan-design equivalents. Each swap may need minor API adjustments.

| App Component | Titan Replacement | Key API Changes |
|---------------|-------------------|----------------|
| `ActionButton` | `Button` + `ButtonText` + `ButtonIcon` | String `title` prop → compound children. `variant` mapping: primary→solid/primary, secondary→outline, danger→solid/error, success→solid/success. |
| `Badge` | `Badge` | Compare variant and size props. |
| `Banner` | `Alert` | Icon + colored bar + text → Alert with variant. |
| `ErrorBanner` | `Alert` (error variant) | Dismissible error alert. |
| `Card` | `Card` (compound) | String `header` prop → `<CardHeader><CardTitle>`. |
| `BottomSheet` | `Drawer` | Verify Drawer supports bottom position + RN Modal + drag handle. May need titan enhancement. |
| `Divider` | `Divider` | Straightforward. |
| `EmptyState` | `EmptyState` | Both have icon + title + subtitle. |
| `LoadingState` | `Spinner` + `Typography` | Composition of existing primitives. |
| `OptionSelector` | `Radio` | Radio-style selection with icons. |
| `ProgressBar` | `Progress` | Linear progress. |
| `StatusIndicator` | `Badge` variant | Colored dot + label → Badge or Chip. |

**BottomSheet → Drawer** requires verification that titan's Drawer supports mobile-native bottom sheet behavior (RN Modal, slide animation, drag handle). If not, Drawer needs enhancement before this swap.

### New Titan-Design Components (7 components)

#### Surface

Minimal elevation-aware View with no layout opinions. The lower-level primitive that Card builds on.

- Props: `elevation` (ElevationLevel), `className`, children
- Applies dynamic background color + shadow from titan's elevation system
- Card becomes Surface + padding + compound structure

#### Stack / HStack / VStack

Flexbox layout primitives with gap support. Used everywhere, zero domain specificity.

- `Stack`: configurable direction
- `HStack`: `flexDirection: 'row'`
- `VStack`: `flexDirection: 'column'`
- Props: `gap`, `align`, `justify`, `wrap`

#### Section (compound)

Groups content with title, optional subtitle, optional action slot, divider.

- `Section` — container
- `SectionHeader` — title + subtitle + optional trailing action
- `SectionContent` — children wrapper

#### ListItem (compound, decomposed)

The app's 142-line ListItem mega-component becomes compound components:

- `ListItem` — container with pressable support
- `ListItemIcon` — leading icon/avatar slot
- `ListItemContent` — title + subtitle text area
- `ListItemTrailing` — right-side slot (chevron, badge, switch, etc.)
- `ListItemDivider` — optional bottom divider

```tsx
<ListItem onPress={handlePress}>
  <ListItemIcon as={SettingsIcon} />
  <ListItemContent title="Notifications" subtitle="Manage alerts" />
  <ListItemTrailing><Switch /></ListItemTrailing>
</ListItem>
```

#### IconBox (or Avatar variant)

Icon in a colored rounded container. Could be a variant of titan's existing Avatar component or standalone. Used for list items, stats, navigation.

#### DataRow

Label + value display. Props: `label`, `value`, optional `valueColor`. Simple key-value pattern recurring across any data-display context.

#### Metric + MetricGroup

Generic dashboard metric display — large formatted value + label + optional trend indicator.

- `Metric` — value + label + optional trend (up/down/neutral, uses `result-*` tokens)
- `MetricGroup` — horizontal layout of Metrics with auto-dividers

Replaces the app's `StatDisplay` and `StatsRow` with domain-agnostic primitives.

### Components Staying in App

Domain-specific components that reference titan primitives but live in the app:

| Category | Components |
|----------|-----------|
| **Recording** | LiveMetrics, PhaseIndicator, RecordingDisplay, RestTimer, WorkoutControls |
| **Analytics** | RepHistoryTable, SetSummaryModal, ForceCurveChart, VelocityTrendChart, AggregateStats, WorkoutDetailModal, WorkoutListItem |
| **Exercise** | ExerciseSessionActionButtons, ExerciseSessionProgress, ExerciseSessionSummaryCard, SetTargetCard, ResumeSessionPrompt |
| **Planning** | DiscoveryProgress, ExerciseSelector, GoalPicker, RecommendationCard, WeightSetupCard |
| **Device** | BLEWarning, ConnectionBanner, ConnectionGuard, ConnectPrompt, DeviceList, ScanButton |
| **Mode** | ChainsSelector, EccentricSlider, WeightTrainingConfig |
| **Input** | WeightPicker (slider-based, uses @react-native-community/slider) |
| **Navigation** | LinkCard (becomes inline composition of Card + Pressable) |

These get restyled using titan primitives during Phase 2 screen migration.

---

## Phase 2: Screen Recomposition

Each screen is rebuilt using the new component palette. Domain logic stays, styling shifts entirely to titan tokens via Tailwind classes. No more StyleSheet objects or @/theme imports.

### Migration Order

1. **Settings** — simplest screen. Mostly ListItems + Sections. Validates the new component palette end-to-end.
2. **Modes** — newest screen, small surface area. Validates mode config components with titan primitives.
3. **Dashboard** — stat displays, cards, banners. Validates Metric, Card, Alert replacements.
4. **History** — data-heavy with lists, modals, charts. Validates ListItem compound pattern, Drawer, data display.
5. **Exercise/Workout** — most complex. LiveMetrics, RecordingDisplay, WorkoutControls, session flow. Last because it depends on all other patterns being established.

### Per-Screen Process

1. Replace all `@/theme` imports with titan Tailwind classes
2. Swap app primitives for titan components
3. Adjust layout to use titan's elevation and spacing
4. Verify visually in simulator
5. Run existing tests

### Navigation Chrome

Tab bar and headers updated once (during Settings migration) to reference titan tokens. `_layout.tsx` switches from `colors.surface.elevated` to titan's semantic CSS variables.

---

## Parallelization Plan

### Phase 1 Batches

```
Batch A (all parallel, no dependencies):
  ├─ Stack / HStack / VStack
  ├─ Section (compound)
  ├─ IconBox
  ├─ DataRow
  └─ Metric + MetricGroup

Batch B (parallel with each other, independent of A):
  ├─ Glow shadow addition to titan elevation
  └─ Surface component

Batch C (depends on Batch B — Surface):
  └─ ListItem compound component

Batch D (depends on Batch B — glow):
  ├─ App tailwind.config.js swap to titan tokens
  └─ 11 direct component replacements (parallel with each other)

Final:
  └─ Delete @/theme directory
```

### Phase 2

Screens are sequential (each validates patterns for the next). Within each screen, individual component files can be migrated in parallel.

---

## Scope Summary

| Category | Count |
|----------|-------|
| New titan-design components | 7 (Surface, Stack, Section, ListItem, IconBox, DataRow, Metric) |
| Titan-design enhancements | 1 (glow shadow support) |
| App components replaced | 11 |
| App components restyled | ~30 (domain-specific, during screen migration) |
| Screens recomposed | 5 |
| Directories deleted | 1 (`src/theme/`) |
