import { test, expect } from './fixtures';

test.describe('Smoke tests', () => {
  test('loads the app', async ({ page }) => {
    await page.goto('/?mock');
    await expect(page).toHaveTitle('Voltra Connect');
  });

  test('auto-connects with mock BLE', async ({ mockPage }) => {
    await expect(mockPage.getByText('Weight Training')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows connection guard without mock', async ({ guardPage }) => {
    await expect(guardPage.getByText('Connect', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
