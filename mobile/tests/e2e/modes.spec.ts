import { test, expect } from './fixtures';

test.describe('Mode Drawer', () => {
  test('shows current mode in header', async ({ mockPage }) => {
    await expect(mockPage.getByText('Weight Training')).toBeVisible();
  });

  test('mode header has dropdown chevron', async ({ mockPage }) => {
    const header = mockPage.getByRole('button', { name: /tap to switch mode/i });
    await expect(header).toBeVisible();
  });

  test('tapping header opens mode drawer', async ({ mockPage }) => {
    await mockPage.getByRole('button', { name: /tap to switch mode/i }).click();

    for (const mode of [
      'Weight Training',
      'Resistance Band',
      'Rowing',
      'Damper',
      'Isokinetic',
      'Isometric',
    ]) {
      await expect(mockPage.getByText(mode, { exact: true }).first()).toBeVisible();
    }
  });

  test('selecting a mode updates header', async ({ mockPage }) => {
    await mockPage.getByRole('button', { name: /tap to switch mode/i }).click();

    const drawerRowing = mockPage.getByRole('button', { name: /Rowing/i });
    await drawerRowing.click();

    await expect(
      mockPage.getByRole('button', { name: /Rowing — tap to switch mode/i }),
    ).toBeVisible();
  });

  test('drawer closes after selection', async ({ mockPage }) => {
    await mockPage.getByRole('button', { name: /tap to switch mode/i }).click();

    await expect(mockPage.getByText('Damper')).toBeVisible();

    await mockPage.getByRole('button', { name: /Rowing/i }).click();

    await expect(mockPage.getByText('Row machine simulation')).toBeHidden();
  });
});
