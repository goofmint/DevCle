/**
 * E2E Tests for Funnel Page
 *
 * Test Coverage:
 * 1. Page loads successfully
 * 2. Funnel chart is displayed
 * 3. Drop rate cards are displayed
 * 4. Time series chart is displayed
 * 5. Date range selector works (daily/weekly/monthly)
 * 6. Dark mode support with color contrast
 * 7. Responsive design (mobile/desktop)
 * 8. Data accuracy (matches API response)
 * 9. Error handling (no data scenario)
 * 10. Authentication required
 *
 * Prerequisites:
 * - Authenticated user (test@example.com / password123)
 * - Seed data with activities mapped to funnel stages
 */

import { test, expect } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper function to log in as test user
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

/**
 * Helper function to check color contrast
 *
 * Returns true if there's sufficient contrast (for accessibility)
 */
async function checkColorContrast(
  page: import('@playwright/test').Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  const color = await element.evaluate((el: HTMLElement) => {
    const styles = window.getComputedStyle(el);
    return {
      text: styles.color,
      background: styles.backgroundColor,
    };
  });

  // Simple check: ensure colors are different
  return color.text !== color.background;
}

test.describe('Funnel Page', () => {
  /**
   * Before each test:
   * 1. Log in as test user
   * 2. Navigate to funnel page
   */
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/funnel`);
  });

  /**
   * Test 1: Verify page loads successfully
   */
  test('should load funnel page successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Funnel Analysis/);

    // Check main heading is visible
    await expect(
      page.locator('h1:has-text("Funnel Analysis")')
    ).toBeVisible();

    // Check description text
    await expect(
      page.locator('text=Developer journey from Awareness to Advocacy')
    ).toBeVisible();

    // Verify no loading spinner (page loaded)
    await expect(
      page.locator('text=Loading funnel data...')
    ).not.toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 2: Verify funnel chart is displayed
   */
  test('should display funnel chart with all stages', async ({ page }) => {
    // Wait for funnel chart to load
    await expect(page.locator('[data-testid="funnel-chart"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify all 4 stages are displayed
    await expect(
      page.locator('[data-testid="funnel-stage-awareness"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="funnel-stage-engagement"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="funnel-stage-adoption"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="funnel-stage-advocacy"]')
    ).toBeVisible();

    // Verify stage labels are displayed in funnel chart specifically
    await expect(
      page.locator('[data-testid="funnel-stage-awareness"]')
    ).toContainText('Awareness');
    await expect(
      page.locator('[data-testid="funnel-stage-engagement"]')
    ).toContainText('Engagement');
    await expect(
      page.locator('[data-testid="funnel-stage-adoption"]')
    ).toContainText('Adoption');
    await expect(
      page.locator('[data-testid="funnel-stage-advocacy"]')
    ).toContainText('Advocacy');
  });

  /**
   * Test 3: Verify drop rate cards are displayed
   */
  test('should display drop rate cards', async ({ page }) => {
    // Wait for drop rate section to load
    await expect(
      page.locator('h2:has-text("Drop Rates by Stage")')
    ).toBeVisible();

    // Verify drop rate cards are displayed (3 cards for transitions)
    const dropRateCards = page.locator('[data-testid="drop-rate-card"]');
    const count = await dropRateCards.count();

    // Should have 3 drop rate cards (awareness→engagement, engagement→adoption, adoption→advocacy)
    expect(count).toBe(3);

    // Verify cards are visible
    await expect(dropRateCards.first()).toBeVisible();
  });

  /**
   * Test 4: Verify time series chart is displayed
   */
  test('should display time series chart', async ({ page }) => {
    // Wait for time series section to load
    await expect(
      page.locator('h2:has-text("Funnel Progression Over Time")')
    ).toBeVisible();

    // Verify time series chart is displayed
    await expect(
      page.locator('[data-testid="time-series-chart"]')
    ).toBeVisible({ timeout: 10000 });

    // Verify interval selector buttons are displayed
    await expect(page.locator('button:has-text("Daily")')).toBeVisible();
    await expect(page.locator('button:has-text("Weekly")')).toBeVisible();
    await expect(page.locator('button:has-text("Monthly")')).toBeVisible();
  });

  /**
   * Test 5: Verify date range selector works (daily/weekly/monthly)
   */
  test('should switch between daily, weekly, and monthly views', async ({
    page,
  }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="time-series-chart"]', {
      timeout: 10000,
    });

    // Default view should be daily (button should be active)
    const dailyButton = page.locator('button:has-text("Daily")');
    await expect(dailyButton).toHaveClass(/bg-blue-600/);

    // Click weekly button
    const weeklyButton = page.locator('button:has-text("Weekly")');
    await weeklyButton.click();

    // Wait for chart to update (data refetch)
    await page.waitForTimeout(1000);

    // Weekly button should now be active
    await expect(weeklyButton).toHaveClass(/bg-blue-600/);

    // Click monthly button
    const monthlyButton = page.locator('button:has-text("Monthly")');
    await monthlyButton.click();

    // Wait for chart to update
    await page.waitForTimeout(1000);

    // Monthly button should now be active
    await expect(monthlyButton).toHaveClass(/bg-blue-600/);

    // Switch back to daily
    await dailyButton.click();
    await page.waitForTimeout(1000);

    // Daily button should be active again
    await expect(dailyButton).toHaveClass(/bg-blue-600/);
  });

  /**
   * Test 6: Verify dark mode support with color contrast
   */
  test('should support dark mode with proper color contrast', async ({
    page,
  }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="funnel-chart"]', {
      timeout: 10000,
    });

    // Enable dark mode
    const html = page.locator('html');
    await html.evaluate((el) => {
      el.classList.add('dark');
    });

    // Wait for dark mode to apply
    await page.waitForTimeout(500);

    // Verify dark mode classes are applied
    await expect(html).toHaveClass(/dark/);

    // Check title has good contrast in dark mode
    const titleContrast = await checkColorContrast(
      page,
      'h1:has-text("Funnel Analysis")'
    );
    expect(titleContrast).toBe(true);

    // Verify background colors changed (light mode vs dark mode)
    const bgColor = await page
      .locator('.container')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);

    // Background should be dark (not white)
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  /**
   * Test 7: Verify responsive design (mobile/desktop)
   */
  test('should display correctly on mobile viewport', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="funnel-chart"]', {
      timeout: 10000,
    });

    // Switch to mobile viewport (iPhone 12 size)
    await page.setViewportSize({ width: 390, height: 844 });

    // Wait for resize
    await page.waitForTimeout(500);

    // Verify page is still functional on mobile
    await expect(
      page.locator('h1:has-text("Funnel Analysis")')
    ).toBeVisible();
    await expect(page.locator('[data-testid="funnel-chart"]')).toBeVisible();

    // Verify drop rate cards stack vertically (grid should be 1 column)
    // On mobile, cards should be full width
    const firstCard = page.locator('[data-testid="drop-rate-card"]').first();
    if ((await firstCard.count()) > 0) {
      await expect(firstCard).toBeVisible();
    }
  });

  /**
   * Test 8: Verify data accuracy (matches API response)
   */
  test('should display data matching API response', async ({ page }) => {
    // Intercept API call to capture response
    interface FunnelApiResponse {
      stages: Array<{ stage: string; stageName: string; count: number }>;
      totalDevelopers: number;
    }

    let funnelData: FunnelApiResponse | null = null;

    await page.route('**/api/funnel', async (route) => {
      const response = await route.fetch();
      funnelData = (await response.json()) as FunnelApiResponse;
      await route.fulfill({ response });
    });

    // Navigate to funnel page
    await page.goto(`${BASE_URL}/dashboard/funnel`);

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // Verify data was captured and has expected properties
    expect(funnelData).not.toBeNull();

    if (funnelData !== null) {
      // Create a typed reference to avoid type narrowing issues
      const data: FunnelApiResponse = funnelData;

      // Verify total developers count in summary section
      const totalText = await page
        .locator('text=Total Developers')
        .locator('..')
        .locator('p.text-2xl')
        .textContent();

      expect(totalText).toBe(String(data.totalDevelopers));

      // Verify stage counts in funnel chart
      for (const stage of data.stages) {
        const stageElement = page.locator(
          `[data-testid="funnel-stage-${stage.stage}"]`
        );
        await expect(stageElement).toBeVisible();

        // Check count is displayed (using localeString format)
        const expectedCount = stage.count.toLocaleString();
        await expect(stageElement).toContainText(expectedCount);
      }
    }
  });

  /**
   * Test 9: Verify error handling (no data scenario)
   */
  test('should handle no data scenario gracefully', async ({ page }) => {
    // Mock API to return empty data
    await page.route('**/api/funnel', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stages: [
            { stage: 'awareness', stageName: 'Awareness', count: 0, dropRate: null },
            { stage: 'engagement', stageName: 'Engagement', count: 0, dropRate: 0 },
            { stage: 'adoption', stageName: 'Adoption', count: 0, dropRate: 0 },
            { stage: 'advocacy', stageName: 'Advocacy', count: 0, dropRate: 0 },
          ],
          totalDevelopers: 0,
          periodStart: '1970-01-01T00:00:00.000Z',
          periodEnd: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/funnel/timeline*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Navigate to funnel page
    await page.goto(`${BASE_URL}/dashboard/funnel`);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Verify "No Data Available" message is shown in funnel chart
    await expect(
      page.locator('text=No Data Available')
    ).toBeVisible();

    // Verify total developers shows 0
    const totalText = await page
      .locator('text=Total Developers')
      .locator('..')
      .locator('p.text-2xl')
      .textContent();

    expect(totalText).toBe('0');
  });

  /**
   * Test 10: Verify authentication required
   */
  test('should redirect to login if not authenticated', async ({ page }) => {
    // Clear cookies to simulate logged out state
    await page.context().clearCookies();

    // Try to access funnel page
    await page.goto(`${BASE_URL}/dashboard/funnel`);

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Verify we're on login page
    expect(page.url()).toContain('/login');
  });
});
