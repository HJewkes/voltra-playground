import { test as base, type Page } from '@playwright/test';

/**
 * Custom fixtures for Voltra Connect E2E tests.
 *
 * - mockPage: navigates to /?mock, waits for mock BLE auto-connect and
 *   redirect to the exercise tab.
 * - guardPage: navigates to / without mock — stays on the connection guard.
 */
export const test = base.extend<{ mockPage: Page; guardPage: Page }>({
  mockPage: async ({ page }, use) => {
    await page.goto('/?mock');
    // Mock BLE auto-connects and the guard redirects to /(tabs)/exercise
    await page.waitForURL('**/exercise**', { timeout: 30_000 });
    await use(page);
  },

  guardPage: async ({ page }, use) => {
    await page.goto('/');
    // Wait for the connection guard UI to render
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

export { expect } from '@playwright/test';
