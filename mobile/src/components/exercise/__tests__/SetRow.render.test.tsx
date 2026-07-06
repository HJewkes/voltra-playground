import { render, screen } from '@testing-library/react-native';
import { SetRow } from '@titan-design/react-ui';

/**
 * First render test on the jest-expo native harness (VLT-03.07 / VW-20).
 *
 * Proves the harness renders a real titan organism on the NATIVE path (real
 * react-native + react-test-renderer via jest-expo — vitest cannot transform
 * RN's Flow source). titan `SetRow` is the component mobile's SetLog swaps to
 * in the 09.33a work (PR #140); this locks in that it mounts and emits the
 * expected testIDs/values on-device. When #140 merges (titan 0.4.0 +
 * ThemeProvider), the SetLog-wraps-SetRow integration + the non-black theming
 * assertion land alongside this.
 */
describe('titan SetRow on the native render harness', () => {
  it('renders a completed set with reps, weight, rpe and an a11y label', () => {
    render(
      <SetRow
        mode="completed"
        setNumber={1}
        previous={null}
        reps={8}
        weight={135}
        rpe={7.5}
        unit="lbs"
      />
    );
    expect(screen.getByTestId('set-row')).toBeTruthy();
    expect(screen.getByTestId('set-row-set-number')).toHaveTextContent('1');
    expect(screen.getByTestId('set-row-reps')).toHaveTextContent('8');
    expect(screen.getByTestId('set-row-weight')).toHaveTextContent('135');
    expect(screen.getByTestId('set-row-rpe')).toHaveTextContent('7.5');
    expect(screen.getByLabelText('Set 1: 8 reps at 135 lbs')).toBeTruthy();
  });

  it('renders an active next-set with target reps/weight', () => {
    render(
      <SetRow
        mode="active"
        setNumber={2}
        previous={null}
        reps={null}
        weight={100}
        unit="lbs"
        isNextSet
        targets={{ reps: 5, weight: 100 }}
      />
    );
    expect(screen.getByTestId('set-row')).toBeTruthy();
    expect(screen.getByTestId('set-row-set-number')).toHaveTextContent('2');
  });
});
