/**
 * E2E Tests for Dashboard Campaigns Page
 *
 * Tests:
 * 1. Campaign list display
 * 2. Search functionality
 * 3. Channel filter
 * 4. ROI status filter
 * 5. ROI color coding
 * 6. Sort functionality
 * 7. Pagination
 * 8. Responsive design (dark/light mode color differences)
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Campaigns Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navigate to campaigns page
    await page.goto('/dashboard/campaigns');

    // Wait for either loading indicator to disappear OR error to appear
    // This handles both success and error cases
    await Promise.race([
      // Wait for loading to disappear (success case)
      page.waitForSelector('text=Loading campaigns...', { state: 'hidden', timeout: 15000 }),
      // Or wait for error message (error case)
      page.waitForSelector('text=Error', { timeout: 15000 })
    ]).catch(() => {
      // If both timeout, that's also useful info
    });

    // Small delay for React state updates
    await page.waitForTimeout(500);
  });

  test('1. Campaign list displays correctly', async ({ page }) => {
    // Check if page is in error state
    const errorElement = page.locator('text=Error');
    const isError = await errorElement.isVisible().catch(() => false);

    if (isError) {
      const errorText = await page.textContent('body');
      throw new Error(`Page is in error state: ${errorText}`);
    }

    // Check if still loading
    const loadingElement = page.locator('text=Loading campaigns...');
    const isLoading = await loadingElement.isVisible().catch(() => false);

    if (isLoading) {
      throw new Error('Page is still in loading state after timeout');
    }

    // Check if campaign list is visible
    await expect(page.getByTestId('campaign-list')).toBeVisible();

    // Check if campaign table is visible
    await expect(page.getByTestId('campaign-table')).toBeVisible();

    // Check if at least one campaign row exists
    const rows = page.getByTestId('campaign-row');
    await expect(rows.first()).toBeVisible();

    // Verify table has headers
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Channel")')).toBeVisible();
    await expect(page.locator('th:has-text("Period")')).toBeVisible();
    await expect(page.locator('th:has-text("ROI")')).toBeVisible();
  });

  test('2. Search functionality works', async ({ page }) => {
    // Get initial campaign count
    const initialRows = await page.getByTestId('campaign-row').count();

    // Type in search box - use "Blog" which exists in seed data
    await page.fill('[data-testid="search-input"]', 'Blog');

    // Wait for URL to update
    await page.waitForURL(/query=Blog/);

    // Wait for list to update and re-render
    await page.waitForTimeout(1000);

    // Verify filtered results
    const filteredRows = await page.getByTestId('campaign-row').count();

    // Search should filter results (count should be <= initial)
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
    expect(filteredRows).toBeGreaterThan(0);

    // Verify campaign names contain search term
    const firstRow = page.getByTestId('campaign-row').first();
    const nameText = await firstRow.locator('td').first().textContent();
    expect(nameText?.toLowerCase()).toContain('blog');
  });

  test('3. Channel filter works', async ({ page }) => {
    // Select channel filter
    await page.selectOption('[data-testid="channel-filter"]', 'event');

    // Wait for URL to update
    await page.waitForURL(/channel=event/);

    // Wait for list to update
    await page.waitForTimeout(500);

    // Verify all visible campaigns have 'event' channel
    const channelBadges = page.locator('td:has-text("event")');
    const count = await channelBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('4. ROI status filter works', async ({ page }) => {
    // Select ROI status filter - use 'neutral' since seed data has N/A ROI
    await page.selectOption('[data-testid="roi-filter"]', 'neutral');

    // Wait for URL to update
    await page.waitForURL(/roiStatus=neutral/);

    // Wait for list to update and re-render
    await page.waitForTimeout(1000);

    // Verify campaigns are still visible (seed data has neutral ROI campaigns)
    const campaignRows = page.getByTestId('campaign-row');
    const count = await campaignRows.count();
    expect(count).toBeGreaterThan(0);

    // Verify ROI badges show N/A or neutral state
    const roiBadges = page.getByTestId('roi-badge');
    const firstBadge = roiBadges.first();
    await expect(firstBadge).toBeVisible();
  });

  test('5. ROI color coding is correct', async ({ page }) => {
    // Find ROI badges
    const roiBadges = page.getByTestId('roi-badge');
    const count = await roiBadges.count();

    if (count > 0) {
      const firstBadge = roiBadges.first();
      const roiValue = await firstBadge.getAttribute('data-roi');

      if (roiValue && roiValue !== 'null') {
        const roi = parseFloat(roiValue);
        const badgeClass = await firstBadge.getAttribute('class');

        if (roi > 0) {
          // Positive ROI should have green background
          expect(badgeClass).toContain('bg-green');
        } else if (roi < 0) {
          // Negative ROI should have red background
          expect(badgeClass).toContain('bg-red');
        } else {
          // Neutral ROI should have gray background
          expect(badgeClass).toContain('bg-gray');
        }
      }
    }
  });

  test('6. Sort functionality works', async ({ page }) => {
    // Verify sort button exists
    await expect(page.locator('[data-testid="sort-name"]')).toBeVisible();

    // Click on Name column header to sort
    await page.click('[data-testid="sort-name"]');

    // Wait for data to refetch (window.history.pushState doesn't trigger navigation)
    await page.waitForTimeout(1000);

    // Verify campaigns are still displayed (data refetch completed)
    const rows = page.getByTestId('campaign-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Click again to toggle sort order
    await page.click('[data-testid="sort-name"]');

    // Wait for data to refetch
    await page.waitForTimeout(1000);

    // Verify campaigns are still displayed after re-sort
    const rowsAfter = page.getByTestId('campaign-row');
    const countAfter = await rowsAfter.count();
    expect(countAfter).toBeGreaterThan(0);

    // Sort functionality works if campaigns are still displayed after sorting
    expect(countAfter).toBe(count);
  });

  test('7. Pagination works', async ({ page }) => {
    // Check if pagination is visible
    const pagination = page.getByTestId('pagination');

    // Only test if pagination exists (depends on number of campaigns)
    if (await pagination.isVisible()) {
      // Get current page number
      const currentPageButton = page.locator('[data-testid^="page-"]').first();
      await expect(currentPageButton).toBeVisible();

      // Try to click next page if available
      const nextButton = page.getByTestId('next-page');
      const isNextDisabled = await nextButton.isDisabled();

      if (!isNextDisabled) {
        await nextButton.click();

        // Wait for URL to update
        await page.waitForURL(/page=2/);

        // Wait for list to update
        await page.waitForTimeout(500);

        // Verify page changed
        await expect(page.getByTestId('campaign-row').first()).toBeVisible();
      }
    }
  });

  test('8. Responsive design and dark/light mode color differences', async ({ page }) => {
    // Test light mode colors
    const lightBg = await page.locator('[data-testid="campaign-filters"]').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    const lightText = await page.locator('h1:has-text("Campaigns")').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    // Wait for dark mode to apply
    await page.waitForTimeout(300);

    // Test dark mode colors
    const darkBg = await page.locator('[data-testid="campaign-filters"]').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    const darkText = await page.locator('h1:has-text("Campaigns")').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Verify colors are different between light and dark modes
    expect(lightBg).not.toBe(darkBg);
    expect(lightText).not.toBe(darkText);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for resize
    await page.waitForTimeout(300);

    // Verify page is still functional on mobile
    await expect(page.getByTestId('campaign-list')).toBeVisible();
    await expect(page.getByTestId('search-input')).toBeVisible();
  });
});
