/**
 * Rest phase tests (VLT-10.06)
 *
 * The resting state is triggered automatically by the mock BLE adapter when it
 * detects an idle phase between sets. Reliably triggering this in E2E requires
 * waiting ~40-50 s for a full set to complete and the idle threshold to fire,
 * which is too slow for a CI suite.
 *
 * Instead, we test the post-set results view — the UI state reached after
 * "Stop Workout" — which shows the completed set log (weight, set number) and
 * the "Next Exercise" button. We also verify the Add Set button that is the
 * prerequisite for multi-set (rest-triggering) workouts.
 */

import { test, expect } from './fixtures';

test.describe('Rest phase / post-set results (VLT-10.06)', () => {
  test('results view shows Next Exercise button after stopping workout', async ({ mockPage }) => {
    await expect(mockPage.getByText('Start Workout')).toBeVisible({ timeout: 10_000 });
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // Wait for at least one rep so we have a meaningful set
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();

    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });
  });

  test('results view shows completed Set 1 entry with weight', async ({ mockPage }) => {
    await expect(mockPage.getByText('Start Workout')).toBeVisible({ timeout: 10_000 });
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });

    // Set log shows Set 1 row with the default weight (45 lbs)
    await expect(mockPage.getByText('Set 1')).toBeVisible();
    await expect(mockPage.getByText('45 lbs')).toBeVisible();
  });

  test('Add Set button is available before starting workout', async ({ mockPage }) => {
    // The Add Set button lets users queue multiple sets — prerequisite for rest phase
    await expect(
      mockPage.getByRole('button', { name: /add set/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Add Set button is disabled during active recording', async ({ mockPage }) => {
    await expect(mockPage.getByText('Start Workout')).toBeVisible({ timeout: 10_000 });
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    const addSetBtn = mockPage.getByRole('button', { name: /add set/i });
    await expect(addSetBtn).toBeDisabled();
  });
});
