import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AdvancedAccordion } from '../ModeControls';

// ModeControls.tsx imports `ScrollDial` from the `@/components/exercise`
// barrel, which also re-exports SetLog and drags in AsyncStorage + MMKV
// native modules this render test doesn't need. Point the barrel at just the
// real ScrollDial implementation so those heavy, unrelated deps never load.
// (jest.mock calls are hoisted above imports by babel-plugin-jest-hoist, so
// source order here doesn't affect runtime behavior — only lint ordering.)
jest.mock('@/components/exercise', () => ({
  ScrollDial: require('../../exercise/ScrollDial').ScrollDial,
}));

/**
 * Regression coverage for the "Advanced" chevron toggle (fix/tempo-order-align).
 *
 * `toggle()` used to write the Reanimated shared value (`rotation.value =
 * withTiming(...)`) from *inside* the `setExpanded` state-updater callback.
 * React can invoke a setState updater during its render/reconciliation pass,
 * so a shared-value write there risks tripping Reanimated's
 * read/write-during-render strict-mode guard (the exact warning reported on
 * device: "Reading from `value` during component render"). The fix moves the
 * shared-value write into a `useEffect` keyed on the `expanded` boolean, so
 * `toggle()` now only calls `setExpanded`.
 *
 * This runs on the jest-expo native harness (real react-native-reanimated,
 * not a JS-only mock) so the toggle actually exercises useSharedValue +
 * useEffect + useAnimatedStyle end to end. Verified: this repo's Jest
 * environment does not reproduce Reanimated's render-time strict-mode
 * instrumentation (a deliberately-broken sibling component that reads
 * `.value` directly in its render body produces zero console.warn calls
 * here), so this test cannot assert the warning's absence directly. What it
 * *can* and does assert is the behavioral contract of the fix: toggling
 * repeatedly, including in immediate succession (the shape most likely to
 * expose a broken updater), still lands on the correct expanded/collapsed
 * state every time.
 */
describe('AdvancedAccordion toggle', () => {
  const noop = async () => {};

  it('expands on first press and shows hardware controls', () => {
    render(
      <AdvancedAccordion
        showEccentric
        showChains={false}
        eccentric={0}
        setEccentric={noop}
        chains={0}
        inverseChains={0}
        setChains={noop}
        setInverseChains={noop}
      />
    );

    expect(screen.queryByText('Eccentric')).toBeNull();
    fireEvent.press(screen.getByText('Advanced'));
    expect(screen.getByText('Eccentric')).toBeTruthy();
  });

  it('collapses again on second press', () => {
    render(
      <AdvancedAccordion
        showEccentric
        showChains={false}
        eccentric={0}
        setEccentric={noop}
        chains={0}
        inverseChains={0}
        setChains={noop}
        setInverseChains={noop}
      />
    );

    const toggleButton = screen.getByText('Advanced');
    fireEvent.press(toggleButton);
    expect(screen.getByText('Eccentric')).toBeTruthy();
    fireEvent.press(toggleButton);
    expect(screen.queryByText('Eccentric')).toBeNull();
  });

  it('lands on the correct state after rapid repeated presses', () => {
    render(
      <AdvancedAccordion
        showEccentric
        showChains={false}
        eccentric={0}
        setEccentric={noop}
        chains={0}
        inverseChains={0}
        setChains={noop}
        setInverseChains={noop}
      />
    );

    const toggleButton = screen.getByText('Advanced');
    // Odd number of rapid presses -> ends expanded.
    fireEvent.press(toggleButton);
    fireEvent.press(toggleButton);
    fireEvent.press(toggleButton);
    expect(screen.getByText('Eccentric')).toBeTruthy();
  });
});
