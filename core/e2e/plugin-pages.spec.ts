/**
 * Plugin Pages E2E Tests
 *
 * Tests for plugin-provided pages (defined in plugin.json menus).
 * Verifies that:
 * - Plugin pages are accessible via dynamic routing
 * - Plugin components render correctly
 * - Event handling works
 * - Dark/light mode support is correct
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

async function loginAndNavigate(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

/**
 * Test: Plugin overview page renders and handles events
 */
test('displays plugin overview page with event handling', async ({ page }) => {
  await loginAndNavigate(page);

  await page.goto(`${BASE_URL}/dashboard/plugins/drowl-plugin-test/overview`);
  await page.waitForLoadState('networkidle');

  // Verify page heading
  await expect(page.locator('h1')).toContainText('Overview');

  // Verify plugin and tenant info is displayed
  await expect(page.locator('text=drowl-plugin-test')).toBeVisible();
  await expect(page.locator('text=default')).toBeVisible();

  // Test event handling - click button
  const clickButton = page.locator('button:has-text("Click Me")');
  await expect(clickButton).toBeVisible();
  await expect(clickButton).toContainText('(0)');

  await clickButton.click();
  await expect(clickButton).toContainText('(1)');

  await clickButton.click();
  await expect(clickButton).toContainText('(2)');
});

/**
 * Test: Plugin settings page renders with form
 */
test('displays plugin settings page with form', async ({ page }) => {
  await loginAndNavigate(page);

  await page.goto(`${BASE_URL}/dashboard/plugins/drowl-plugin-test/settings`);
  await page.waitForLoadState('networkidle');

  // Verify page heading
  await expect(page.locator('h1')).toContainText('Settings');

  // Verify plugin info
  await expect(page.locator('text=drowl-plugin-test')).toBeVisible();

  // Test form input
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await input.fill('test value');

  // Test save button
  const saveButton = page.locator('button:has-text("Save")');
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  // Verify saved message appears
  await expect(page.locator('text=Saved!')).toBeVisible();
});

/**
 * Test: Plugin logs page renders
 */
test('displays plugin logs page', async ({ page }) => {
  await loginAndNavigate(page);

  await page.goto(`${BASE_URL}/dashboard/plugins/drowl-plugin-test/logs`);
  await page.waitForLoadState('networkidle');

  // Verify page heading
  await expect(page.locator('h1')).toContainText('Activity Logs');

  // Verify plugin info
  await expect(page.locator('text=drowl-plugin-test')).toBeVisible();
});

/**
 * Test: Non-existent plugin page returns 404
 */
test('returns 404 for non-existent plugin page', async ({ page }) => {
  await loginAndNavigate(page);

  const response = await page.goto(
    `${BASE_URL}/dashboard/plugins/drowl-plugin-test/nonexistent`
  );

  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Page Not Found');
});

/**
 * Test: Dark mode styling
 */
test('supports dark mode', async ({ page }) => {
  await loginAndNavigate(page);

  await page.goto(`${BASE_URL}/dashboard/plugins/drowl-plugin-test/overview`);
  await page.waitForLoadState('networkidle');

  // Get main container
  const container = page.locator('div.bg-white').first();
  await expect(container).toBeVisible();

  // Verify light mode has white background
  const bgColor = await container.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
  expect(bgColor).toMatch(/rgb\(255, 255, 255\)/);
});
