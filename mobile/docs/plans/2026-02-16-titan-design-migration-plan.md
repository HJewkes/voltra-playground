# Titan Design Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate voltras/mobile from `@/theme` to `@titan-design/react-ui`, adding 7 new titan components and replacing 11 app primitives.

**Architecture:** Bottom-up — foundation tokens first, then new titan components (with TDD + Storybook), then direct replacements in the app, then screen-by-screen recomposition. Two repos: titan-design (pnpm) and voltras/mobile (npm).

**Tech Stack:** TypeScript, React Native, NativeWind v4, Vitest, Storybook 10, jest-axe, Tailwind CSS

---

## Repo Paths

- **Titan**: `/Users/hjewkes/Documents/projects/titan-design/packages/ui/`
- **App**: `/Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile/`
- **Titan test**: `cd /Users/hjewkes/Documents/projects/titan-design && pnpm test`
- **App test**: `cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile && npm test`

## Conventions Reference

- **Titan component dir**: `packages/ui/src/components/ui/{component-name}/` (kebab-case dir, PascalCase files)
- **Titan custom dir**: `packages/ui/src/components/custom/{PascalCase}/`
- **Files per component**: `ComponentName.tsx`, `ComponentName.test.tsx`, `ComponentName.stories.tsx`, `index.ts`
- **Styling**: NativeWind `className` + `cn()` utility. Semantic tokens only (`bg-surface-elevated` not `bg-gray-800`)
- **Primitives**: `View`, `Text`, `Pressable` — never HTML elements
- **Props**: `isDisabled`, `isLoading`, `onPress`, `variant`, `size`, `color`, `className`
- **Tests**: Vitest + Testing Library + jest-axe. Every test file must include `toHaveNoViolations()` accessibility check.
- **Storybook**: `import type { Meta, StoryObj } from '@storybook/react-vite'` (NOT `@storybook/react`)

---

## Batch A: Independent Titan Components (all parallel)

These 5 components have no dependencies on each other. Each follows TDD: write test → verify fail → implement → verify pass → write story → commit.

---

### Task 1: Stack / HStack / VStack

Flexbox layout primitives with gap support.

**Files:**
- Create: `packages/ui/src/components/ui/stack/Stack.tsx`
- Create: `packages/ui/src/components/ui/stack/Stack.test.tsx`
- Create: `packages/ui/src/components/ui/stack/Stack.stories.tsx`
- Create: `packages/ui/src/components/ui/stack/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts` (add export)

**Step 1: Write the failing test**

```tsx
// Stack.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Stack, HStack, VStack } from './Stack'
import { Text } from 'react-native'

expect.extend(toHaveNoViolations)

describe('Stack', () => {
  it('renders children', () => {
    render(
      <Stack>
        <Text>Item 1</Text>
        <Text>Item 2</Text>
      </Stack>
    )
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 2')).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<Stack className="p-4"><Text>X</Text></Stack>)
    expect(container.firstChild).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Stack>
        <Text>A</Text>
        <Text>B</Text>
      </Stack>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('HStack', () => {
  it('renders children horizontally', () => {
    render(
      <HStack>
        <Text>Left</Text>
        <Text>Right</Text>
      </HStack>
    )
    expect(screen.getByText('Left')).toBeTruthy()
  })
})

describe('VStack', () => {
  it('renders children vertically', () => {
    render(
      <VStack>
        <Text>Top</Text>
        <Text>Bottom</Text>
      </VStack>
    )
    expect(screen.getByText('Top')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/hjewkes/Documents/projects/titan-design && pnpm test -- --run packages/ui/src/components/ui/stack/Stack.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement Stack**

```tsx
// Stack.tsx
import React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12

const gapClasses: Record<Gap, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3',
  4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8',
  10: 'gap-10', 12: 'gap-12',
}

export interface StackProps extends ViewProps {
  gap?: Gap
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  wrap?: boolean
  className?: string
  children: React.ReactNode
}

const alignMap = {
  start: 'items-start', center: 'items-center',
  end: 'items-end', stretch: 'items-stretch',
}

const justifyMap = {
  start: 'justify-start', center: 'justify-center',
  end: 'justify-end', between: 'justify-between', around: 'justify-around',
}

