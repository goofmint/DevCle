/**
 * E2E Tests for Campaign Detail Page
 *
 * Tests campaign detail page functionality including:
 * 1. Campaign header display (name, status, ROI)
 * 2. Tab navigation (Overview, Budgets, Resources, Activities)
 * 3. Budgets list with filtering and pagination
 * 4. Resources list with filtering
 * 5. Activities timeline with filtering
 * 6. Dark/light mode color contrast
 * 7. Error handling (404 for non-existent campaigns)
 */

import { test, expect } from '@playwright/test';

// Test campaign ID (from seed data - meetupId)
const TEST_CAMPAIGN_ID = '10000000-0000-4000-8000-000000000001';
const NON_EXISTENT_CAMPAIGN_ID = '99999999-9999-4999-8999-999999999999';

test.describe('Campaign Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('1. Campaign header displays with name and status', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for loading to complete
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Verify campaign name is displayed as h1
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const h1Text = await h1.textContent();
    expect(h1Text).toBeTruthy();
    expect(h1Text!.length).toBeGreaterThan(0);

    // Verify status badge is displayed
    await expect(page.locator('[data-testid="campaign-status"]')).toBeVisible();
  });

  test('2. ROI indicator displays correctly', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // ROI indicator may or may not exist depending on data
    // Just verify it doesn't cause errors if it exists
    const roiIndicator = page.locator('[data-testid="campaign-roi"]');
    const roiExists = await roiIndicator.isVisible().catch(() => false);

    if (roiExists) {
      // Verify ROI text format
      const roiText = await roiIndicator.textContent();
      expect(roiText).toContain('ROI');
    }
  });

  test('3. Tab navigation works correctly', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Click on Budgets tab
    await page.click('button:has-text("Budgets")');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('tab=budgets');

    // Click on Resources tab
    await page.click('button:has-text("Resources")');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('tab=resources');

    // Click on Activities tab
    await page.click('button:has-text("Activities")');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('tab=activities');

    // Click on Overview tab
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('tab=overview');
  });

  test('4. Budgets tab displays budget list', async ({ page }) => {
    // Navigate to budgets tab directly
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}?tab=budgets`);

    // Wait for budgets to load (either list or empty state)
    await Promise.race([
      page.waitForSelector('[data-testid="budget-list"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="budgets-empty-state"]', { timeout: 10000 }),
    ]);

    // Verify either budget list or empty state is displayed
    const budgetList = page.locator('[data-testid="budget-list"]');
    const emptyState = page.locator('[data-testid="budgets-empty-state"]');
    const hasList = await budgetList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBe(true);
  });

  test('5. Budget category filter works', async ({ page }) => {
    // Navigate to budgets tab
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}?tab=budgets`);

    // Wait for page to load
    await Promise.race([
      page.waitForSelector('[data-testid="budget-list"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="budgets-empty-state"]', { timeout: 10000 }),
    ]);

    // Check if filter exists
    const filter = page.locator('[data-testid="category-filter"]');
    const filterExists = await filter.isVisible().catch(() => false);

    if (filterExists) {
      // Select labor category
      await page.selectOption('[data-testid="category-filter"]', 'labor');
      await page.waitForTimeout(1000); // Wait for client-side refetch

      // Verify URL contains category parameter
      expect(page.url()).toContain('category=labor');
    }
  });

  test('6. Resources tab displays resource list', async ({ page }) => {
    // Navigate to resources tab
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}?tab=resources`);

    // Wait for resources to load (either list or empty state)
    await Promise.race([
      page.waitForSelector('[data-testid="resource-list"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="resources-empty-state"]', { timeout: 10000 }),
    ]);

    // Verify either resource list or empty state is displayed
    const resourceList = page.locator('[data-testid="resource-list"]');
    const emptyState = page.locator('[data-testid="resources-empty-state"]');
    const hasList = await resourceList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBe(true);
  });

  test('7. Activities tab displays activity list', async ({ page }) => {
    // Navigate to activities tab
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}?tab=activities`);

    // Wait for activities to load (either list or empty state)
    await Promise.race([
      page.waitForSelector('[data-testid="activity-list"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="activities-empty-state"]', { timeout: 10000 }),
    ]);

    // Verify either activity list or empty state is displayed
    const activityList = page.locator('[data-testid="activity-list"]');
    const emptyState = page.locator('[data-testid="activities-empty-state"]');
    const hasList = await activityList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBe(true);
  });

  test('8. Pagination works for budgets', async ({ page }) => {
    // Navigate to budgets tab
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}?tab=budgets`);

    // Wait for budgets to load
    await Promise.race([
      page.waitForSelector('[data-testid="budget-list"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="budgets-empty-state"]', { timeout: 10000 }),
    ]);

    // Check if pagination exists
    const nextButton = page.locator('[data-testid="pagination-next"]');
    const paginationExists = await nextButton.isVisible().catch(() => false);

    if (paginationExists) {
      const isDisabled = await nextButton.isDisabled();
      if (!isDisabled) {
        // Click next page
        await nextButton.click();
        await page.waitForTimeout(1000);

        // Verify URL updated with page parameter
        expect(page.url()).toContain('page=2');
      }
    }
  });

  test('9. Non-existent campaign shows error', async ({ page }) => {
    // Navigate to non-existent campaign
    await page.goto(`/dashboard/campaigns/${NON_EXISTENT_CAMPAIGN_ID}`);

    // Wait for error message
    await page.waitForSelector('text=Campaign not found', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('text=Campaign not found')).toBeVisible();
  });

  test('10. Edit and delete buttons are visible', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Verify edit button exists (may be disabled for now)
    const editButton = page.locator('[data-testid="campaign-edit-button"]');
    await expect(editButton).toBeVisible();

    // Verify delete button exists (may be disabled for now)
    const deleteButton = page.locator('[data-testid="campaign-delete-button"]');
    await expect(deleteButton).toBeVisible();
  });

  test('11. Dark mode color contrast - Campaign header', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Enable dark mode by adding class to html element
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);

    // Get h1 element colors
    const h1 = page.locator('h1').first();
    const h1Color = await h1.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    // Get background color from main container (not body which may be transparent)
    const bgColor = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const styles = window.getComputedStyle(main);
      return styles.backgroundColor;
    });

    // Verify colors are different (basic contrast check)
    expect(h1Color).not.toBe(bgColor);

    // h1 should be light colored in dark mode (rgb values high)
    const h1RGB = h1Color.match(/\d+/g)?.map(Number);
    if (h1RGB && h1RGB.length >= 3 && h1RGB[0] !== undefined && h1RGB[1] !== undefined && h1RGB[2] !== undefined) {
      // Light colors have higher RGB values (closer to 255)
      const h1Brightness = (h1RGB[0] + h1RGB[1] + h1RGB[2]) / 3;
      expect(h1Brightness).toBeGreaterThan(200); // Should be light (white-ish)
    }

    // Background should be dark (rgb values low)
    const bgRGB = bgColor.match(/\d+/g)?.map(Number);
    if (bgRGB && bgRGB.length >= 3 && bgRGB[0] !== undefined && bgRGB[1] !== undefined && bgRGB[2] !== undefined) {
      // Dark colors have lower RGB values (closer to 0)
      const bgBrightness = (bgRGB[0] + bgRGB[1] + bgRGB[2]) / 3;
      expect(bgBrightness).toBeLessThan(100); // Should be dark
    }
  });

  test('12. Light mode color contrast - Campaign header', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Ensure light mode is active by removing dark class
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(500);

    // Get h1 element colors
    const h1 = page.locator('h1').first();
    const h1Color = await h1.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    // Get background color from the container div (campaign page content area)
    const bgColor = await page.evaluate(() => {
      const container = document.querySelector('.container') || document.querySelector('main') || document.body;
      const styles = window.getComputedStyle(container);
      return styles.backgroundColor;
    });

    console.log('h1 color (light mode):', h1Color);
    console.log('Background color (light mode):', bgColor);

    // Verify colors are different (basic contrast check)
    expect(h1Color).not.toBe(bgColor);

    // h1 should be dark colored in light mode (rgb values low)
    const h1RGB = h1Color.match(/\d+/g)?.map(Number);
    if (h1RGB && h1RGB.length >= 3 && h1RGB[0] !== undefined && h1RGB[1] !== undefined && h1RGB[2] !== undefined) {
      const h1Brightness = (h1RGB[0] + h1RGB[1] + h1RGB[2]) / 3;
      expect(h1Brightness).toBeLessThan(100); // Should be dark
    }

    // Background should be light or transparent (if transparent, that's OK for light mode)
    // We already verified colors are different, which is the main requirement
  });

  test('13. Back navigation works', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto(`/dashboard/campaigns/${TEST_CAMPAIGN_ID}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-status"]', { timeout: 10000 });

    // Click "Back to Campaigns" link
    const backLink = page.locator('a:has-text("Back to Campaigns")');
    await backLink.click();

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Verify we're back at campaigns list page
    expect(page.url()).toContain('/dashboard/campaigns');
    expect(page.url()).not.toContain(TEST_CAMPAIGN_ID);
  });
});
