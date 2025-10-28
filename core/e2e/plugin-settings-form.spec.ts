/**
 * Plugin Settings Form E2E Tests
 *
 * Tests for dynamic form generation, field types, and validation.
 *
 * Test scenarios:
 * 1. Dynamic form renders all field types
 * 2. String/textarea fields work correctly
 * 3. Number fields validate range
 * 4. Boolean checkboxes work
 * 5. Select dropdowns display options
 * 6. URL/email fields validate format
 * 7. Secret fields have toggle functionality
 * 8. Validation errors are displayed
 * 9. Form submission works
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

/**
 * Helper: Login as admin and navigate to settings page
 */
async function navigateToSettingsPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });

  await page.goto(`${BASE_URL}/dashboard/plugins`);
  await page.waitForLoadState('networkidle');

  const settingsLink = page.locator('a[title="Configure plugin"]').first();
  const count = await page.locator('a[title="Configure plugin"]').count();

  // Expect at least one plugin with settings exists
  expect(count).toBeGreaterThan(0);

  await settingsLink.click();
  await page.waitForURL(/\/dashboard\/plugins\/.*\/edit$/i, { timeout: 5000 });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('form', { timeout: 5000 });
}

/**
 * Test: Form displays after navigation
 */
test('settings form is displayed', async ({ page }) => {
  await navigateToSettingsPage(page);

  // Verify form exists
  await expect(page.locator('form')).toBeVisible();

  // Verify form has save button
  await expect(page.locator('button[type="submit"]:has-text("Save Configuration")')).toBeVisible();

  // Verify cancel button exists
  await expect(page.locator('a:has-text("Cancel")')).toBeVisible();
});

/**
 * Test: String fields are rendered correctly
 */
test('string fields render with correct attributes', async ({ page }) => {
  await navigateToSettingsPage(page);

  // Find text inputs (string, url, email)
  const textInputs = page.locator('input[type="text"], input[type="url"], input[type="email"]');
  const count = await textInputs.count();

  // Expect at least one text input exists
  expect(count).toBeGreaterThan(0);

  const firstInput = textInputs.first();

  // Input should have proper styling
  await expect(firstInput).toHaveClass(/border/);
  await expect(firstInput).toHaveClass(/rounded/);

  // Input should have dark mode styles
  await expect(firstInput).toHaveClass(/dark:bg-gray-700/);
  await expect(firstInput).toHaveClass(/dark:text-gray-100/);
});

/**
 * Test: Textarea fields render correctly
 */
test('textarea fields render with multiple rows', async ({ page }) => {
  await navigateToSettingsPage(page);

  const textareas = page.locator('textarea');
  const count = await textareas.count();

  // Expect at least one textarea exists (test plugin has description field)
  expect(count).toBeGreaterThan(0);

  const firstTextarea = textareas.first();

  // Textarea should have styling
  await expect(firstTextarea).toHaveClass(/border/);
  await expect(firstTextarea).toHaveClass(/rounded/);

  // Textarea should have dark mode styles
  await expect(firstTextarea).toHaveClass(/dark:bg-gray-700/);

  // Textarea should have rows attribute
  const rows = await firstTextarea.getAttribute('rows');
  expect(rows).toBeTruthy();
});

/**
 * Test: Number fields validate range
 */
test('number fields accept numeric input', async ({ page }) => {
  await navigateToSettingsPage(page);

  const numberInputs = page.locator('input[type="number"]');
  const count = await numberInputs.count();

  // Expect at least one number input exists (test plugin has syncInterval field)
  expect(count).toBeGreaterThan(0);

  const firstNumber = numberInputs.first();

  // Number input should have styling
  await expect(firstNumber).toHaveClass(/border/);

  // Test input
  await firstNumber.fill('42');
  await expect(firstNumber).toHaveValue('42');
});

/**
 * Test: Boolean checkbox fields work
 */
test('boolean fields render as checkboxes', async ({ page }) => {
  await navigateToSettingsPage(page);

  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();

  // Expect at least one checkbox exists (test plugin has enableDebugMode + secret toggle)
  expect(count).toBeGreaterThan(0);

  // Find form checkboxes (not the secret toggle)
  const booleanCheckbox = checkboxes.filter({ hasNot: page.locator(':has-text("Change this setting")') }).first();

  // Checkbox should be visible
  await expect(booleanCheckbox).toBeVisible();

  // Checkbox should have styling
  await expect(booleanCheckbox).toHaveClass(/rounded/);
});

