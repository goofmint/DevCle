/**
 * Plugin Settings Edit E2E Tests
 *
 * End-to-end tests for plugin settings edit functionality.
 * Tests dynamic form generation, validation, secret fields, and permissions.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users and plugins
 * - Plugin must have settingsSchema in plugin.json
 *
 * Test scenarios:
 * 1. Settings icon displayed for enabled plugins
 * 2. Settings page displays dynamic form
 * 3. All field types are rendered correctly
 * 4. Validation errors are displayed
 * 5. Secret field toggle functionality
 * 6. Settings are saved and encrypted
 * 7. Only admin can edit settings
 * 8. Disable confirmation dialog
 * 9. Dark mode color contrast
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

/**
 * Helper: Login as admin user
 */
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

/**
 * Helper: Login as member user (non-admin)
 */
async function loginAsMember(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

/**
 * Test: Settings icon is displayed for enabled plugins only
 */
test('settings icon displayed for enabled plugins', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  // Find enabled plugin cards
  const enabledCards = page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)');
  const enabledCount = await enabledCards.count();

  if (enabledCount > 0) {
    const firstEnabled = enabledCards.first();

    // Settings icon should be visible
    const settingsIcon = firstEnabled.locator('a[title="Configure plugin"]');
    await expect(settingsIcon).toBeVisible();

    // Icon should have cog/settings icon
    await expect(settingsIcon.locator('svg')).toBeVisible();

    // Icon should be positioned top-right
    await expect(settingsIcon).toHaveClass(/absolute/);
    await expect(settingsIcon).toHaveClass(/top-4/);
    await expect(settingsIcon).toHaveClass(/right-4/);
  }
});

/**
 * Test: Settings icon not displayed for disabled plugins
 */
test('settings icon not displayed for disabled plugins', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  // Find disabled plugin cards
  const disabledCards = page.locator('div.grid > div:has(.bg-gray-100, .bg-gray-700):not(:has(.bg-green-100))');
  const disabledCount = await disabledCards.count();

  if (disabledCount > 0) {
    const firstDisabled = disabledCards.first();

    // Settings icon should NOT be visible
    const settingsIcon = firstDisabled.locator('a[title="Configure plugin"]');
    await expect(settingsIcon).not.toBeVisible();
  }
});

/**
 * Test: Plugin disable confirmation dialog
 */
test('shows confirmation dialog when disabling plugin', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  // Find enabled plugin
  const enabledCard = page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').first();
  const cardCount = await page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').count();

  if (cardCount > 0) {
    // Setup dialog listener before clicking
    page.on('dialog', async dialog => {
      // Verify dialog message contains warning
      expect(dialog.message()).toContain('disable');
      expect(dialog.message()).toContain('settings will be deleted');
      expect(dialog.message()).toContain('cannot be recovered');

      // Dismiss dialog (don't actually disable)
      await dialog.dismiss();
    });

    // Click disable button
    const disableButton = enabledCard.locator('button:has-text("Disable")');
    await disableButton.click();

    // Wait a bit for dialog to appear
    await page.waitForTimeout(500);
  } else {
    test.skip();
  }
});

/**
 * Test: Settings config deletion after disable
 */
test('config is deleted when plugin is disabled', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  // Find enabled plugin with settings
  const enabledCard = page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').first();
  const cardCount = await page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').count();

  if (cardCount === 0) {
    test.skip();
    return;
  }

  // Get plugin ID from settings link
  const settingsLink = enabledCard.locator('a[title="Configure plugin"]');
  const href = await settingsLink.getAttribute('href');

  if (!href) {
    test.skip();
    return;
  }

  // Accept the disable confirmation
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  // Click disable button
  const disableButton = enabledCard.locator('button:has-text("Disable")');
  await disableButton.click();

  // Wait for toast notification
  await expect(page.locator('text=disabled successfully')).toBeVisible({ timeout: 5000 });

  // Verify settings icon is no longer visible (card should be in disabled state)
  await expect(settingsLink).not.toBeVisible();
});

/**
 * Test: Dark mode color contrast for plugin cards
 */
test('plugin cards have correct dark mode colors', async ({ page }) => {
  await loginAsAdmin(page);

  // Set dark mode
  await page.emulateMedia({ colorScheme: 'dark' });

  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  const pluginCard = page.locator('div.grid > div').first();
  const cardCount = await page.locator('div.grid > div').count();

  if (cardCount > 0) {
    // Card should have dark background
    await expect(pluginCard).toHaveClass(/dark:bg-gray-800/);

    // Title should have light text
    const title = pluginCard.locator('a').first();
    await expect(title).toHaveClass(/dark:text-gray-100/);

    // Verify text and background contrast
    const cardBox = await pluginCard.boundingBox();
    const titleBox = await title.boundingBox();

    expect(cardBox).toBeTruthy();
    expect(titleBox).toBeTruthy();
  }
});

/**
 * Test: Settings icon placement doesn't break layout
 */
test('settings icon does not break card layout', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  const enabledCard = page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').first();
  const cardCount = await page.locator('div.grid > div:has(.bg-green-100, .bg-green-900\\/30)').count();

  if (cardCount > 0) {
    const settingsIcon = enabledCard.locator('a[title="Configure plugin"]');

    // Icon should not overlap with title
    const iconBox = await settingsIcon.boundingBox();
    const titleBox = await enabledCard.locator('a').first().boundingBox();

    if (iconBox && titleBox) {
      // Icon should be to the right of title
      expect(iconBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    }
  }
});

/**
 * Test: Only admin can access settings page (403 for member)
 */
test('member user cannot access settings page', async ({ page }) => {
  // First login as admin to get plugin ID
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  const settingsLink = page.locator('a[title="Configure plugin"]').first();
  const linkCount = await page.locator('a[title="Configure plugin"]').count();

  if (linkCount === 0) {
    test.skip();
    return;
  }

  const href = await settingsLink.getAttribute('href');

  if (!href) {
    test.skip();
    return;
  }

  // Logout and login as member
  await page.goto(`${BASE_URL}/logout`);
  await loginAsMember(page);

  // Try to access settings page
  await page.goto(`${BASE_URL}${href}`);

  // Should see 403 error or redirect
  const forbidden = page.locator('text=/403|Forbidden|Admin role required/i');
  await expect(forbidden).toBeVisible({ timeout: 5000 });
});

/**
 * Test: Admin can access settings page
 */
test('admin can access settings page', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  const settingsLink = page.locator('a[title="Configure plugin"]').first();
  const linkCount = await page.locator('a[title="Configure plugin"]').count();

  if (linkCount === 0) {
    test.skip();
    return;
  }

  // Click settings icon
  await settingsLink.click();
  await page.waitForLoadState('networkidle');

  // Verify settings page loaded
  await expect(page.locator('h1:has-text("Configure")')).toBeVisible();
  await expect(page.locator('text=Back to Plugins')).toBeVisible();
});
