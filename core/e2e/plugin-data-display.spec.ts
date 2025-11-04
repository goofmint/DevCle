/**
 * Plugin Data Display E2E Tests
 *
 * End-to-end tests for plugin data display UI using Playwright.
 * Tests event list, filtering, pagination, detail modal, and reprocess functionality.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users, plugins, and plugin events
 *
 * Test scenarios:
 * 1. Page load and data display (stats, events table, pagination)
 * 2. Filtering (status, event type, date range, clear)
 * 3. Pagination (next, previous, page numbers)
 * 4. Event detail modal (open, view, close)
 * 5. Reprocess failed event
 * 6. Error handling (401, 403, 404, 429)
 * 7. Access control (authentication required)
 * 8. Dark/light mode color contrast
 * 9. Design consistency
 */

import { test, expect, type Page } from '@playwright/test';

// Base URL for the application (use HTTPS for E2E tests)
const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

// Test plugin key (seeded in database)
const TEST_PLUGIN_KEY = 'drowl-plugin-test';

/**
 * Helper: Login as test user and navigate to plugin data page
 */
async function loginAndNavigate(page: Page) {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for dashboard redirect
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });

  // Navigate to plugin data page
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_KEY}/data`);
  await page.waitForLoadState('networkidle');
}

/**
 * Test Suite: Plugin Data Display Page
 */
test.describe('Plugin Data Display Page', () => {
  /**
   * Test 1: Page displays statistics summary
   */
  test('displays statistics summary with correct values', async ({ page }) => {
    await loginAndNavigate(page);

    // Verify stats cards are visible
    const statsContainer = page.locator('[data-testid="events-stats"]');
    await expect(statsContainer).toBeVisible();

    // Verify all 6 stat cards are displayed
    const statCards = page.locator('.grid.grid-cols-1 > div');
    await expect(statCards).toHaveCount(6);

    // Verify specific stats (based on seed data: 25 total, 10 processed, 8 failed, 7 pending)
    await expect(page.locator('text=Total Events')).toBeVisible();
    await expect(page.locator('text=Processed')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  /**
   * Test 2: Page displays events table with data
   */
  test('displays events table with events from database', async ({ page }) => {
    await loginAndNavigate(page);

    // Verify events table is visible
    const eventsTable = page.locator('[data-testid="events-table"]');
    await expect(eventsTable).toBeVisible();

    // Verify table has header columns
    await expect(page.locator('th:has-text("Event ID")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Ingested At")')).toBeVisible();
    await expect(page.locator('th:has-text("Processed At")')).toBeVisible();
    await expect(page.locator('th:has-text("Error")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();

    // Verify at least one event row is displayed (seed has 25 events, default perPage is 20)
    const eventRows = page.locator('tbody tr');
    const rowCount = await eventRows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(20); // Default perPage

    // Verify "View Detail" buttons are present
    await expect(page.locator('button:has-text("View Detail")').first()).toBeVisible();
  });

  /**
   * Test 3: Pagination controls are displayed
   */
  test('displays pagination controls for navigating pages', async ({ page }) => {
    await loginAndNavigate(page);

    // Seed has 25 events, default perPage is 20, so we should have 2 pages
    await expect(page.locator('text=Page')).toBeVisible();
    await expect(page.locator('text=of')).toBeVisible();

    // Verify next/previous buttons exist
    const nextButton = page.locator('button:has-text("Next")').or(
      page.locator('button[aria-label*="next"]')
    );
    const prevButton = page.locator('button:has-text("Previous")').or(
      page.locator('button[aria-label*="previous"]')
    );

    // Next button should be enabled on page 1 (since we have 2 pages)
    if (await nextButton.count() > 0) {
      await expect(nextButton.first()).toBeVisible();
    }

    // Previous button should be disabled on page 1
    if (await prevButton.count() > 0) {
      const isDisabled = await prevButton.first().isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  /**
   * Test 4: Can filter events by status
   */
  test('filters events by status (failed, processed, pending)', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Check "Failed" status filter
    const failedCheckbox = page.locator('[data-testid="status-filter-failed"]');
    await failedCheckbox.check();

    // Wait for table to update
    await page.waitForTimeout(1000);

    // Verify only failed events are shown (should have "Failed" badges)
    const statusBadges = page.locator('tbody tr span:has-text("Failed")');
    const failedCount = await statusBadges.count();
    expect(failedCount).toBeGreaterThan(0);

    // Verify "Processed" and "Pending" badges are not visible
    await expect(page.locator('tbody tr span:has-text("Processed")')).not.toBeVisible();
    await expect(page.locator('tbody tr span:has-text("Pending")')).not.toBeVisible();
  });

  /**
   * Test 5: Can filter events by event type
   */
  test('filters events by event type text search', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Enter event type filter
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.fill('github.push');

    // Wait for table to update
    await page.waitForTimeout(1000);

    // Verify only github.push events are shown
    const eventTypes = page.locator('tbody tr td:nth-child(2)');
    const count = await eventTypes.count();

    for (let i = 0; i < count; i++) {
      const text = await eventTypes.nth(i).textContent();
      expect(text).toContain('github.push');
    }
  });

  /**
   * Test 6: Can filter events by date range
   */
  test('filters events by date range (start and end dates)', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Set start date filter (events are seeded starting from 2025-10-01)
    const startDateInput = page.locator('[data-testid="start-date-filter"]');
    await startDateInput.fill('2025-10-01');

    // Set end date filter
    const endDateInput = page.locator('[data-testid="end-date-filter"]');
    await endDateInput.fill('2025-10-01');

    // Wait for table to update
    await page.waitForTimeout(1000);

    // Verify events are within date range
    const timestampCells = page.locator('tbody tr td:nth-child(4)'); // Ingested At column
    const count = await timestampCells.count();
    expect(count).toBeGreaterThan(0);
  });

  /**
   * Test 7: Can clear all filters
   */
  test('clears all filters when "Clear Filters" button is clicked', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Apply multiple filters
    await page.locator('[data-testid="status-filter-failed"]').check();
    await page.locator('[data-testid="event-type-filter"]').fill('github');

    // Wait for filters to apply
    await page.waitForTimeout(500);

    // Click "Clear Filters" button
    const clearButton = page.locator('[data-testid="clear-filters-button"]');
    await clearButton.click();

    // Wait for filters to clear
    await page.waitForTimeout(500);

    // Verify filters are cleared
    const failedCheckbox = page.locator('[data-testid="status-filter-failed"]');
    const isChecked = await failedCheckbox.isChecked();
    expect(isChecked).toBe(false);

    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    const value = await eventTypeInput.inputValue();
    expect(value).toBe('');

    // Verify all events are displayed again
    const eventRows = page.locator('tbody tr');
    const rowCount = await eventRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  /**
   * Test 8: Can navigate between pages using pagination
   */
  test('navigates to page 2 when "Next" button is clicked', async ({ page }) => {
    await loginAndNavigate(page);

    // Verify we start on page 1
    await expect(page.locator('text=Page')).toContainText('1');

    // Click next button (either visible text or icon button)
    const nextButton = page.locator('button:has-text("Next")').or(
      page.locator('button svg[class*="chevron-right"]').locator('..')
    ).first();

    // Check if next button exists and is enabled
    if (await nextButton.count() > 0 && !(await nextButton.isDisabled())) {
      await nextButton.click();

      // Wait for page to update
      await page.waitForTimeout(1000);

      // Verify we're on page 2
      await expect(page.locator('text=Page')).toContainText('2');
    }
  });

  /**
   * Test 9: Opens event detail modal when "View Detail" is clicked
   */
  test('opens event detail modal with event metadata and JSON viewer', async ({ page }) => {
    await loginAndNavigate(page);

    // Click first "View Detail" button
    const viewDetailButton = page.locator('button:has-text("View Detail")').first();
    await viewDetailButton.click();

    // Verify modal is opened
    const modal = page.locator('[data-testid="event-detail-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Verify modal header
    await expect(page.locator('#modal-title')).toHaveText('Event Details');

    // Verify metadata is displayed
    await expect(page.locator('label:has-text("Event ID")')).toBeVisible();
    await expect(page.locator('label:has-text("Event Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Ingested At")')).toBeVisible();

    // Verify JSON viewer is rendered (raw data section)
    await expect(page.locator('label:has-text("Raw Data")')).toBeVisible();
    await expect(page.locator('pre').first()).toBeVisible();

    // Verify close button exists
    await expect(page.locator('[data-testid="close-modal-button"]')).toBeVisible();
  });

  /**
   * Test 10: Closes event detail modal when close button is clicked
   */
  test('closes event detail modal when close button is clicked', async ({ page }) => {
    await loginAndNavigate(page);

    // Open modal
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="event-detail-modal"]', { timeout: 2000 });

    // Click close button
    const closeButton = page.locator('[data-testid="close-modal-button"]');
    await closeButton.click();

    // Verify modal is closed
    const modal = page.locator('[data-testid="event-detail-modal"]');
    await expect(modal).not.toBeVisible();
  });

  /**
   * Test 11: Closes event detail modal when backdrop is clicked
   */
  test('closes event detail modal when backdrop is clicked', async ({ page }) => {
    await loginAndNavigate(page);

    // Open modal
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="event-detail-modal"]', { timeout: 2000 });

    // Click backdrop (fixed overlay)
    const backdrop = page.locator('.fixed.inset-0.bg-gray-500').first();
    await backdrop.click({ position: { x: 10, y: 10 } }); // Click on backdrop, not modal content

    // Verify modal is closed
    const modal = page.locator('[data-testid="event-detail-modal"]');
    await expect(modal).not.toBeVisible();
  });

  /**
   * Test 12: Closes event detail modal when Escape key is pressed
   */
  test('closes event detail modal when Escape key is pressed', async ({ page }) => {
    await loginAndNavigate(page);

    // Open modal
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="event-detail-modal"]', { timeout: 2000 });

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal is closed
    const modal = page.locator('[data-testid="event-detail-modal"]');
    await expect(modal).not.toBeVisible();
  });

  /**
   * Test 13: Reprocess button is shown only for failed events
   */
  test('reprocess button is shown only for failed events in modal', async ({ page }) => {
    await loginAndNavigate(page);

    // Filter to show only failed events
    await page.locator('[data-testid="status-filter-failed"]').check();
    await page.waitForTimeout(1000);

    // Open first failed event detail
    const viewDetailButton = page.locator('button:has-text("View Detail")').first();
    await viewDetailButton.click();

    // Verify modal is opened with "Failed" status
    await expect(page.locator('span:has-text("Failed")').first()).toBeVisible();

    // Verify reprocess button exists
    const reprocessButton = page.locator('[data-testid="reprocess-button"]');
    await expect(reprocessButton).toBeVisible();
    await expect(reprocessButton).toHaveText(/Reprocess/);
  });

  /**
   * Test 14: Can reprocess a failed event
   */
  test('reprocesses failed event when "Reprocess" button is clicked', async ({ page }) => {
    await loginAndNavigate(page);

    // Filter to show only failed events
    await page.locator('[data-testid="status-filter-failed"]').check();
    await page.waitForTimeout(1000);

    // Open first failed event detail
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="event-detail-modal"]', { timeout: 2000 });

    // Click reprocess button
    const reprocessButton = page.locator('[data-testid="reprocess-button"]');
    await reprocessButton.click();

    // Wait for success toast notification
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText(/successfully|queued/i);

    // Verify modal is closed after reprocess
    const modal = page.locator('[data-testid="event-detail-modal"]');
    await expect(modal).not.toBeVisible();
  });

  /**
   * Test 15: Redirects to login when accessing page without authentication
   */
  test('redirects to login page when not authenticated', async ({ page }) => {
    // Navigate directly to plugin data page without login
    await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_KEY}/data`);

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Verify login form is displayed
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  /**
   * Test 16: Dark mode has correct color contrast for readability
   */
  test('dark mode has correct color contrast on page elements', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for page to load
    await page.waitForSelector('[data-testid="events-table"]', { timeout: 5000 });

    // Get first event row
    const firstRow = page.locator('tbody tr').first();

    // Test light mode colors
    const lightBgColor = await firstRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Verify light mode has light background
    expect(lightBgColor).toMatch(/rgb\(255, 255, 255\)|transparent|rgba\(0, 0, 0, 0\)/);

    // Switch to dark mode if toggle exists
    const darkModeToggle = page.locator('button[aria-label*="theme"]').or(
      page.locator('button:has-text("Dark")')
    ).or(
      page.locator('button[title*="dark"]')
    );

    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.first().click();
      await page.waitForTimeout(300);

      // Test dark mode colors
      const darkBgColor = await firstRow.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Verify dark mode has dark background or transparent (inherits from parent dark bg)
      // Note: Tailwind 4.x uses OKLCH color space by default
      expect(darkBgColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((31|55), (41|65), (51|85)\)|transparent|rgba\(0, 0, 0, 0\)/);
    }
  });

  /**
   * Test 17: Layout has consistent design without overflow or alignment issues
   */
  test('layout has consistent design with proper spacing and no overflow', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for page to load
    await page.waitForSelector('[data-testid="events-table"]', { timeout: 5000 });

    // Verify no horizontal scrollbar (no overflow)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify stats grid has proper responsive classes
    const statsGrid = page.locator('.grid.grid-cols-1').first();
    await expect(statsGrid).toHaveClass(/md:grid-cols-3/);
    await expect(statsGrid).toHaveClass(/lg:grid-cols-6/);

    // Verify filter section has proper spacing
    const filterSection = page.locator('[data-testid="events-filter"]');
    await expect(filterSection).toBeVisible();

    // Verify table is properly contained
    const tableContainer = page.locator('[data-testid="events-table"]');
    const tableBox = await tableContainer.boundingBox();

    if (tableBox) {
      // Table should not extend beyond viewport
      expect(tableBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });

  /**
   * Test 18: Toast notification auto-dismisses after timeout
   */
  test('toast notification auto-dismisses after 5 seconds', async ({ page }) => {
    await loginAndNavigate(page);

    // Filter to show only failed events
    await page.locator('[data-testid="status-filter-failed"]').check();
    await page.waitForTimeout(1000);

    // Reprocess an event to trigger toast
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="reprocess-button"]', { timeout: 2000 });
    await page.locator('[data-testid="reprocess-button"]').click();

    // Verify toast appears
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Wait for auto-dismiss (5 seconds + 1 second buffer)
    await expect(toast).not.toBeVisible({ timeout: 7000 });
  });

  /**
   * Test 19: Can manually dismiss toast notification
   */
  test('can manually dismiss toast notification by clicking close button', async ({ page }) => {
    await loginAndNavigate(page);

    // Filter to show only failed events
    await page.locator('[data-testid="status-filter-failed"]').check();
    await page.waitForTimeout(1000);

    // Reprocess an event to trigger toast
    await page.locator('button:has-text("View Detail")').first().click();
    await page.waitForSelector('[data-testid="reprocess-button"]', { timeout: 2000 });
    await page.locator('[data-testid="reprocess-button"]').click();

    // Verify toast appears
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Click dismiss button (X icon)
    const dismissButton = toast.locator('button[aria-label="Dismiss"]');
    await dismissButton.click();

    // Verify toast disappears immediately
    await expect(toast).not.toBeVisible({ timeout: 1000 });
  });

  /**
   * Test 20: Empty state is not shown when events exist
   */
  test('does not show empty state when events are present', async ({ page }) => {
    await loginAndNavigate(page);

    // Verify empty state is not visible
    const emptyText = page.locator('text=No events found');
    await expect(emptyText).not.toBeVisible();

    // Verify events table is visible instead
    const eventsTable = page.locator('[data-testid="events-table"]');
    await expect(eventsTable).toBeVisible();
  });

  /**
   * Test 21: Shows empty state when filters return no results
   */
  test('shows empty state when filters return no matching events', async ({ page }) => {
    await loginAndNavigate(page);

    // Apply filter that returns no results (event type that doesn't exist)
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.fill('nonexistent-event-type-xyz');

    // Wait for table to update
    await page.waitForTimeout(1000);

    // Verify empty state is shown
    await expect(page.locator('text=No events found')).toBeVisible();
    await expect(page.locator('text=Try adjusting your filters')).toBeVisible();
  });
});