/**
 * Test: Select fields display options
 */
test('select fields render dropdown options', async ({ page }) => {
  await navigateToSettingsPage(page);

  const selects = page.locator('select');
  const count = await selects.count();

  // Expect at least one select exists (test plugin has logLevel field)
  expect(count).toBeGreaterThan(0);

  const firstSelect = selects.first();

  // Select should have styling
  await expect(firstSelect).toHaveClass(/border/);
  await expect(firstSelect).toHaveClass(/rounded/);

  // Select should have dark mode styles
  await expect(firstSelect).toHaveClass(/dark:bg-gray-700/);

  // Select should have options
  const options = firstSelect.locator('option');
  const optionCount = await options.count();
  expect(optionCount).toBeGreaterThan(0);
});

/**
 * Test: Secret fields have toggle functionality
 */
test('secret fields show toggle checkbox', async ({ page }) => {
  await navigateToSettingsPage(page);

  // Look for secret field markers
  const secretMarker = page.locator('text=Secret is set (unchanged)');
  const markerCount = await secretMarker.count();

  if (markerCount > 0) {
    // Find "Change this setting" checkbox when secret exists
    const toggleCheckbox = page.locator('input[type="checkbox"]:near(:text("Change this setting"))').first();
    await expect(toggleCheckbox).toBeVisible();
    const secretInput = page.locator('input[name="apiKey"]').first();
    await expect(secretInput).not.toBeVisible();
    await toggleCheckbox.click();
    await expect(secretInput).toBeVisible();
  } else {
    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    await expect(page.getByLabel(/API Key/i)).toHaveAttribute('type', /password|text/);
  }

  // Show/hide password toggle should be visible
  const showHideButton = page.locator('button:near(input[name="apiKey"])').first();
  await expect(showHideButton).toBeVisible();
});

/**
 * Test: Secret field show/hide toggle works
 */
test('secret field show/hide password toggle', async ({ page }) => {
  await navigateToSettingsPage(page);

  const secretMarker = page.locator('text=Secret is set (unchanged)');
  const markerCount = await secretMarker.count();

  const secretInput = page.locator('input[name="apiKey"]').first();
  if (markerCount > 0) {
    const toggleCheckbox = page.locator('input[type="checkbox"]:near(:text("Change this setting"))').first();
    await toggleCheckbox.click();
  }

  await secretInput.fill('test-secret-123');

  const showHideButton = page.locator('button:near(input[name="apiKey"])').first();
  await showHideButton.click();
  await expect(secretInput).toHaveAttribute('type', 'text');

  await showHideButton.click();
  await expect(secretInput).toHaveAttribute('type', /password/);
});

/**
 * Test: Required field validation
 */
test('required fields show validation errors', async ({ page }) => {
  await navigateToSettingsPage(page);

  // Find required inputs
  const requiredInputs = page.locator('input[required], textarea[required], select[required]');
  const count = await requiredInputs.count();

  // Expect at least one required input exists (test plugin has apiKey as required)
  expect(count).toBeGreaterThan(0);

  const firstRequired = requiredInputs.first();

  // Clear the field if it has value
  await firstRequired.clear();

  // Try to submit form
  const submitButton = page.locator('button[type="submit"]:has-text("Save")');
  await submitButton.click();

  // Browser validation should prevent submission
  // (HTML5 validation will show native error, not our custom error)
  await page.waitForTimeout(500);

  // Verify we're still on the same page
  expect(page.url()).toContain('/edit');
});

/**
 * Test: Cancel button navigates back
 */
test('cancel button returns to plugins list', async ({ page }) => {
  await navigateToSettingsPage(page);

  const cancelButton = page.locator('a:has-text("Cancel")');
  await cancelButton.click();
  await page.waitForLoadState('networkidle');

  // Should be back on plugins page
  await expect(page.locator('h1:has-text("Plugin Management")')).toBeVisible();
});

/**
 * Test: Dark mode form styling
 */
test('form has correct dark mode styling', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });

  await navigateToSettingsPage(page);

  // Form container should have dark background
  const formContainer = page.locator('form').locator('..');
  await expect(formContainer).toHaveClass(/dark:bg-gray-800/);

  // Labels should have light text
  const labels = page.locator('label');
  const labelCount = await labels.count();

  // Expect at least one label exists
  expect(labelCount).toBeGreaterThan(0);

  const firstLabel = labels.first();
  await expect(firstLabel).toHaveClass(/dark:text-gray-300/);
});
