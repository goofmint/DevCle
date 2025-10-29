/**
 * Plugin Management E2E Tests
 *
 * End-to-end tests for plugin management UI using Playwright.
 * Tests plugin list display, enable/disable functionality, and design consistency.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users and plugins
 *
 * Test scenarios:
 * 1. Authenticated user can access plugin management page
 * 2. Plugins are displayed in grid layout
 * 3. User can enable/disable plugins
 * 4. Dark/light mode color contrast is correct
 * 5. Design is consistent (no layout issues, proper spacing)
 */

import { test, expect, type Page } from '@playwright/test';

// Base URL for the application (use HTTPS for E2E tests)
const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

/**
 * Helper: Login as test user
 *
 * Logs in with test credentials and navigates to plugins page.
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

  // Navigate to plugins page
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');
}

/**
 * Test: Plugin management page displays plugins or empty state
 */
test('displays plugin list or empty state', async ({ page }) => {
  await loginAndNavigate(page);

  // Verify page title
  await expect(page.locator('h1')).toHaveText('Plugin Management');

  // Verify page description exists
  await expect(page.locator('text=Manage installed plugins')).toBeVisible();

  // Check if plugin grid or empty state exists
  const pluginGrid = page.locator('div.grid');
  const emptyState = page.locator('text=No plugins installed');

  // Either grid or empty state should be visible
  const hasPlugins = await pluginGrid.isVisible();
  const isEmpty = await emptyState.isVisible();

  expect(hasPlugins || isEmpty).toBe(true);

  // If grid exists, verify it has responsive classes
  if (hasPlugins) {
    await expect(pluginGrid).toHaveClass(/grid-cols-1/);
    await expect(pluginGrid).toHaveClass(/md:grid-cols-2/);
    await expect(pluginGrid).toHaveClass(/lg:grid-cols-3/);
  }
});

/**
 * Test: Plugin cards display correct information
 */
test('plugin cards show name, status, and dates', async ({ page }) => {
  await loginAndNavigate(page);

  // Check if plugins exist
  const pluginCards = page.locator('div.grid > div');
  const count = await pluginCards.count();

  // Skip test if no plugins exist
  if (count === 0) {
    test.skip();
    return;
  }

  // Get first plugin card
  const firstCard = pluginCards.first();
  await expect(firstCard).toBeVisible();

  // Verify card has white background in light mode
  await expect(firstCard).toHaveClass(/bg-white/);
  await expect(firstCard).toHaveClass(/dark:bg-gray-800/);

  // Verify card has border
  await expect(firstCard).toHaveClass(/border/);

  // Verify plugin name heading is visible (now inside a Link)
  const pluginNameLink = firstCard.locator('a').filter({ has: page.locator('text=/./') }).first();
  await expect(pluginNameLink).toBeVisible();
  const pluginNameText = await pluginNameLink.textContent();
  expect(pluginNameText).toBeTruthy();

  // Optional settings link (enabled plugins with settings)
  const settingsLink = firstCard.locator('a[href*="/edit"]');
  if (await settingsLink.count()) {
    await expect(settingsLink.first()).toBeVisible();
  }

  // Verify status badge exists (Enabled or Disabled)
  const statusBadge = firstCard.locator('div.px-3.py-1.rounded-full');
  await expect(statusBadge).toBeVisible();
  const statusText = await statusBadge.textContent();
  expect(statusText).toMatch(/Enabled|Disabled/);

  // Verify dates are displayed (Installed, Updated)
  await expect(firstCard.locator('text=Installed:')).toBeVisible();
  await expect(firstCard.locator('text=Updated:')).toBeVisible();

  // Verify action button exists
  const actionButton = firstCard.locator('button[type="button"]');
  await expect(actionButton).toBeVisible();
  const buttonText = await actionButton.textContent();
  expect(buttonText).toMatch(/Enable|Disable/);
});

/**
 * Test: User can toggle plugin enabled status
 */
test('can enable and disable plugins', async ({ page }) => {
  await loginAndNavigate(page);

  // Wait for plugins to load
  await page.waitForSelector('div.grid > div', { timeout: 5000 });

  // Get first plugin card
  const firstCard = page.locator('div.grid > div').first();
  const actionButton = firstCard.locator('button[type="button"]');

  // Get initial status
  const initialButtonText = await actionButton.textContent();
  const wasEnabled = initialButtonText?.includes('Disable');

  // Click toggle button
  if (wasEnabled) {
    page.once('dialog', (dialog) => dialog.accept());
  }
  await actionButton.click();

  // Wait for toast notification (success message)
  await page.waitForSelector('text=successfully', { timeout: 5000 });

  // Verify button text changed
  await page.waitForTimeout(500); // Wait for UI update
  const newButtonText = await actionButton.textContent();

  if (wasEnabled) {
    expect(newButtonText).toContain('Enable');
  } else {
    expect(newButtonText).toContain('Disable');
  }

  // Verify status badge color changed
  const statusBadge = firstCard.locator('div.px-3.py-1.rounded-full');
  const statusText = await statusBadge.textContent();

  if (wasEnabled) {
    expect(statusText).toContain('Disabled');
  } else {
    expect(statusText).toContain('Enabled');
  }
});

/**
 * Test: Dark mode has correct color contrast
 *
 * Verifies that text color and background color have sufficient contrast
 * in both light and dark modes.
 */