export function Stack({
  gap = 0, align, justify, wrap, className, children, ...props
}: StackProps) {
  return (
    <View
      className={cn(
        'flex',
        gapClasses[gap],
        align && alignMap[align],
        justify && justifyMap[justify],
        wrap && 'flex-wrap',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  )
}

export function HStack(props: StackProps) {
  return <Stack {...props} className={cn('flex-row', props.className)} />
}

export function VStack(props: StackProps) {
  return <Stack {...props} className={cn('flex-col', props.className)} />
}
```

```tsx
// index.ts
export { Stack, HStack, VStack, type StackProps } from './Stack'
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/hjewkes/Documents/projects/titan-design && pnpm test -- --run packages/ui/src/components/ui/stack/Stack.test.tsx`
Expected: PASS

**Step 5: Write Storybook story**

```tsx
// Stack.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { View, Text } from 'react-native'
import { Stack, HStack, VStack } from './Stack'

const meta: Meta<typeof Stack> = {
  title: 'Components/Stack',
  component: Stack,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Stack>

const Box = ({ label }: { label: string }) => (
  <View className="bg-surface-elevated px-4 py-2 rounded-lg">
    <Text className="text-text-primary">{label}</Text>
  </View>
)

export const Horizontal: Story = {
  render: () => (
    <HStack gap={4} align="center">
      <Box label="A" /><Box label="B" /><Box label="C" />
    </HStack>
  ),
}

export const Vertical: Story = {
  render: () => (
    <VStack gap={4}>
      <Box label="A" /><Box label="B" /><Box label="C" />
    </VStack>
  ),
}
```

**Step 6: Add export to barrel**

Add to `packages/ui/src/components/ui/index.ts`:
```tsx
export * from './stack'
```

**Step 7: Commit**

```bash
cd /Users/hjewkes/Documents/projects/titan-design
git add packages/ui/src/components/ui/stack/ packages/ui/src/components/ui/index.ts
git commit -m "feat: add Stack, HStack, VStack layout primitives"
```

---

### Task 2: Section (compound)

Content grouping with title, subtitle, optional action.

**Files:**
- Create: `packages/ui/src/components/ui/section/Section.tsx`
- Create: `packages/ui/src/components/ui/section/Section.test.tsx`
- Create: `packages/ui/src/components/ui/section/Section.stories.tsx`
- Create: `packages/ui/src/components/ui/section/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts`

**Step 1: Write the failing test**

```tsx
// Section.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Section, SectionHeader, SectionContent } from './Section'
import { Text } from 'react-native'

expect.extend(toHaveNoViolations)

describe('Section', () => {
  it('renders compound children', () => {
    render(
      <Section>
        <SectionHeader title="Settings" subtitle="Manage preferences" />
        <SectionContent><Text>Content</Text></SectionContent>
      </Section>
    )
    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByText('Manage preferences')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('renders trailing action in header', () => {
    render(
      <Section>
        <SectionHeader title="Items" trailing={<Text>Edit</Text>} />
        <SectionContent><Text>List</Text></SectionContent>
      </Section>
    )
    expect(screen.getByText('Edit')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Section>
        <SectionHeader title="Test" />
        <SectionContent><Text>Body</Text></SectionContent>
      </Section>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// Section.tsx
import React from 'react'
import { View, Text, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'

export interface SectionProps extends ViewProps {
  className?: string
  children: React.ReactNode
}

export function Section({ className, children, ...props }: SectionProps) {
  return (
    <View className={cn('mb-6', className)} {...props}>
      {children}
    </View>
  )
}

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, trailing, className }: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-center justify-between mb-3 px-1', className)}>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-xs text-text-tertiary mt-0.5">{subtitle}</Text>
        )}
      </View>
      {trailing && <View>{trailing}</View>}
    </View>
  )
}

export interface SectionContentProps extends ViewProps {
  className?: string
  children: React.ReactNode
}

export function SectionContent({ className, children, ...props }: SectionContentProps) {
  return (
    <View className={cn(className)} {...props}>
      {children}
    </View>
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Write Storybook story (follow pattern from Task 1)

**Step 6:** Add `export * from './section'` to barrel

**Step 7:** Commit: `feat: add Section compound component`

---

### Task 3: DataRow

Label + value display primitive.

**Files:**
- Create: `packages/ui/src/components/ui/data-row/DataRow.tsx`
- Create: `packages/ui/src/components/ui/data-row/DataRow.test.tsx`
- Create: `packages/ui/src/components/ui/data-row/DataRow.stories.tsx`
- Create: `packages/ui/src/components/ui/data-row/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts`

**Step 1: Write the failing test**

```tsx
// DataRow.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { DataRow } from './DataRow'

expect.extend(toHaveNoViolations)

describe('DataRow', () => {
  it('renders label and value', () => {
    render(<DataRow label="Weight" value="135 lbs" />)
    expect(screen.getByText('Weight')).toBeTruthy()
    expect(screen.getByText('135 lbs')).toBeTruthy()
  })

  it('renders ReactNode value', () => {
    render(<DataRow label="Status" value={<span>Active</span>} />)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DataRow label="Key" value="Val" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// DataRow.tsx
import React from 'react'
import { View, Text, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'

export interface DataRowProps extends ViewProps {
  label: string
  value: React.ReactNode
  valueClassName?: string
  className?: string
}

export function DataRow({ label, value, valueClassName, className, ...props }: DataRowProps) {
  return (
    <View className={cn('flex-row items-center justify-between py-2', className)} {...props}>
      <Text className="text-sm text-text-secondary">{label}</Text>
      {typeof value === 'string' ? (
        <Text className={cn('text-sm font-medium text-text-primary', valueClassName)}>
          {value}
        </Text>
      ) : (
        <View className={cn(valueClassName)}>{value}</View>
      )}
    </View>
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Story + barrel export + commit: `feat: add DataRow component`

---

### Task 4: Metric + MetricGroup

Generic dashboard metric display.

**Files:**
- Create: `packages/ui/src/components/custom/Metric/Metric.tsx`
- Create: `packages/ui/src/components/custom/Metric/Metric.test.tsx`
- Create: `packages/ui/src/components/custom/Metric/Metric.stories.tsx`
- Create: `packages/ui/src/components/custom/Metric/index.ts`
- Modify: `packages/ui/src/components/custom/index.ts`

Note: This goes in `custom/` (not `ui/`) because it composes multiple primitives into an opinionated layout.

**Step 1: Write the failing test**

```tsx
// Metric.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Metric, MetricGroup } from './Metric'

expect.extend(toHaveNoViolations)

describe('Metric', () => {
  it('renders value and label', () => {
    render(<Metric value="0.65" label="Avg Velocity" unit="m/s" />)
    expect(screen.getByText('0.65')).toBeTruthy()
    expect(screen.getByText('Avg Velocity')).toBeTruthy()
    expect(screen.getByText('m/s')).toBeTruthy()
  })

  it('renders trend indicator', () => {
    render(<Metric value="12" label="Reps" trend="up" />)
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Metric value="5" label="Sets" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MetricGroup', () => {
  it('renders multiple metrics', () => {
    render(
      <MetricGroup>
        <Metric value="5" label="Sets" />
        <Metric value="40" label="Reps" />
      </MetricGroup>
    )
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('40')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MetricGroup>
        <Metric value="1" label="A" />
        <Metric value="2" label="B" />
      </MetricGroup>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// Metric.tsx
import React from 'react'
import { View, Text, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'

export type MetricTrend = 'up' | 'down' | 'neutral'

export interface MetricProps extends ViewProps {
  value: string
  label: string
  unit?: string
  trend?: MetricTrend
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeConfig = {
  sm: { value: 'text-lg font-bold', label: 'text-xs', unit: 'text-xs' },
  md: { value: 'text-2xl font-bold', label: 'text-xs', unit: 'text-sm' },
  lg: { value: 'text-4xl font-bold', label: 'text-sm', unit: 'text-base' },
}

const trendColors: Record<MetricTrend, string> = {
  up: 'text-result-improve',
  down: 'text-result-degrade',
  neutral: 'text-result-inconclusive',
}

const trendArrows: Record<MetricTrend, string> = {
  up: '\u2191', down: '\u2193', neutral: '\u2192',
}

export function Metric({
  value, label, unit, trend, size = 'md', className, ...props
}: MetricProps) {
  const styles = sizeConfig[size]
  return (
    <View className={cn('items-center', className)} {...props}>
      <View className="flex-row items-baseline gap-1">
        <Text className={cn(styles.value, 'text-text-primary')}>{value}</Text>
        {unit && <Text className={cn(styles.unit, 'text-text-tertiary')}>{unit}</Text>}
        {trend && (
          <Text className={cn(styles.unit, trendColors[trend])}>
            {trendArrows[trend]}
          </Text>
        )}
      </View>
      <Text className={cn(styles.label, 'text-text-secondary mt-1')}>{label}</Text>
    </View>
  )
}

export interface MetricGroupProps extends ViewProps {
  className?: string
  children: React.ReactNode
}

export function MetricGroup({ className, children, ...props }: MetricGroupProps) {
  const items = React.Children.toArray(children)
  return (
    <View className={cn('flex-row items-center', className)} {...props}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          <View className="flex-1 items-center">{child}</View>
          {i < items.length - 1 && (
            <View className="w-px h-8 bg-divider mx-2" />
          )}
        </React.Fragment>
      ))}
    </View>
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Story + barrel export + commit: `feat: add Metric and MetricGroup components`

---

### Task 5: IconBox

Icon in a colored container. Evaluate whether to extend existing Avatar or create standalone.

**Files:**
- Create: `packages/ui/src/components/ui/icon-box/IconBox.tsx`
- Create: `packages/ui/src/components/ui/icon-box/IconBox.test.tsx`
- Create: `packages/ui/src/components/ui/icon-box/IconBox.stories.tsx`
- Create: `packages/ui/src/components/ui/icon-box/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts`

**Step 1: Write the failing test**

```tsx
// IconBox.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Text } from 'react-native'
import { IconBox } from './IconBox'

expect.extend(toHaveNoViolations)

const MockIcon = ({ size, className }: { size?: number; className?: string }) => (
  <Text testID="icon">Icon</Text>
)

describe('IconBox', () => {
  it('renders icon', () => {
    render(<IconBox icon={MockIcon} />)
    expect(screen.getByTestId('icon')).toBeTruthy()
  })

  it('applies color variant', () => {
    const { container } = render(<IconBox icon={MockIcon} color="primary" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('applies size variant', () => {
    const { container } = render(<IconBox icon={MockIcon} size="lg" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<IconBox icon={MockIcon} accessibilityLabel="Settings" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// IconBox.tsx
import React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'

type IconBoxColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral'
type IconBoxSize = 'sm' | 'md' | 'lg'

export interface IconBoxProps extends ViewProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  color?: IconBoxColor
  size?: IconBoxSize
  className?: string
}

const colorClasses: Record<IconBoxColor, { bg: string; icon: string }> = {
  primary: { bg: 'bg-brand-primary-subtle', icon: 'text-brand-primary' },
  secondary: { bg: 'bg-brand-secondary-subtle', icon: 'text-brand-secondary' },
  success: { bg: 'bg-status-success-subtle', icon: 'text-status-success' },
  error: { bg: 'bg-status-error-subtle', icon: 'text-status-error' },
  warning: { bg: 'bg-status-warning-subtle', icon: 'text-status-warning' },
  info: { bg: 'bg-status-info-subtle', icon: 'text-status-info' },
  neutral: { bg: 'bg-background-subtle', icon: 'text-text-secondary' },
}

const sizeClasses: Record<IconBoxSize, { box: string; iconSize: number }> = {
  sm: { box: 'w-8 h-8 rounded-lg', iconSize: 16 },
  md: { box: 'w-10 h-10 rounded-xl', iconSize: 20 },
  lg: { box: 'w-12 h-12 rounded-xl', iconSize: 24 },
}

export function IconBox({
  icon: Icon, color = 'neutral', size = 'md', className, ...props
}: IconBoxProps) {
  const colors = colorClasses[color]
  const sizes = sizeClasses[size]

  return (
    <View
      className={cn('items-center justify-center', colors.bg, sizes.box, className)}
      {...props}
    >
      <Icon size={sizes.iconSize} className={colors.icon} />
    </View>
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Story + barrel export + commit: `feat: add IconBox component`

---

## Batch B: Elevation Dependencies (parallel with each other)

### Task 6: Glow Shadow Support in Titan Elevation

Add optional glow/emphasis shadow parameterized by color.

**Files:**
- Modify: `packages/ui/src/theme/elevation.ts`
- Modify: `packages/ui/src/theme/elevation.stories.tsx` (add glow examples)

**Step 1: Write failing test for glow**

Add to existing elevation tests (or create if none exist):

```tsx
// In elevation test file
import { getGlowShadow } from '../elevation'

describe('getGlowShadow', () => {
  it('returns glow shadow style for a color', () => {
    const style = getGlowShadow('#FF7900', 'medium')
    expect(style).toBeDefined()
    // Web platform should have boxShadow
  })

  it('scales intensity', () => {
    const subtle = getGlowShadow('#FF7900', 'subtle')
    const strong = getGlowShadow('#FF7900', 'strong')
    expect(subtle).not.toEqual(strong)
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

Add to `elevation.ts`:

```tsx
export type GlowIntensity = 'subtle' | 'medium' | 'strong'

const glowConfig: Record<GlowIntensity, { blur: number; opacity: number }> = {
  subtle: { blur: 12, opacity: 0.25 },
  medium: { blur: 20, opacity: 0.4 },
  strong: { blur: 30, opacity: 0.55 },
}

export function getGlowShadow(
  color: string,
  intensity: GlowIntensity = 'medium'
): ViewStyle {
  const config = glowConfig[intensity]
  const rgb = hexToRgb(color)
  if (!rgb) return {}

  return Platform.select({
    web: {
      boxShadow: `0 0 ${config.blur}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${config.opacity})`,
    } as any,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: config.opacity,
      shadowRadius: config.blur / 2,
      elevation: 0,
    },
  }) as ViewStyle
}
```

**Step 4:** Run test → PASS

**Step 5:** Update elevation story with glow examples

**Step 6:** Commit: `feat: add glow shadow support to elevation system`

---

### Task 7: Surface Component

Minimal elevation-aware View — the building block Card uses.

**Files:**
- Create: `packages/ui/src/components/ui/surface/Surface.tsx`
- Create: `packages/ui/src/components/ui/surface/Surface.test.tsx`
- Create: `packages/ui/src/components/ui/surface/Surface.stories.tsx`
- Create: `packages/ui/src/components/ui/surface/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts`

**Step 1: Write the failing test**

```tsx
// Surface.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Surface } from './Surface'
import { Text } from 'react-native'

expect.extend(toHaveNoViolations)

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface><Text>Content</Text></Surface>)
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('accepts elevation prop', () => {
    const { container } = render(
      <Surface elevation={2}><Text>Elevated</Text></Surface>
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('accepts glow props', () => {
    const { container } = render(
      <Surface elevation={2} glowColor="#FF7900" glowIntensity="medium">
        <Text>Glowing</Text>
      </Surface>
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Surface><Text>A11y</Text></Surface>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// Surface.tsx
import React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '../../../utils/cn'
import {
  type ElevationLevel,
  getElevationSurface,
  getElevationShadow,
  getBaseSurfaceColor,
  type GlowIntensity,
  getGlowShadow,
} from '../../../theme/elevation'

export interface SurfaceProps extends ViewProps {
  elevation?: ElevationLevel
  glowColor?: string
  glowIntensity?: GlowIntensity
  theme?: 'light' | 'dark'
  className?: string
  children: React.ReactNode
}

export function Surface({
  elevation = 0,
  glowColor,
  glowIntensity,
  theme = 'dark',
  className,
  style,
  children,
  ...props
}: SurfaceProps) {
  const baseColor = getBaseSurfaceColor(theme)
  const surfaceColor = getElevationSurface(baseColor, elevation, theme)
  const shadowStyle = getElevationShadow(baseColor, elevation, theme)
  const glowStyle = glowColor ? getGlowShadow(glowColor, glowIntensity) : {}

  return (
    <View
      className={cn('rounded-2xl', className)}
      style={[
        { backgroundColor: surfaceColor },
        shadowStyle,
        glowStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Story + barrel export + commit: `feat: add Surface elevation primitive`

---

## Batch C: ListItem (depends on Surface)

### Task 8: ListItem Compound Component

Decomposed from app's 142-line mega-component.

**Files:**
- Create: `packages/ui/src/components/ui/list-item/ListItem.tsx`
- Create: `packages/ui/src/components/ui/list-item/ListItem.test.tsx`
- Create: `packages/ui/src/components/ui/list-item/ListItem.stories.tsx`
- Create: `packages/ui/src/components/ui/list-item/index.ts`
- Modify: `packages/ui/src/components/ui/index.ts`

**Step 1: Write the failing test**

```tsx
// ListItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Text } from 'react-native'
import {
  ListItem, ListItemIcon, ListItemContent, ListItemTrailing, ListItemDivider,
} from './ListItem'

expect.extend(toHaveNoViolations)

const MockIcon = () => <Text testID="icon">I</Text>

describe('ListItem', () => {
  it('renders compound children', () => {
    render(
      <ListItem>
        <ListItemIcon icon={MockIcon} />
        <ListItemContent title="Notifications" subtitle="Manage alerts" />
        <ListItemTrailing><Text>On</Text></ListItemTrailing>
      </ListItem>
    )
    expect(screen.getByText('Notifications')).toBeTruthy()
    expect(screen.getByText('Manage alerts')).toBeTruthy()
    expect(screen.getByText('On')).toBeTruthy()
  })

  it('handles press events', () => {
    const onPress = vi.fn()
    render(
      <ListItem onPress={onPress}>
        <ListItemContent title="Tap me" />
      </ListItem>
    )
    fireEvent.press(screen.getByText('Tap me'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('renders divider', () => {
    const { container } = render(<ListItemDivider />)
    expect(container.firstChild).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <ListItem accessibilityRole="button" accessibilityLabel="Settings item">
        <ListItemContent title="Settings" />
      </ListItem>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Step 2:** Run test → FAIL

**Step 3: Implement**

```tsx
// ListItem.tsx
import React from 'react'
import { View, Text, Pressable, type ViewProps, type PressableProps } from 'react-native'
import { cn } from '../../../utils/cn'

// --- ListItem (container) ---
export interface ListItemProps extends PressableProps {
  className?: string
  children: React.ReactNode
}

export function ListItem({ className, children, onPress, ...props }: ListItemProps) {
  const Container = onPress ? Pressable : View
  const containerProps = onPress ? { onPress, ...props } : props

  return (
    <Container
      className={cn('flex-row items-center py-3 px-4 min-h-[48px]', className)}
      {...(containerProps as any)}
    >
      {children}
    </Container>
  )
}

// --- ListItemIcon (leading slot) ---
export interface ListItemIconProps extends ViewProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  className?: string
}

export function ListItemIcon({ icon: Icon, className, ...props }: ListItemIconProps) {
  return (
    <View className={cn('mr-3 items-center justify-center', className)} {...props}>
      <Icon size={20} className="text-text-secondary" />
    </View>
  )
}

// --- ListItemContent (title + subtitle) ---
export interface ListItemContentProps extends ViewProps {
  title: string
  subtitle?: string
  className?: string
}

export function ListItemContent({ title, subtitle, className, ...props }: ListItemContentProps) {
  return (
    <View className={cn('flex-1 justify-center', className)} {...props}>
      <Text className="text-sm font-medium text-text-primary">{title}</Text>
      {subtitle && (
        <Text className="text-xs text-text-secondary mt-0.5">{subtitle}</Text>
      )}
    </View>
  )
}

// --- ListItemTrailing (right-side slot) ---
export interface ListItemTrailingProps extends ViewProps {
  className?: string
  children: React.ReactNode
}

export function ListItemTrailing({ className, children, ...props }: ListItemTrailingProps) {
  return (
    <View className={cn('ml-3 items-center justify-center', className)} {...props}>
      {children}
    </View>
  )
}

// --- ListItemDivider ---
export interface ListItemDividerProps extends ViewProps {
  inset?: boolean
  className?: string
}

export function ListItemDivider({ inset = true, className, ...props }: ListItemDividerProps) {
  return (
    <View
      className={cn('h-px bg-divider', inset ? 'ml-14' : '', className)}
      {...props}
    />
  )
}
```

**Step 4:** Run test → PASS

**Step 5:** Story + barrel export + commit: `feat: add ListItem compound component`

---

## Batch D: App Integration

### Task 9: Swap App Tailwind Config to Titan Tokens

Replace hardcoded colors with titan's semantic token system.

**Files:**
- Modify: `voltras/mobile/tailwind.config.js`
- Modify: `voltras/mobile/package.json` (add titan-design dependency)
- Modify: `voltras/mobile/metro.config.js` (add titan-design to watchFolders if using symlink)

**Step 1: Add titan-design as dependency**

For local development with symlink:
```bash
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile
# If using local symlink:
# Ensure metro.config.js watchFolders includes titan-design path
# If publishing first:
# npm install @titan-design/react-ui@latest
```

Determine linking strategy based on current setup — check if titan-design is published or needs local linking. This may require building titan-design first: `cd /Users/hjewkes/Documents/projects/titan-design && pnpm build`

**Step 2: Replace tailwind.config.js**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const titanConfig = require('@titan-design/react-ui/tailwind.config.js')

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    // Include titan-design components for Tailwind to scan
    "./node_modules/@titan-design/react-ui/src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      ...titanConfig.theme?.extend,
    },
  },
  plugins: [],
}
```

**Step 3: Import titan CSS in app entry**

Add to `app/_layout.tsx`:
```tsx
import '@titan-design/react-ui/theme/global.css'
```

**Step 4: Run app tests to verify nothing breaks**

```bash
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile && npm test
```

Expected: All 610 tests pass. The tailwind config change shouldn't break existing className usage since the old color names aren't removed yet.

**Step 5: Commit**

```bash
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras
git add mobile/tailwind.config.js mobile/package.json mobile/package-lock.json mobile/metro.config.js mobile/app/_layout.tsx
git commit -m "feat: integrate titan-design token system into tailwind config"
```

---

### Task 10: Direct Component Replacements (11 swaps)

Each replacement follows the same pattern:
1. Import titan component
2. Find all usages of old component (via grep)
3. Update each usage to titan API
4. Remove old component file
5. Run tests
6. Commit

**These are parallelizable per component.** Each swap is its own commit.

Here's the grep + replacement guide for each:

| # | Find | Replace With | Grep Command |
|---|------|-------------|-------------|
| 10a | `ActionButton` | `Button` + `ButtonText` + `ButtonIcon` | `grep -r "ActionButton" mobile/src/ --include="*.tsx"` |
| 10b | `<Badge` | Titan `Badge` | `grep -r "from.*ui.*Badge\|from.*Badge" mobile/src/ --include="*.tsx"` |
| 10c | `<Banner` | Titan `Alert` | `grep -r "Banner" mobile/src/ --include="*.tsx"` |
| 10d | `ErrorBanner` | Titan `Alert` variant="error" | `grep -r "ErrorBanner" mobile/src/ --include="*.tsx"` |
| 10e | `<Card` (app) | Titan `Card` compound | `grep -r "from.*ui.*Card\|from.*Card" mobile/src/ --include="*.tsx"` |
| 10f | `BottomSheet` | Titan `Drawer` | `grep -r "BottomSheet" mobile/src/ --include="*.tsx"` |
| 10g | `<Divider` | Titan `Divider` | `grep -r "from.*ui.*Divider" mobile/src/ --include="*.tsx"` |
| 10h | `EmptyState` | Titan `EmptyState` | `grep -r "from.*ui.*EmptyState" mobile/src/ --include="*.tsx"` |
| 10i | `LoadingState` | Titan `Spinner` + `Typography` | `grep -r "LoadingState" mobile/src/ --include="*.tsx"` |
| 10j | `OptionSelector` | Titan `Radio` | `grep -r "OptionSelector" mobile/src/ --include="*.tsx"` |
| 10k | `ProgressBar` | Titan `Progress` | `grep -r "ProgressBar" mobile/src/ --include="*.tsx"` |

**Example: Task 10a — ActionButton → Button**

```bash
# Find all usages
grep -rn "ActionButton" mobile/src/ --include="*.tsx"
```

For each usage, transform:
```tsx
// Before
import { ActionButton } from '@/components/ui'
<ActionButton title="Start" variant="primary" icon="play" onPress={handleStart} />

// After
import { Button, ButtonText, ButtonIcon } from '@titan-design/react-ui'
import { Play } from 'lucide-react-native'
<Button variant="solid" color="primary" onPress={handleStart}>
  <ButtonIcon as={Play} />
  <ButtonText>Start</ButtonText>
</Button>
```

After all usages updated:
- Delete `mobile/src/components/ui/buttons/ActionButton.tsx`
- Remove from `mobile/src/components/ui/index.ts`
- Run: `npm test`
- Commit: `refactor: replace ActionButton with titan-design Button`

**Repeat for each of 10b–10k.** Each is an independent commit.

---

### Task 11: Replace App UI Primitives with Titan Equivalents

After direct replacements, swap the remaining promoted components:

| # | Replace | With | Commit |
|---|---------|------|--------|
| 11a | App `Surface` | Titan `Surface` | `refactor: replace app Surface with titan-design Surface` |
| 11b | App `Stack/HStack/VStack` | Titan `Stack/HStack/VStack` | `refactor: replace app Stack with titan-design Stack` |
| 11c | App `Section` | Titan `Section` | `refactor: replace app Section with titan-design Section` |
| 11d | App `ListItem` | Titan `ListItem` (compound) | `refactor: replace app ListItem with titan-design ListItem` |
| 11e | App `IconBox` | Titan `IconBox` | `refactor: replace app IconBox with titan-design IconBox` |
| 11f | App `InfoRow` | Titan `DataRow` | `refactor: replace app InfoRow with titan-design DataRow` |
| 11g | App `StatDisplay/StatsRow` | Titan `Metric/MetricGroup` | `refactor: replace app StatDisplay with titan-design Metric` |
| 11h | App `StatusIndicator` | Titan `Badge` | `refactor: replace app StatusIndicator with titan-design Badge` |

Same pattern: grep usages → update imports + API → delete old file → test → commit.

---

### Task 12: Delete @/theme

After all component swaps are complete:

**Step 1:** Verify no remaining imports

```bash
grep -rn "@/theme\|from.*theme/colors\|from.*theme/styles\|from.*theme/shadows" mobile/src/ --include="*.ts" --include="*.tsx"
```

Expected: Zero results (or only `theme/utils.ts` domain functions if not yet moved).

**Step 2:** Move domain color functions

Move `getRPEColor()`, `getVelocityColor()`, `getConfidenceColor()`, `getConnectionColor()`, `getPhaseColor()` from `theme/utils.ts` to `src/domain/vbt/display-utils.ts` (or similar), updating them to reference titan semantic tokens.

**Step 3:** Delete `src/theme/` directory

```bash
rm -rf mobile/src/theme/
```

**Step 4:** Run tests

```bash
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile && npm test
```

**Step 5:** Commit

```bash
git commit -m "refactor: delete @/theme in favor of titan-design token system"
```

---

## Phase 2: Screen Recomposition (sequential)

### Task 13–17: Screen-by-Screen Migration

Each screen follows the same process. Listed in order:

| Task | Screen | Key Components Used |
|------|--------|-------------------|
| 13 | Settings | ListItem, Section, Switch, Divider |
| 14 | Modes | Surface, Button, Section, ListItem |
| 15 | Dashboard | Metric, MetricGroup, Card, Alert, Badge |
| 16 | History | ListItem, Drawer, Card, DataRow, Metric |
| 17 | Exercise/Workout | Surface, Button, Metric, Progress, Alert, Spinner |

**Per-screen process (same for all):**

1. Read the screen file and all components it imports
2. Replace all remaining `@/theme` references with titan Tailwind classes
3. Replace any remaining `StyleSheet.create` color/spacing objects with className
4. Swap remaining app primitives for titan components
5. Update navigation chrome (headers, tab bar) if applicable
6. Run tests: `npm test`
7. Visual verification in simulator
8. Commit: `refactor: migrate [Screen] to titan-design system`

---

## Verification Checklist (after all tasks)

```bash
# Titan-design: all tests pass
cd /Users/hjewkes/Documents/projects/titan-design && pnpm test

# Titan-design: build succeeds
cd /Users/hjewkes/Documents/projects/titan-design && pnpm build

# App: all tests pass
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile && npm test

# App: no remaining @/theme imports
grep -rn "@/theme" mobile/src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results

# App: no remaining StyleSheet color objects
grep -rn "StyleSheet.create" mobile/src/ --include="*.tsx" | grep -i "color\|background"
# Expected: 0 results (or only truly dynamic values)

# App: Expo dev server starts
cd /Users/hjewkes/Documents/projects/voltras-workspace/voltras/mobile && npm start
```
