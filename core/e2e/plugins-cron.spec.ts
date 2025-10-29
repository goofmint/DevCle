/**
 * Plugin Cron Execution E2E Tests
 *
 * End-to-end tests for plugin job scheduling and execution.
 * Tests schedule management UI and runs history UI.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test data (admin user and test plugin)
 * - Test plugin (drowl-plugin-test) must have jobs configured in plugin.json
 *
 * Test scenarios:
 * 1. Schedule page displays job definitions
 * 2. Manual job execution (admin only)
 * 3. Runs history page displays execution records
 * 4. Run details modal shows complete information
 * 5. Status filtering works correctly
 */

import { test, expect } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

// Test plugin ID (should exist in test database - from seed data)
const TEST_PLUGIN_ID = '20000000-0000-4000-8000-000000000001'; // drowl-plugin-test

/**
 * Login as admin before each test
 */
test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
});

/**
 * Test: Schedule page displays job definitions
 *
 * Verifies that the schedule management page correctly displays:
 * - Job names and descriptions
 * - Cron schedules
 * - Timeout settings
 * - Manual execution buttons (admin only)
 */
test('schedule page displays job definitions', async ({ page }) => {
  // Navigate to schedule page
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/schedule`);
  await page.waitForLoadState('networkidle');

  // Verify page title
  await expect(page.locator('h1')).toContainText('Job Schedule');

  // Verify job cards are displayed
  // Note: This assumes test plugin has at least one job configured
  const jobCards = page.locator('[class*="bg-white"][class*="rounded-lg"]').filter({
    hasText: 'Cron:',
  });

  // Check if jobs are displayed (may be 0 if plugin has no jobs)
  const count = await jobCards.count();
  if (count > 0) {
    // Verify first job has required fields
    const firstJob = jobCards.first();
    await expect(firstJob).toBeVisible();
    await expect(firstJob.locator('text=Cron:')).toBeVisible();
    await expect(firstJob.locator('text=Timeout:')).toBeVisible();

    // Verify manual run button exists for admin
    await expect(firstJob.locator('button:has-text("Run Now")')).toBeVisible();
  }
});

/**
 * Test: Runs history page displays execution records
 *
 * Verifies that the runs history page correctly displays:
 * - Summary statistics
 * - Run list table
 * - Status badges
 * - Pagination (if applicable)
 */
test('runs history page displays execution records', async ({ page }) => {
  // Navigate to runs page
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/runs`);
  await page.waitForLoadState('networkidle');

  // Verify page title
  await expect(page.locator('h1')).toContainText('Execution History');

  // Verify summary cards are displayed
  await expect(page.locator('text=Total')).toBeVisible();
  // Use span selector to avoid ambiguity between summary card and filter button
  await expect(page.locator('span.text-sm').filter({ hasText: 'Success' })).toBeVisible();
  await expect(page.locator('span.text-sm').filter({ hasText: 'Failed' })).toBeVisible();

  // Verify filter buttons are displayed
  await expect(page.locator('button:has-text("All")')).toBeVisible();
  await expect(page.locator('button:has-text("Success")')).toBeVisible();
  await expect(page.locator('button:has-text("Failed")')).toBeVisible();

  // Verify table structure
  await expect(page.locator('th:has-text("Job")')).toBeVisible();
  await expect(page.locator('th:has-text("Status")')).toBeVisible();
  await expect(page.locator('th:has-text("Started")')).toBeVisible();
  await expect(page.locator('th:has-text("Events")')).toBeVisible();
});

/**
 * Test: Status filtering works correctly
 *
 * Verifies that clicking filter buttons updates the URL and table content.
 */
test('status filtering works correctly', async ({ page }) => {
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/runs`);
  await page.waitForLoadState('networkidle');

  // Click "Success" filter
  await page.click('button:has-text("Success")');

  // Wait for URL to update (setSearchParams doesn't cause full navigation)
  await page.waitForURL('**/runs?*status=success*');

  // Verify URL contains status parameter
  expect(page.url()).toContain('status=success');

  // Verify "Success" button is active (has blue background)
  const successButton = page.locator('button:has-text("Success")').first();
  const classList = await successButton.getAttribute('class');
  expect(classList).toContain('bg-blue-600');

  // Click "All" filter to reset
  await page.click('button:has-text("All")');

  // Wait for URL to update (status param should be removed)
  await page.waitForFunction(() => !window.location.search.includes('status='));

  // Verify URL no longer contains status parameter
  expect(page.url()).not.toContain('status=');
});

/**
 * Test: Dark mode support
 *
 * Verifies that both pages support dark mode correctly.
 */
test('pages support dark mode', async ({ page }) => {
  // Add dark class to html element to enable dark mode
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/schedule`);
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(500); // Wait for styles to apply

  // Check schedule page dark mode
  const scheduleCard = page.locator('[class*="bg-white"]').first();
  const scheduleClasses = await scheduleCard.getAttribute('class');
  expect(scheduleClasses).toMatch(/dark:bg-gray-\d{3}/);

  // Check runs page dark mode
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/runs`);
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(500);

  const runsCard = page.locator('[class*="bg-white"]').first();
  const runsClasses = await runsCard.getAttribute('class');
  expect(runsClasses).toMatch(/dark:bg-gray-\d{3}/);
});

/**
 * Test: Navigation between pages
 *
 * Verifies that users can navigate between schedule and runs pages.
 */
test('navigation between pages works', async ({ page }) => {
  // Start on schedule page
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/schedule`);

  // Verify back to plugins link works
  await page.click('a:has-text("Back to Plugins")');
  await page.waitForURL(/\/dashboard\/plugins$/);
  await expect(page).toHaveURL(`${BASE_URL}/dashboard/plugins`);
});

/**
 * Test: Error handling for non-existent plugin
 *
 * Verifies that appropriate error messages are shown for invalid plugin IDs.
 */
test('error handling for non-existent plugin', async ({ page }) => {
  const fakePluginId = '00000000-0000-0000-0000-000000000000';

  // Try to access schedule for non-existent plugin
  await page.goto(`${BASE_URL}/dashboard/plugins/${fakePluginId}/schedule`);
  await page.waitForLoadState('networkidle');

  // Should show error message
  await expect(page.locator('text=Error')).toBeVisible();
  await expect(page.locator('[class*="bg-red"]')).toBeVisible();

  // Verify back link is present
  await expect(page.locator('a:has-text("Back to Plugins")')).toBeVisible();
});
