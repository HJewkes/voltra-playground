import { test, expect } from './fixtures';

test.describe('Exercise Setup', () => {
  test('shows weight display', async ({ mockPage }) => {
    await expect(mockPage.getByText('45')).toBeVisible();
  });

  test('shows Add Set button', async ({ mockPage }) => {
    await expect(mockPage.getByText('Add Set')).toBeVisible();
  });

  test('shows Advanced accordion', async ({ mockPage }) => {
    await expect(mockPage.getByText('Advanced')).toBeVisible();
  });

  test('shows Load Plan button', async ({ mockPage }) => {
    await expect(mockPage.getByText('Load Plan from Clipboard')).toBeVisible();
  });

  test('shows Start Workout button', async ({ mockPage }) => {
    await expect(mockPage.getByText('Start Workout')).toBeVisible();
  });
});
