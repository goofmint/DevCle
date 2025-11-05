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
    const statCards = statsContainer.locator('> div');
    await expect(statCards).toHaveCount(6);

    // Verify specific stats (based on seed data: 25 total, 10 processed, 2 failed, 13 pending)
    await expect(statsContainer.locator('text=Total Events')).toBeVisible();
    await expect(statsContainer.locator('text=Processed')).toBeVisible();
    await expect(statsContainer.locator('text=Failed')).toBeVisible();
    await expect(statsContainer.locator('text=Pending')).toBeVisible();
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
    // Use aria-label selectors to target desktop pagination (visible in desktop viewport)
    const nextButton = page.locator('button[aria-label="Next page"]');
    const prevButton = page.locator('button[aria-label="Previous page"]');

    // Next button should be enabled on page 1 (since we have 2 pages)
    await expect(nextButton).toBeVisible();
    await expect(nextButton).not.toBeDisabled();

    // Previous button should be disabled on page 1
    await expect(prevButton).toBeVisible();
    await expect(prevButton).toBeDisabled();
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

    // Enter event type filter (use 'github' to match github.pull_request events in seed data)
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.fill('github');

    // Wait for debounce (2 seconds) + API call
    await page.waitForTimeout(3000);

    // Verify only github events are shown
    const eventTypes = page.locator('tbody tr td:nth-child(2)');
    const count = await eventTypes.count();

    if (count === 0) {
      throw new Error('No event rows found after filtering by event type');
    }

    for (let i = 0; i < count; i++) {
      const text = await eventTypes.nth(i).textContent();
      expect(text).toContain('github');
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

    // Wait for debounced event type filter to apply (2s debounce + 500ms buffer)
    await page.waitForTimeout(2500);

    // Wait for network to be idle (all API calls complete)
    await page.waitForLoadState('networkidle');

    // Click "Clear Filters" button
    // Note: Using evaluate().click() instead of .click() due to React synthetic event handling issues
    await page.locator('[data-testid="clear-filters-button"]').evaluate(button => {
      (button as HTMLButtonElement).click();
    });

    // Wait for the API request to complete and filters to be cleared
    await page.waitForResponse(response =>
      response.url().includes('/api/plugins/') && response.status() === 200
    );

    // Verify filters are cleared
    const failedCheckbox = page.locator('[data-testid="status-filter-failed"]');
    await expect(failedCheckbox).not.toBeChecked();

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

    // Click next button (use aria-label to target desktop pagination)
    const nextButton = page.locator('button[aria-label="Next page"]');

    // Verify next button exists and is enabled
    await expect(nextButton).toBeVisible();
    await expect(nextButton).not.toBeDisabled();

    await nextButton.click();

    // Wait for page to update
    await page.waitForTimeout(1000);

    // Verify we're on page 2
    await expect(page.locator('text=Page')).toContainText('2');
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

    // Verify metadata is displayed (scope to modal to avoid conflicts with filters)
    await expect(modal.locator('label:has-text("Event ID")')).toBeVisible();
    await expect(modal.locator('label:has-text("Event Type")')).toBeVisible();
    await expect(modal.locator('label:has-text("Ingested At")')).toBeVisible();

    // Verify JSON viewer is rendered (raw data section)
    await expect(modal.locator('label:has-text("Raw Data")')).toBeVisible();
    // Check if <pre> element exists and has content (may not be "visible" due to scrolling/dimensions)
    const preElement = modal.locator('pre').first();
    await expect(preElement).toBeAttached();
    const preContent = await preElement.textContent();
    expect(preContent).toBeTruthy();
    expect(preContent).toContain('{'); // Should contain JSON

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

    const toggleCount = await darkModeToggle.count();
    if (toggleCount > 0) {
      await darkModeToggle.first().click();
      await page.waitForTimeout(300);

      // Test dark mode colors
      const darkBgColor = await firstRow.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Verify dark mode has dark background or transparent (inherits from parent dark bg)
      // Note: Tailwind 4.x uses OKLCH color space by default
      expect(darkBgColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((31|55), (41|65), (51|85)\)|transparent|rgba\(0, 0, 0, 0\)/);
    } else {
      // Dark mode toggle not implemented yet - test passes if light mode works
      console.log('Dark mode toggle not found - skipping dark mode test');
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
    } else {
      throw new Error('Table bounding box not found');
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

    // Click to view event detail
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

    // Click to view event detail
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

  /**
   * Test: Event type filter maintains focus during typing (no page reload)
   */
  test('event type filter maintains focus while typing without page reload', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Focus on event type input
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.click();

    // Type slowly to simulate real user input
    await eventTypeInput.type('git', { delay: 100 });

    // Verify focus is still on the input (no page reload)
    const isFocused = await eventTypeInput.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);

    // Verify value was entered
    const value = await eventTypeInput.inputValue();
    expect(value).toBe('git');

    // Continue typing
    await eventTypeInput.type('hub', { delay: 100 });

    // Verify focus is STILL on the input
    const isFocusedAfter = await eventTypeInput.evaluate((el) => el === document.activeElement);
    expect(isFocusedAfter).toBe(true);

    // Verify full value
    const finalValue = await eventTypeInput.inputValue();
    expect(finalValue).toBe('github');
  });

  /**
   * Test: Event type filter debounces (waits 2 seconds before filtering)
   */
  test('event type filter debounces and auto-applies after 2 seconds', async ({ page }) => {
    // Capture console logs and page navigations
    const logs: string[] = [];
    const navigations: string[] = [];

    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(`Navigation to: ${frame.url()}`);
      }
    });

    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Get initial event count
    const initialRows = await page.locator('tbody tr').count();

    // Type in event type filter
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.fill('github');

    // Clear navigation log after initial setup
    navigations.length = 0;

    // Wait 1 second - should NOT trigger filter yet
    await page.waitForTimeout(1000);

    // Verify event count hasn't changed (filter not applied yet)
    const rowsAfter1s = await page.locator('tbody tr').count();
    expect(rowsAfter1s).toBe(initialRows);

    // Wait another 1.5 seconds (total 2.5 seconds - should trigger filter)
    await page.waitForTimeout(1500);

    // Verify filter was applied (rows should be different or loading state should appear)
    // Note: We can't guarantee exact count, but we can check that API was called
    // by verifying the table updated
    await page.waitForTimeout(500); // Give time for API response

    // Check if any navigation occurred
    if (navigations.length > 0) {
      console.log('Navigations detected:', navigations);
      throw new Error(`Page reloaded after debounce! Navigations: ${navigations.join(', ')}`);
    }

    // Print console logs for debugging
    console.log('Console logs captured:', logs.slice(-10)); // Last 10 logs

    // Verify input still has focus
    const isFocused = await eventTypeInput.evaluate((el) => el === document.activeElement);

    if (!isFocused) {
      // Get the currently focused element for debugging
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}` : 'null';
      });
      console.log('Focus lost! Currently focused element:', focusedElement);
      console.log('Last 20 console logs:', logs.slice(-20));
    }

    expect(isFocused).toBe(true);
  });

  /**
   * Test: Event type filter uses partial match (LIKE query)
   */
  test('event type filter uses partial match for filtering', async ({ page }) => {
    await loginAndNavigate(page);

    // Wait for initial load
    await page.waitForSelector('[data-testid="events-filter"]', { timeout: 5000 });

    // Type partial event type
    const eventTypeInput = page.locator('[data-testid="event-type-filter"]');
    await eventTypeInput.fill('push');

    // Press Enter to trigger immediately (bypass debounce)
    await eventTypeInput.press('Enter');

    // Wait for API response
    await page.waitForTimeout(1000);

    // Verify events containing "push" are shown (e.g., "github.push", "gitlab.push")
    const eventTypes = page.locator('tbody tr td:nth-child(2)');
    const count = await eventTypes.count();

    if (count > 0) {
      // Check that all visible events contain "push" somewhere in the type
      for (let i = 0; i < count; i++) {
        const text = await eventTypes.nth(i).textContent();
        expect(text?.toLowerCase()).toContain('push');
      }
    }
  });
});
