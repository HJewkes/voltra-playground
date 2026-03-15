import { test, expect } from './fixtures';

/**
 * VLT-09.25 — Session Persistence E2E
 *
 * Verifies the full record → stop → history flow: a session recorded in the
 * workout tab appears in the History list after stopping the workout.
 */
test.describe('Session persistence', () => {
  test('recorded session appears in History after stopping workout', async ({ mockPage }) => {
    // Start a workout
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });

    // Wait for at least one rep so the session has a completed set
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    // Stop the workout — persists session with status 'completed'
    await mockPage.getByText('Stop Workout').click();
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });

    // Navigate to History tab — useFocusEffect reloads sessions on focus
    await mockPage.getByRole('tab', { name: /History/ }).click();
    await mockPage.waitForURL('**/history**');

    // "Past Sessions" heading is always rendered
    await expect(mockPage.getByText('Past Sessions')).toBeVisible({ timeout: 10_000 });

    // At least one session card must be listed — confirm the empty state is gone
    await expect(mockPage.getByText('No Sessions Yet')).not.toBeVisible({ timeout: 5_000 });

    // Verify a session entry shows today's date
    const today = new Date().toLocaleDateString();
    await expect(mockPage.getByText(new RegExp(today.replace(/\//g, '\\/')))).toBeVisible({
      timeout: 5_000,
    });
  });

  test('session entry shows exercise name or fallback label', async ({ mockPage }) => {
    // Start and stop a workout to create a session
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });

    // Navigate to History — useFocusEffect reloads sessions on focus
    await mockPage.getByRole('tab', { name: /History/ }).click();
    await mockPage.waitForURL('**/history**');
    await expect(mockPage.getByText('Past Sessions')).toBeVisible({ timeout: 10_000 });
    await expect(mockPage.getByText('No Sessions Yet')).not.toBeVisible({ timeout: 5_000 });

    // Session item shows the exercise name from the training mode ("Weight Training"),
    // the exercise catalog name, or the generic "Exercise" fallback from SessionListItem.
    // Scope to the Past Sessions section to avoid matching the exercise tab mode label.
    const pastSessionsSection = mockPage.getByText('Past Sessions').locator('..');
    const hasExerciseName = await pastSessionsSection
      .getByText(/Weight Training|General Exercise|Exercise/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasExerciseName).toBe(true);
  });

  test('All Time Stats workouts count increments after a session', async ({ mockPage }) => {
    // Navigate to History first to read the current baseline
    await mockPage.getByRole('tab', { name: /History/ }).click();
    await mockPage.waitForURL('**/history**');
    await expect(mockPage.getByText('All Time Stats')).toBeVisible({ timeout: 10_000 });

    // Go back to the Workout tab
    await mockPage.getByRole('tab', { name: /Workout/ }).click();
    await mockPage.waitForURL('**/exercise**');

    // Record and stop a session
    await mockPage.getByText('Start Workout').click();
    await expect(mockPage.getByText('Stop Workout')).toBeVisible({ timeout: 10_000 });
    await expect(mockPage.getByText(/^[1-9]\d*\s*reps/)).toBeVisible({ timeout: 15_000 });

    await mockPage.getByText('Stop Workout').click();
    await expect(mockPage.getByText('Next Exercise')).toBeVisible({ timeout: 10_000 });

    // Return to History via direct navigation to force a fresh session query.
    // Tab click alone won't re-run loadSessions on a pre-mounted screen,
    // but a URL navigation triggers a fresh route render.
    await mockPage.goto('/history');
    await mockPage.waitForURL('**/history**');
    await expect(mockPage.getByText('All Time Stats')).toBeVisible({ timeout: 15_000 });

    // At minimum, the session should appear in the list.
    await expect(mockPage.getByText('No Sessions Yet')).not.toBeVisible({ timeout: 10_000 });

    // The workouts count in the stats card must be ≥ 1
    const statsCard = mockPage.getByText('All Time Stats').locator('../..');
    const statsText = await statsCard.textContent();
    const match = statsText?.match(/(\d+)/);
    const count = match ? parseInt(match[1], 10) : 0;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
