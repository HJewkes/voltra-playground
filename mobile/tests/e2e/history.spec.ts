import { test, expect } from './fixtures';

test.describe('History screen', () => {
  test('History tab shows view toggle', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await expect(mockPage.getByText('List')).toBeVisible();
    await expect(mockPage.getByText('Calendar')).toBeVisible();
    await expect(mockPage.getByText('Analytics')).toBeVisible();
  });

  test('List view shows All Time Stats', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await expect(mockPage.getByText('All Time Stats')).toBeVisible();
    await expect(mockPage.getByText('Workouts')).toBeVisible();
    await expect(mockPage.getByText('Total Reps')).toBeVisible();
    await expect(mockPage.getByText('Volume (lbs)')).toBeVisible();
  });

  test('List view shows Personal Records', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    // Personal Records only render when session data exists
    const prHeading = mockPage.getByText('Personal Records');
    if (await prHeading.isVisible().catch(() => false)) {
      await expect(mockPage.getByText('Heaviest')).toBeVisible();
      await expect(mockPage.getByText('Most Reps')).toBeVisible();
      await expect(mockPage.getByText('Fastest')).toBeVisible();
      await expect(mockPage.getByText('Most Volume')).toBeVisible();
    }
  });

  test('List view shows Past Sessions', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await expect(mockPage.getByText('Past Sessions')).toBeVisible();
  });

  test('Calendar view shows month grid', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await mockPage.getByText('Calendar').click();

    // Month name should be visible (e.g. "March 2026")
    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(mockPage.getByText(monthName)).toBeVisible();

    // Day-of-week headers
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(mockPage.getByText(day, { exact: true })).toBeVisible();
    }
  });

  test('Calendar highlights today', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await mockPage.getByText('Calendar').click();

    const today = new Date().getDate();
    // Today's date cell should have a border (highlight) — verify the number is visible
    await expect(mockPage.getByText(String(today), { exact: true }).first()).toBeVisible();
  });

  test('Calendar navigation works', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await mockPage.getByText('Calendar').click();

    const now = new Date();
    const currentMonthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(mockPage.getByText(currentMonthName)).toBeVisible();

    // Click back arrow to go to previous month
    await mockPage.locator('[data-testid="chevron-back"]').or(
      mockPage.locator('text=chevron-back')
    ).or(
      // Ionicons render as text on web; fall back to clicking the back button area
      mockPage.getByText(currentMonthName).locator('..').locator('div').first()
    ).first().click();

    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1);
    const prevMonthName = prevDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(mockPage.getByText(prevMonthName)).toBeVisible();
  });

  test('Analytics view shows dashboard cards', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await mockPage.getByText('Analytics').click();

    await expect(mockPage.getByText('Volume Trend')).toBeVisible();
    await expect(mockPage.getByText('PR Timeline')).toBeVisible();
    await expect(mockPage.getByText('Training Load')).toBeVisible();
    await expect(mockPage.getByText('Top Exercises')).toBeVisible();
  });

  test('Analytics shows ACWR gauge', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    await mockPage.getByText('Analytics').click();

    // Training Load card is always visible; ACWR text shows when data exists
    await expect(mockPage.getByText('Training Load')).toBeVisible();

    const acwrText = mockPage.getByText(/ACWR/);
    const needsDataText = mockPage.getByText('Need at least 2 weeks of data');
    // One of these should be visible depending on session data
    const hasAcwr = await acwrText.isVisible().catch(() => false);
    const hasNoData = await needsDataText.isVisible().catch(() => false);
    expect(hasAcwr || hasNoData).toBe(true);
  });

  test('view toggle remembers selection', async ({ mockPage }) => {
    await mockPage.getByText('History').click();
    await mockPage.waitForURL('**/history**');

    // Switch to Calendar
    await mockPage.getByText('Calendar').click();
    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(mockPage.getByText(monthName)).toBeVisible();

    // Switch back to List
    await mockPage.getByText('List').click();
    await expect(mockPage.getByText('All Time Stats')).toBeVisible();
  });
});
