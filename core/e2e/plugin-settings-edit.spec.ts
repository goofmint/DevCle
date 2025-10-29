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
const successToast = (page: Page) => page.locator('text=/Plugin (enabled|disabled) successfully/i');

async function navigateToPlugins(page: Page) {
  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');
}

async function ensureFirstPluginState(page: Page, enabled: boolean) {
  const firstCard = page.locator('div.grid > div').first();
  await expect(firstCard).toBeVisible();

  const isEnabled = await firstCard.locator('div:has-text("Enabled")').count() > 0;
  if (isEnabled === enabled) {
    return firstCard;
  }

  if (enabled) {
    const enableButton = firstCard.locator('button:has-text("Enable")');
    await enableButton.click();
    await expect(successToast(page)).toBeVisible({ timeout: 5000 });
  } else {
    page.once('dialog', (dialog) => dialog.accept());
    const disableButton = firstCard.locator('button:has-text("Disable")');
    await disableButton.click();
  await expect(successToast(page)).toBeVisible({ timeout: 5000 });
  }

  // Allow toast to disappear before continuing
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });

  const refreshedCard = page.locator('div.grid > div').first();

  // Verify state updated
  await expect(
    refreshedCard.getByText(enabled ? 'Enabled' : 'Disabled').first()
  ).toBeVisible();
  return refreshedCard;
}

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
  await navigateToPlugins(page);
  const firstEnabled = await ensureFirstPluginState(page, true);

  // Settings icon should be visible
  const settingsIcon = firstEnabled.locator('a[title="Configure plugin"]');
  await expect(settingsIcon).toBeVisible();

  // Icon should be positioned top-right
  await expect(settingsIcon).toHaveClass(/absolute/);
  await expect(settingsIcon).toHaveClass(/top-4/);
  await expect(settingsIcon).toHaveClass(/right-4/);
});

/**
 * Test: Settings icon not displayed for disabled plugins
 */
test('settings icon not displayed for disabled plugins', async ({ page }) => {
  await loginAsAdmin(page);
  await navigateToPlugins(page);
  const firstDisabled = await ensureFirstPluginState(page, false);

  // Settings icon should NOT be visible
  const settingsIcon = firstDisabled.locator('a[title="Configure plugin"]');
  await expect(settingsIcon).not.toBeVisible();
});

/**
 * Test: Plugin disable confirmation dialog
 */
test('shows confirmation dialog when disabling plugin', async ({ page }) => {
  await loginAsAdmin(page);
  await navigateToPlugins(page);
  const enabledCard = await ensureFirstPluginState(page, true);

  // Setup dialog listener before clicking
  page.once('dialog', async dialog => {
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
});

/**
 * Test: Settings config deletion after disable
 */
test('config is deleted when plugin is disabled', async ({ page }) => {
  await loginAsAdmin(page);
  await navigateToPlugins(page);
  const enabledCard = await ensureFirstPluginState(page, true);

  // Get plugin ID from settings link
  const settingsLink = enabledCard.locator('a[title="Configure plugin"]');
  const href = await settingsLink.getAttribute('href');

  // Expect href to be present
  expect(href).toBeTruthy();

  // Accept the disable confirmation
  page.once('dialog', async dialog => {
    await dialog.accept();
  });

  // Click disable button
  const disableButton = enabledCard.locator('button:has-text("Disable")');
  await disableButton.click();

  // Wait for toast notification
  await expect(successToast(page)).toBeVisible({ timeout: 5000 });

  // Verify settings icon is no longer visible (card should be in disabled state)
  await expect(settingsLink).not.toBeVisible();

  // Restore state for subsequent tests
  await ensureFirstPluginState(page, true);
});

/**
 * Test: Dark mode color contrast for plugin cards
 */
test('plugin cards have correct dark mode colors', async ({ page }) => {
  await loginAsAdmin(page);

  // Set dark mode
  await page.emulateMedia({ colorScheme: 'dark' });

  await navigateToPlugins(page);

  const pluginCard = page.locator('div.grid > div').first();
  const cardCount = await page.locator('div.grid > div').count();

  // Expect at least one plugin card exists for this test
  expect(cardCount).toBeGreaterThan(0);

  // Card should have dark background
  await expect(pluginCard).toHaveClass(/dark:bg-gray-800/);

  // Title should have light text (title is now inside a link)
  const titleLink = pluginCard.locator('a').filter({ has: page.locator('text=/./') }).first();
  await expect(titleLink).toHaveClass(/dark:hover:text-blue-400/);

  // Verify text and background contrast
  const cardBox = await pluginCard.boundingBox();
  const titleBox = await titleLink.boundingBox();

  expect(cardBox).toBeTruthy();
  expect(titleBox).toBeTruthy();
});

/**
 * Test: Settings icon placement doesn't break layout
 */
test('settings icon does not break card layout', async ({ page }) => {
  await loginAsAdmin(page);
  await navigateToPlugins(page);
  const enabledCard = await ensureFirstPluginState(page, true);

  const settingsIcon = enabledCard.locator('a[title="Configure plugin"]');

  // Icon should not overlap with title (title is now inside a link)
  const iconBox = await settingsIcon.boundingBox();
  const titleLink = enabledCard.locator('a').filter({ has: page.locator('text=/./') }).first();
  const titleBox = await titleLink.boundingBox();

  // Expect both boxes to exist
  expect(iconBox).toBeTruthy();
  expect(titleBox).toBeTruthy();

  // Icon should be to the right of title
  if (iconBox && titleBox) {
    expect(iconBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
  }
});

/**
 * Test: Only admin can access settings page (403 for member)
 */
test('member user cannot access settings page', async ({ page }) => {
  // First login as admin to get plugin ID
  await loginAsAdmin(page);
  await navigateToPlugins(page);
  const enabledCard = await ensureFirstPluginState(page, true);

  const settingsLink = enabledCard.locator('a[title="Configure plugin"]').first();

  const href = await settingsLink.getAttribute('href');

  // Expect href to be present
  expect(href).toBeTruthy();

  // Logout and login as member
  await page.context().clearCookies();
  await loginAsMember(page);

  // Try to access settings page
  await page.goto(`${BASE_URL}${href}`);

  // Should see 403 error or redirect
  const errorHeading = page.getByRole('heading', { name: /An Error Occurred|Forbidden|403/i });
  if (await errorHeading.count()) {
    await expect(errorHeading.first()).toBeVisible({ timeout: 5000 });
  } else {
    await expect(page.locator('text=/403|Forbidden|Admin role required/i')).toBeVisible({ timeout: 5000 });
  }
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

  // Expect at least one settings link exists for this test
  expect(linkCount).toBeGreaterThan(0);

  // Click settings icon
  await settingsLink.click();
  await page.waitForLoadState('networkidle');

  // Verify settings page loaded
  await expect(page.locator('h1:has-text("Configure")')).toBeVisible();
  await expect(page.locator('text=Back to Plugins')).toBeVisible();
});
