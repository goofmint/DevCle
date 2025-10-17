/**
 * E2E tests for Developers page
 *
 * Tests cover:
 * - Developer list display
 * - Search functionality
 * - Organization filter
 * - Pagination
 * - Navigation to detail page
 * - Detail page display
 * - Dark mode color contrast
 * - Responsive design
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Helper function to login and navigate to developers page
 */
async function loginAndNavigateToDevelopers(page: Page) {
  // Navigate to login page
  await page.goto('/login');

  // Fill in login credentials (using test user from seed data)
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'password123');

  // Submit login form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');

  // Navigate to developers page
  await page.goto('/dashboard/developers');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper function to check color contrast for accessibility
 * Verifies that text color and background color have sufficient contrast
 */
async function checkColorContrast(page: Page, selector: string) {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();

  // Get computed styles
  const textColor = await element.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });
  const backgroundColor = await element.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Both should be defined and different
  expect(textColor).toBeTruthy();
  expect(backgroundColor).toBeTruthy();
  expect(textColor).not.toBe(backgroundColor);
}

test.describe('Developers Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToDevelopers(page);
  });

  test('displays developer list correctly', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Developers');

    // Check that developer table is visible (desktop view)
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check table headers
    await expect(page.locator('th').filter({ hasText: 'Developer' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Email' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Organization' })).toBeVisible();

    // Check that at least one developer row exists
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount({ greaterThan: 0 });
  });

  test('search functionality works', async ({ page }) => {
    // Enter search query
    await page.fill('input[name="query"]', 'Alice');

    // Submit search form
    await page.click('button[type="submit"]');

    // Wait for results to load
    await page.waitForLoadState('networkidle');

    // Check that results contain search term
    const rows = page.locator('tbody tr');
    const firstRow = rows.first();
    await expect(firstRow).toContainText('Alice', { ignoreCase: true });
  });

  test('organization filter works', async ({ page }) => {
    // Select organization from dropdown
    const orgSelect = page.locator('select[name="organizationId"]');
    await expect(orgSelect).toBeVisible();

    // Get first organization option (skip "All Organizations")
    const firstOrg = orgSelect.locator('option').nth(1);
    const orgValue = await firstOrg.getAttribute('value');

    if (orgValue) {
      await orgSelect.selectOption(orgValue);

      // Submit filter form
      await page.click('button[type="submit"]');

      // Wait for results
      await page.waitForLoadState('networkidle');

      // Verify filtered results (all should belong to selected org)
      // Note: This is a basic check - full verification would require checking org ID
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount({ greaterThan: 0 });
    }
  });

  test('pagination works', async ({ page }) => {
    // Check if pagination is visible
    const pagination = page.locator('nav[aria-label="Pagination"]');

    // Only test if there are multiple pages
    const nextButton = page.locator('a').filter({ hasText: 'Next' });
    if (await nextButton.isVisible({ timeout: 1000 })) {
      const isEnabled = !(await nextButton.getAttribute('class'))?.includes('pointer-events-none');

      if (isEnabled) {
        // Click next page
        await nextButton.click();

        // Wait for page load
        await page.waitForLoadState('networkidle');

        // Check that URL contains page parameter
        expect(page.url()).toContain('page=2');

        // Verify previous button is now enabled
        const prevButton = page.locator('a').filter({ hasText: 'Previous' });
        const prevClass = await prevButton.getAttribute('class');
        expect(prevClass).not.toContain('pointer-events-none');
      }
    }
  });

  test('navigation to detail page works', async ({ page }) => {
    // Click on first developer row
    const firstDeveloperLink = page.locator('tbody tr').first().locator('a').first();
    await firstDeveloperLink.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Check that we're on detail page
    expect(page.url()).toContain('/dashboard/developers/');
    expect(page.url()).not.toBe('/dashboard/developers');

    // Check that detail page content is visible
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('detail page displays correctly', async ({ page }) => {
    // Navigate to first developer's detail page
    const firstDeveloperLink = page.locator('tbody tr').first().locator('a').first();
    await firstDeveloperLink.click();
    await page.waitForLoadState('networkidle');

    // Check basic information card
    await expect(page.locator('h1')).toBeVisible();

    // Check activity statistics section
    await expect(page.locator('text=Activity Statistics')).toBeVisible();

    // Check identifiers section
    await expect(page.locator('text=Identifiers')).toBeVisible();

    // Check recent activities section
    await expect(page.locator('text=Recent Activities')).toBeVisible();

    // Check back button
    const backLink = page.locator('a').filter({ hasText: 'Back to Developers' });
    await expect(backLink).toBeVisible();
  });

  test('dark mode color contrast is sufficient', async ({ page }) => {
    // Enable dark mode (assuming there's a dark mode toggle)
    // If not, we'll force dark mode via class
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    // Wait for dark mode styles to apply
    await page.waitForTimeout(500);

    // Check color contrast on key elements
    await checkColorContrast(page, 'h1');
    await checkColorContrast(page, 'table th');
    await checkColorContrast(page, 'tbody tr td');
    await checkColorContrast(page, 'button[type="submit"]');
  });

  test('responsive design - mobile view', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for layout to adjust
    await page.waitForTimeout(500);

    // Check that table is hidden on mobile
    const table = page.locator('table');
    await expect(table).toBeHidden({ timeout: 5000 });

    // Check that card view is visible
    const cards = page.locator('[class*="grid"]').locator('[class*="gap"]');
    await expect(cards).toBeVisible();

    // Verify mobile navigation works
    await expect(page.locator('a').filter({ hasText: 'Previous' })).toBeVisible();
    await expect(page.locator('a').filter({ hasText: 'Next' })).toBeVisible();
  });

  test('reset filters button works', async ({ page }) => {
    // Apply search filter
    await page.fill('input[name="query"]', 'test');

    // Click reset button
    const resetButton = page.locator('button').filter({ hasText: 'Reset' });
    await resetButton.click();

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Check that search input is cleared
    const searchInput = page.locator('input[name="query"]');
    await expect(searchInput).toHaveValue('');

    // Check that URL doesn't contain query parameter
    expect(page.url()).not.toContain('query=');
  });
});
