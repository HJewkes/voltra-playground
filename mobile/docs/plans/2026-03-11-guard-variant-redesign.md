# Guard Variant Redesign

## Problem

The entry page (ConnectionScreen) has redundant UI layered on top of `DeviceConnection variant="card"`:
- Two nearly identical headings ("Voltra" page title + "Voltras" card header)
- Three bluetooth icons (card header, connect button, empty state)
- Three competing CTAs (settings gear, connect button, instruction text)
- Settings gear navigates to /settings which embeds the same connection card

The guard variant currently reuses ConnectionCard wholesale, inheriting all this redundancy.

## Solution

Give the guard variant its own clean full-screen presentation. The entry page becomes just a guard wrapper — no separate ConnectionScreen layout needed.

### Guard Variant UX

**Disconnected state:**
```
         Voltra
  Connect your device to start

      [ Connect ]

  (discovered devices listed
   below on native after scan)

  (error message if connection fails)
```

- One heading, one subtitle, one CTA
- No card wrapper, no "Voltras" sub-heading, no bluetooth icons
- Web: Connect opens browser device picker
- Native: auto-scans, discovered devices appear as tappable list
- BLE warning banner shown only when relevant (simulator/Expo Go)

**Connected state:**
- Renders `children` (existing behavior, unchanged)

### Component Changes

**DeviceConnection.tsx** — new props:
```typescript
interface DeviceConnectionProps {
  variant: 'inline' | 'card' | 'guard';
  title?: string;       // guard only: heading text (default: "Voltra")
  subtitle?: string;    // context text
  children?: ReactNode; // guard: rendered when connected
  autoScan?: boolean;
}
```

**Guard render path** — new dedicated render (not ConnectionCard):
- SafeAreaView with app branding (title + subtitle)
- Single prominent TouchableOpacity for Connect/Scan
- Flat device list (native, reuses DeviceListItem)
- Inline error display
- BLE warning (conditional)
- Scanning/connecting progress indicators

**ConnectionScreen.tsx** — simplified to:
```tsx
export function ConnectionScreen() {
  const router = useRouter();
  return (
    <DeviceConnection
      variant="guard"
      title="Voltra"
      subtitle="Connect your device to get started"
    >
      <Redirect href="/modes" />
    </DeviceConnection>
  );
}
```

### What stays the same

- **ConnectionCard** — untouched, used by settings and anywhere card variant is needed
- **InlineVariant** — untouched
- **DeviceListItem** — reused by guard for native device list
- **ScanButton** — may be reused or replaced with a larger button for guard
- **All scan/connect/error orchestration** — stays in DeviceConnection.tsx

### What gets removed

- Settings gear from entry page
- "Voltras" heading (card only, guard doesn't use it)
- Redundant bluetooth icons
- "Click Connect to pair your Voltra" instruction text
- Manual `useEffect` + `router.replace` connection redirect in ConnectionScreen

### Accessibility

Guard variant inherits the a11y props added earlier:
- `accessibilityRole="header"` on title
- `accessibilityRole="button"` on connect button
- `accessibilityLabel` on all interactive elements

### Platform Behavior

| | Web | Native |
|---|---|---|
| Initial state | Title + Connect button | Title + "Scanning..." |
| Scan trigger | User taps Connect | Auto-scan on mount |
| Device selection | Browser picker | Tap from discovered list |
| After connection | Renders children | Renders children |