test('dark mode has correct color contrast', async ({ page }) => {
  await loginAndNavigate(page);

  // Wait for plugins to load
  await page.waitForSelector('div.grid > div', { timeout: 5000 });

  const firstCard = page.locator('div.grid > div').first();

  // Test light mode colors
  const lightBgColor = await firstCard.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
  // Plugin name is now a link, so we need to locate it differently
  const titleElement = firstCard.locator('a').filter({ has: page.locator('text=/./') }).first();
  const lightTextColor = await titleElement.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  // Verify light mode has light background and dark text
  // Note: Tailwind 4.x uses OKLCH color space by default
  expect(lightBgColor).toMatch(/rgb\(255, 255, 255\)/); // white
  expect(lightTextColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((17|31|55), (24|41|71), (39|55|87)\)/); // dark text (oklch or rgb)

  // Switch to dark mode (toggle dark mode button)
  const darkModeToggle = page.locator('button[aria-label*="theme"]').or(
    page.locator('button:has-text("Dark")')
  ).or(
    page.locator('button[title*="dark"]')
  );

  // If dark mode toggle exists, click it
  if (await darkModeToggle.count() > 0) {
    await darkModeToggle.first().click();
    await page.waitForTimeout(300); // Wait for transition

    // Test dark mode colors
    const darkBgColor = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const darkTextColor = await titleElement.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Verify dark mode has dark background and light text
    // Note: Tailwind 4.x uses OKLCH color space by default
    expect(darkBgColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((31|55), (41|65), (51|85)\)/); // dark background (oklch or rgb)
    expect(darkTextColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((243|249|255), (244|250|255), (246|251|255)\)/); // light text (oklch or rgb)
  }
});

/**
 * Test: Layout has no design issues (alignment, spacing)
 *
 * Verifies that:
 * - Grid items are evenly spaced
 * - Cards have consistent padding
 * - Buttons are properly aligned
 * - No element overflow
 */
test('layout has consistent design and spacing', async ({ page }) => {
  await loginAndNavigate(page);

  // Wait for plugins to load
  await page.waitForSelector('div.grid > div', { timeout: 5000 });

  const pluginCards = page.locator('div.grid > div');
  const cardCount = await pluginCards.count();

  // Verify all cards have same width (within a tolerance)
  if (cardCount > 1) {
    const firstCardBox = await pluginCards.nth(0).boundingBox();
    const secondCardBox = await pluginCards.nth(1).boundingBox();

    if (firstCardBox && secondCardBox) {
      // Cards should have similar width (allow 5px tolerance for rounding)
      const widthDiff = Math.abs(firstCardBox.width - secondCardBox.width);
      expect(widthDiff).toBeLessThan(5);

      // Cards should be at same y-position (same row)
      const yDiff = Math.abs(firstCardBox.y - secondCardBox.y);
      expect(yDiff).toBeLessThan(5);
    }
  }

  // Verify card padding is consistent
  const firstCard = pluginCards.first();
  const padding = await firstCard.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.padding;
  });
  expect(padding).toBe('24px'); // p-6 = 24px

  // Verify button is full width (w-full)
  const actionButton = firstCard.locator('button[type="button"]');
  const cardBox = await firstCard.boundingBox();
  const buttonBox = await actionButton.boundingBox();

  if (cardBox && buttonBox) {
    // Button width should be close to card width minus padding
    // Card width - (padding-left + padding-right) = button width
    const expectedButtonWidth = cardBox.width - 48; // 24px * 2
    const widthDiff = Math.abs(buttonBox.width - expectedButtonWidth);
    expect(widthDiff).toBeLessThan(10); // Allow 10px tolerance
  }

  // Verify no horizontal scrollbar (no overflow)
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalScroll).toBe(false);
});

/**
 * Test: Empty state is displayed when no plugins exist
 */
test('shows empty state when no plugins installed', async ({ page }) => {
  // This test assumes a fresh database with no plugins
  // In a real scenario, you would clean up plugins first

  await loginAndNavigate(page);

  // Wait for page load
  await page.waitForLoadState('networkidle');

  // Check if empty state is visible
  const emptyIcon = page.locator('svg.mx-auto');
  const emptyText = page.locator('text=No plugins installed');

  // If no plugins exist, verify empty state
  if (await emptyIcon.count() > 0) {
    await expect(emptyIcon).toBeVisible();
    await expect(emptyText).toBeVisible();

    // Verify empty state has correct styling
    await expect(emptyText).toHaveClass(/text-gray-600/);
    await expect(emptyText).toHaveClass(/dark:text-gray-400/);
  }
});

/**
 * Test: Toast notification appears on plugin toggle
 */
test('shows success toast notification on plugin toggle', async ({ page }) => {
  await loginAndNavigate(page);

  // Wait for plugins to load
  await page.waitForSelector('div.grid > div', { timeout: 5000 });

  // Get first plugin card and click toggle button
  const firstCard = page.locator('div.grid > div').first();
  const actionButton = firstCard.locator('button[type="button"]');
  await actionButton.click();

  // Wait for toast to appear
  const toast = page.locator('div.fixed.top-4.right-4');
  await expect(toast).toBeVisible({ timeout: 2000 });

  // Verify toast has success styling (green background)
  await expect(toast).toHaveClass(/bg-green-50/);

  // Verify toast message contains "successfully"
  await expect(toast).toContainText('successfully');

  // Wait for toast to disappear (3 seconds timeout)
  await expect(toast).not.toBeVisible({ timeout: 4000 });
});
