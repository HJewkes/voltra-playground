import { test, expect } from './fixtures';

test.describe('Tab navigation', () => {
  test('shows bottom tab bar with Workout and History', async ({ mockPage }) => {
    await expect(mockPage.getByRole('tab', { name: /Workout/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(mockPage.getByRole('tab', { name: /History/ })).toBeVisible();
  });

  test('Workout tab is active by default', async ({ mockPage }) => {
    await expect(mockPage.getByText('Weight Training')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('switching to History tab shows history content', async ({ mockPage }) => {
    await mockPage.getByRole('tab', { name: /History/ }).click();
    await expect(mockPage.getByText('Past Sessions')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('switching back to Workout tab preserves state', async ({ mockPage }) => {
    await mockPage.getByRole('tab', { name: /History/ }).click();
    await expect(mockPage.getByText('Past Sessions')).toBeVisible({
      timeout: 15_000,
    });

    await mockPage.getByRole('tab', { name: /Workout/ }).click();
    await expect(mockPage.getByText('Weight Training')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('settings screen accessible', async ({ mockPage }) => {
    // Navigate to settings route (rendered as a modal in the stack)
    await mockPage.goto('/settings');
    await mockPage.waitForLoadState('networkidle');
    await expect(mockPage.getByText('Version')).toBeVisible({
      timeout: 15_000,
    });
    await expect(mockPage.getByText('BLE Mode')).toBeVisible();
  });
});
