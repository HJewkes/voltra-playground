import { test, expect } from './fixtures';

test.describe('Recording flow', () => {
  test('shows Start Workout button on exercise screen', async ({ mockPage }) => {
    await expect(mockPage.getByText('Start Workout')).toBeVisible({ timeout: 10_000 });
  });

  test('shows weight display (45 lbs default)', async ({ mockPage }) => {
    await expect(mockPage.getByText('45')).toBeVisible({ timeout: 10_000 });
    await expect(mockPage.getByText('lbs')).toBeVisible();
  });

  test('Start Workout begins recording', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });
  });

  test('recording shows Set 1 active', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Set 1')).toBeVisible({ timeout: 10_000 });
  });

  test('rep count increments during recording', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // Wait for mock BLE to generate at least 1 rep (~3-5s per rep, wait up to 15s)
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });
  });

  test('TempoBar shows phase labels', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // TempoBar renders "Con", "Hold", "Ecc" labels once active set is shown
    await expect(mockPage.getByText('Con')).toBeVisible({ timeout: 10_000 });
    await expect(mockPage.getByText('Hold')).toBeVisible();
    await expect(mockPage.getByText('Ecc')).toBeVisible();
  });

  test('Stop Workout returns to results view', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // Let at least one rep complete for a meaningful set
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();
    // After stopping, results view shows "Next Exercise" button
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });
  });

  test('completed set visible in results view', async ({ mockPage }) => {
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // Wait for reps to accumulate
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });

    // Results view shows Set 1 row with weight info
    await expect(mockPage.getByText('Set 1')).toBeVisible();
    await expect(mockPage.getByText('45 lbs')).toBeVisible();
  });
});
