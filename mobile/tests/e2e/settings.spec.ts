import { test, expect } from './fixtures';

/**
 * Navigate to the settings modal from the exercise screen.
 *
 * Expo-router on web renders Ionicons as font glyphs with no accessible DOM
 * selector, so we push the route programmatically — the same mechanism the
 * gear icon Pressable uses (router.push('/settings')).
 */
async function openSettings(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForURL('**/settings**', { timeout: 10_000 });
  await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 5_000 });
}

test.describe('Settings Screen', () => {
  test('settings opens from gear icon', async ({ mockPage }) => {
    await openSettings(mockPage);
    await expect(mockPage.getByText('Data Backup')).toBeVisible();
  });

  test('shows Data Backup section', async ({ mockPage }) => {
    await openSettings(mockPage);
    await expect(mockPage.getByText('Data Backup')).toBeVisible();
    await expect(mockPage.getByText('Export Backup')).toBeVisible();
  });

  test('shows Dev Tools section', async ({ mockPage }) => {
    await openSettings(mockPage);
    await expect(mockPage.getByText('Dev Tools')).toBeVisible();
    await expect(mockPage.getByText('Sessions', { exact: true })).toBeVisible();
  });

  test('settings can be dismissed', async ({ mockPage }) => {
    await openSettings(mockPage);
    await expect(mockPage.getByText('Data Backup')).toBeVisible();

    await mockPage.evaluate(() => {
      window.history.pushState({}, '', '/exercise');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await mockPage.waitForURL('**/exercise**', { timeout: 10_000 });
    await expect(mockPage.getByText('Weight Training')).toBeVisible({ timeout: 5_000 });
  });
});
