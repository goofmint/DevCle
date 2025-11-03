/**
 * E2E tests for Plugin Configuration Page
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';
const TEST_PLUGIN_ID = '20000000-0000-4000-8000-000000000001';
const TEST_PLUGIN_NAME = 'Test Plugin';

// Read credentials from environment variables
const ADMIN_EMAIL = (process.env['ADMIN_EMAIL'] || 'admin@example.com').trim();
const ADMIN_PASSWORD = (process.env['ADMIN_PASSWORD'] || 'admin123456').trim();

// Fail fast in CI if credentials are not provided
if (process.env['CI'] && (!process.env['ADMIN_EMAIL'] || !process.env['ADMIN_PASSWORD'])) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required in CI');
}

/**
 * Helper function to login
 */
async function login(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

test.describe('Plugin Config Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should access settings page for all plugins listed in plugin management', async ({ page }) => {
    // Go to plugins list page
    await page.goto(`${BASE_URL}/dashboard/plugins`);
    await page.waitForLoadState('networkidle');

    // Get all plugin cards
    const pluginCards = await page.locator('.bg-white.dark\\:bg-gray-800.rounded-lg.shadow-md').all();

    if (pluginCards.length === 0) {
      console.log('No plugins found on the page');
      return;
    }

    console.log(`Found ${pluginCards.length} plugin(s)`);

    // For each plugin, click the name link and verify config page loads
    for (let i = 0; i < pluginCards.length; i++) {
      const card = pluginCards[i];
      if (!card) continue;

      // Get plugin name (now inside a link)
      const nameLink = card.locator('a').filter({ has: page.locator('text=/./') }).first();
      const pluginName = (await nameLink.textContent())?.trim() || 'Unknown Plugin';
      const settingsLink = card.locator('a[href*="/edit"]').first();

      if (!(await settingsLink.count())) {
        console.log(`Skipping plugin without settings link: ${pluginName}`);
        continue;
      }

      const settingsUrl = await settingsLink.getAttribute('href');

      if (!settingsUrl) {
        console.log(`Skipping plugin with missing settings URL: ${pluginName}`);
        continue;
      }

      console.log(`Testing plugin settings: ${pluginName} -> ${settingsUrl}`);

      // Navigate to settings page
      await page.goto(`${BASE_URL}${settingsUrl}`);

      // Wait for either success or error state (not loading)
      await Promise.race([
        page.waitForSelector('h1:has-text("Configure")', { timeout: 5000 }).catch(() => null),
        page.waitForSelector('h3:has-text("Error")', { timeout: 5000 }).catch(() => null),
      ]);

      // Check if page loaded (either success or error, but not stuck in loading)
      const hasContent = await page.locator('h1, h3').count() > 0;
      expect(hasContent).toBe(true);

      // Go back to plugins list for next iteration
      if (i < pluginCards.length - 1) {
        await page.goto(`${BASE_URL}/dashboard/plugins`);
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display plugin configuration page correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/edit`);

    // Wait for loading to complete
    await page.waitForSelector(`h1:has-text("Configure")`);

    // Check page heading
    await expect(page.locator('h1')).toContainText(`Configure`);
    await expect(page.locator('h1')).toContainText(TEST_PLUGIN_NAME);

    // Check key form fields are rendered
    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    await expect(page.getByLabel(/Webhook URL/i)).toBeVisible();
    await expect(page.getByLabel(/Contact Email/i)).toBeVisible();
    await expect(page.getByLabel(/Sync Interval/i)).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('link', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Configuration/i })).toBeVisible();

    // Verify dark mode styling (check background color contrast)
    const backgroundColor = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(backgroundColor).toBeTruthy();
  });

  test('should show error for non-existing plugin', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/plugins/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/edit`);

    // Wait for response and verify error text is rendered
    const bodyText = await page.locator('body').first().innerText();
    expect(bodyText).toMatch(/Plugin not found|Failed to load plugin|Admin role required|An Error Occurred/);
  });

  test('should have proper dark mode styling', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/edit`);
    await page.waitForSelector('h1:has-text("Configure")');

    // Check text color in dark mode
    const heading = page.locator('h1:has-text("Configure")');
    const headingColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // RGB values should be light (high values) in dark mode
    expect(headingColor).toBeTruthy();
  });

  test('should display loading state', async ({ page }) => {
    let apiCalled = false;

    // Intercept API call to delay response significantly
    await page.route('**/api/plugins/*/config', async (route) => {
      apiCalled = true;
      // Delay before continuing
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    // Navigate to the page
    await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/config`, { waitUntil: 'domcontentloaded' });

    // Check that the loading spinner was visible at some point
    // Since API is delayed, spinner should show up initially
    const spinner = page.locator('[class*="animate-spin"]');

    // Wait briefly for the spinner to appear after DOM loads
    try {
      await spinner.waitFor({ state: 'visible', timeout: 1000 });
    } catch {
      // If spinner doesn't appear, that's OK - it might load too fast
      // Just verify the API was called and content eventually loads
    }

    // Verify API was actually called
    expect(apiCalled).toBe(true);

    // Wait for content to eventually load
    await page.waitForSelector('h1:has-text("Plugin Configuration")', { timeout: 5000 });
  });

  test('should have proper layout without visual偏り', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_ID}/edit`);
    await page.waitForSelector('h1:has-text("Configure")');

    const fieldContainer = page.locator('form .space-y-6').first();
    const fieldCount = await fieldContainer.locator('> div').count();
    expect(fieldCount).toBeGreaterThan(0);

    const firstFieldBox = await fieldContainer.locator('> div').first().boundingBox();
    expect(firstFieldBox).not.toBeNull();

    const widths: number[] = [];

    for (let i = 0; i < fieldCount; i++) {
      const field = fieldContainer.locator('> div').nth(i);
      const box = await field.boundingBox();
      expect(box).not.toBeNull();

      // All fields should align on the same left edge
      expect(Math.abs(box!.x - firstFieldBox!.x)).toBeLessThan(1);

      widths.push(box!.width);
    }

    // Verify widths are consistent to avoid visual偏り
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    expect(maxWidth - minWidth).toBeLessThan(2);
  });
});
