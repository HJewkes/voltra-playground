import { test, expect } from './fixtures';

test.describe('Connection guard', () => {
  test('shows Voltra branding', async ({ guardPage }) => {
    await expect(guardPage.getByText('Voltras')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Connect button', async ({ guardPage }) => {
    await expect(
      guardPage.getByText('Connect', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows subtitle', async ({ guardPage }) => {
    await expect(
      guardPage.getByText('Connect your device to get started'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('mock BLE auto-connects and redirects to exercise tab', async ({ mockPage }) => {
    await expect(mockPage).toHaveURL(/exercise/);
    await expect(mockPage.getByText('Weight Training')).toBeVisible({
      timeout: 15_000,
    });
  });
});
