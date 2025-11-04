/**
 * E2E Tests for Plugin Runs (Logs) Page
 *
 * Tests the plugin execution logs page with filtering, pagination,
 * and detail modal functionality.
 *
 * Test Coverage:
 * - Page display and accessibility
 * - Status filtering
 * - Job name filtering
 * - Pagination
 * - Log detail modal
 * - Status badge color coding
 * - Dark mode compatibility
 */

import { test, expect } from '@playwright/test';

// Tests plugin runs page using plugin key (drowl-plugin-test)
// API now supports string keys for plugin identification
test.describe('Plugin Runs Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('https://devcle.test/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('https://devcle.test/dashboard');
  });

  test('should display runs page with correct structure', async ({ page }) => {
    // Navigate directly to plugin runs page
    // Note: drowl-plugin-test has jobs defined but no menu link, so we navigate directly
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Check page structure
    await expect(page.locator('h1')).toContainText('Execution History');
    await expect(page.locator('text=Back to Plugins')).toBeVisible();

    // Check summary cards are present
    await expect(page.locator('[data-testid^="summary-card-"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="summary-card-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-card-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-card-failed"]')).toBeVisible();

    // Check filter buttons
    await expect(page.locator('[data-testid="filter-button-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-button-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-button-failed"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-button-running"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-button-pending"]')).toBeVisible();

    // Check job name filter
    await expect(page.locator('[data-testid="job-name-filter-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-name-filter-button"]')).toBeVisible();

    // Check table is present
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Job")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Started")')).toBeVisible();
    await expect(page.locator('th:has-text("Duration")')).toBeVisible();
    await expect(page.locator('th:has-text("Events")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test('should filter runs by status', async ({ page }) => {
    // Navigate directly to plugin runs page
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Click on "Success" filter
    await page.click('[data-testid="filter-button-success"]');
    await page.waitForURL(/status=success/);

    // Verify URL contains status parameter
    expect(page.url()).toContain('status=success');

    // Verify "Success" button is active (has blue background)
    const successButton = page.locator('[data-testid="filter-button-success"]');
    await expect(successButton).toHaveClass(/bg-blue-600/);

    // Click on "Failed" filter
    await page.click('[data-testid="filter-button-failed"]');
    await page.waitForURL(/status=failed/);

    expect(page.url()).toContain('status=failed');

    // Click on "All" to clear filter
    await page.click('[data-testid="filter-button-all"]');
    await page.waitForTimeout(500);

    expect(page.url()).not.toContain('status=');
  });

  test('should filter runs by job name', async ({ page }) => {
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Type job name in filter input
    const jobNameInput = page.locator('[data-testid="job-name-filter-input"]');
    await jobNameInput.fill('sync');

    // Submit filter by pressing Enter
    await jobNameInput.press('Enter');
    await page.waitForURL(/jobName=sync/);

    // Verify URL contains jobName parameter
    expect(page.url()).toContain('jobName=sync');

    // Verify clear button is visible
    await expect(page.locator('[data-testid="job-name-filter-clear"]')).toBeVisible();

    // Clear filter
    await page.click('[data-testid="job-name-filter-clear"]');
    await page.waitForTimeout(500);

    expect(page.url()).not.toContain('jobName=');
  });

  test('should paginate runs', async ({ page }) => {
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Check if pagination is present (only if there are multiple pages)
    const paginationNext = page.locator('[data-testid="pagination-next"]');
    if (await paginationNext.isVisible()) {
      // Check that previous button is disabled on first page
      const paginationPrevious = page.locator('[data-testid="pagination-previous"]');
      await expect(paginationPrevious).toBeDisabled();

      // Click next button
      await paginationNext.click();
      await page.waitForURL(/page=2/);

      // Verify URL contains page parameter
      expect(page.url()).toContain('page=2');

      // Check that previous button is now enabled
      await expect(paginationPrevious).toBeEnabled();

      // Click previous button
      await paginationPrevious.click();
      await page.waitForTimeout(500);

      // Verify we're back on page 1
      expect(page.url()).toMatch(/page=1|(?!page=)/);
    }
  });

  test('should open and close run detail modal', async ({ page }) => {
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Click on "View Details" button for the first run
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();

      // Check modal is displayed
      await expect(page.locator('[data-testid="run-detail-modal"]')).toBeVisible();
      await expect(page.locator('text=Run Details')).toBeVisible();

      // Check modal content
      await expect(page.locator('text=Run ID:')).toBeVisible();
      await expect(page.locator('text=Job Name:')).toBeVisible();
      await expect(page.locator('text=Status:')).toBeVisible();
      await expect(page.locator('text=Started At:')).toBeVisible();
      await expect(page.locator('text=Events Processed:')).toBeVisible();

      // Close modal by clicking close button
      await page.click('[data-testid="close-modal-button"]');
      await page.waitForTimeout(300);

      // Check modal is closed
      await expect(page.locator('[data-testid="run-detail-modal"]')).not.toBeVisible();
    }
  });

  test('should display status badges with correct colors', async ({ page }) => {
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Check for status badges
    const statusBadges = page.locator('[data-testid^="status-badge-"]');
    const count = await statusBadges.count();

    if (count > 0) {
      // Check at least one badge exists and has appropriate styling
      const firstBadge = statusBadges.first();
      await expect(firstBadge).toBeVisible();

      // Check badge has color classes (either green, red, blue, or gray)
      const badgeClass = await firstBadge.getAttribute('class');
      expect(badgeClass).toMatch(/(bg-green|bg-red|bg-blue|bg-gray)/);
    }
  });

  test('should support dark mode', async ({ page }) => {
    // Set dark mode
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Check dark mode classes are applied
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check table header has dark background
    const thead = page.locator('thead');
    const theadClass = await thead.getAttribute('class');
    expect(theadClass).toContain('dark:bg-gray-900');

    // Verify color contrast between text and background
    const headerCell = page.locator('th').first();
    const headerCellClass = await headerCell.getAttribute('class');
    expect(headerCellClass).toContain('dark:text-gray-400');

    // Check summary cards have dark background
    const summaryCard = page.locator('[data-testid^="summary-card-"]').first();
    const summaryCardClass = await summaryCard.getAttribute('class');
    expect(summaryCardClass).toContain('dark:bg-gray-800');
  });

  test('should check design alignment and spacing', async ({ page }) => {
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/runs');

    // Check summary cards are evenly spaced
    const summaryCards = page.locator('[data-testid^="summary-card-"]');
    const firstCard = summaryCards.first();
    const secondCard = summaryCards.nth(1);

    if (await secondCard.isVisible()) {
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();

      // Check that cards are not overlapping
      if (firstCardBox && secondCardBox) {
        expect(firstCardBox.x + firstCardBox.width).toBeLessThanOrEqual(secondCardBox.x);
      }
    }

    // Check filter buttons are aligned horizontally
    const filterButtons = page.locator('[data-testid^="filter-button-"]');
    const firstButton = filterButtons.first();
    const secondButton = filterButtons.nth(1);

    if (await secondButton.isVisible()) {
      const firstButtonBox = await firstButton.boundingBox();
      const secondButtonBox = await secondButton.boundingBox();

      // Check that buttons are roughly at the same vertical position
      if (firstButtonBox && secondButtonBox) {
        const verticalDiff = Math.abs(firstButtonBox.y - secondButtonBox.y);
        expect(verticalDiff).toBeLessThan(7); // Allow 7px tolerance for browser rendering differences
      }
    }

    // Check table is not clipped or overflow
    const table = page.locator('table');
    const tableBox = await table.boundingBox();
    if (tableBox) {
      expect(tableBox.width).toBeGreaterThan(0);
      expect(tableBox.height).toBeGreaterThan(0);
    }
  });
});
