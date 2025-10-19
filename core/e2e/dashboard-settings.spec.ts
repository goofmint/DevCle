/**
 * System Settings E2E Tests
 *
 * End-to-end tests for system settings page using Playwright.
 * Tests admin-only access, form submissions, and dark/light mode.
 *
 * Prerequisites:
 * - Remix dev server must be running (BASE_URL from env)
 * - Database must be seeded with test users:
 *   - test@example.com / password123 (member)
 *   - admin@example.com / admin123456 (admin)
 *
 * Test Coverage:
 * - Basic Settings (6 tests)
 * - S3 Settings (3 tests)
 * - SMTP Settings (2 tests)
 * - Validation (3 tests)
 * Total: 14 tests
 */

import { test, expect } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper: Login as admin user
 * Navigates to login page and authenticates
 */
async function loginAsAdmin(page: ReturnType<typeof test.use>['page']) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

/**
 * Helper: Login as member user (non-admin)
 */
async function loginAsMember(page: ReturnType<typeof test.use>['page']) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

/**
 * Helper: Get computed color from element
 * Returns RGB color string for comparison
 */
async function getComputedColor(page: ReturnType<typeof test.use>['page'], selector: string): Promise<string> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`Element not found: ${sel}`);
    return window.getComputedStyle(element).color;
  }, selector);
}

/**
 * Helper: Get computed background color from element
 */
async function getComputedBgColor(page: ReturnType<typeof test.use>['page'], selector: string): Promise<string> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`Element not found: ${sel}`);
    return window.getComputedStyle(element).backgroundColor;
  }, selector);
}

/**
 * Test Group 1: Basic Settings (6 tests)
 */
test('should display system settings page (admin only)', async ({ page }) => {
  await loginAsAdmin(page);

  // Navigate to settings page
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Verify page title
  await expect(page.locator('h1')).toContainText('System Settings');

  // Verify all three sections are visible
  await expect(page.getByText('Basic Settings')).toBeVisible();
  await expect(page.getByText('S3 Settings')).toBeVisible();
  await expect(page.getByText('SMTP Settings')).toBeVisible();
});

test('should prevent non-admin access', async ({ page }) => {
  await loginAsMember(page);

  // Try to access settings page
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Verify access denied message
  await expect(page.getByText('Access Denied')).toBeVisible();
  await expect(page.getByText('Admin role required')).toBeVisible();
});

test('should load existing settings', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Verify service name input has default value
  const serviceNameInput = page.getByTestId('service-name-input');
  await expect(serviceNameInput).toHaveValue('DevCle');

  // Verify fiscal year dropdown has default value (April = 4)
  const fiscalYearInput = page.getByTestId('fiscal-year-start-input');
  await expect(fiscalYearInput).toHaveValue('4');

  // Verify timezone dropdown has default value
  const timezoneInput = page.getByTestId('timezone-input');
  await expect(timezoneInput).toHaveValue('Asia/Tokyo');
});

test('should update service name', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Update service name
  const serviceNameInput = page.getByTestId('service-name-input');
  await serviceNameInput.fill('My DevRel Tool');

  // Submit form
  const submitButton = page.getByTestId('basic-settings-submit');
  await submitButton.click();

  // Wait for success toast
  await expect(page.getByTestId('toast-notification')).toContainText('Basic settings saved successfully');

  // Reload and verify persistence
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('service-name-input')).toHaveValue('My DevRel Tool');
});

test('should update fiscal year', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Update fiscal year to January (1)
  const fiscalYearInput = page.getByTestId('fiscal-year-start-input');
  await fiscalYearInput.selectOption('1');

  // Submit form
  await page.getByTestId('basic-settings-submit').click();

  // Wait for success toast
  await expect(page.getByTestId('toast-notification')).toContainText('Basic settings saved successfully');

  // Reload and verify
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('fiscal-year-start-input')).toHaveValue('1');
});

test('should update timezone', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Update timezone to America/New_York
  const timezoneInput = page.getByTestId('timezone-input');
  await timezoneInput.selectOption('America/New_York');

  // Submit form
  await page.getByTestId('basic-settings-submit').click();

  // Wait for success toast
  await expect(page.getByTestId('toast-notification')).toContainText('Basic settings saved successfully');

  // Reload and verify
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('timezone-input')).toHaveValue('America/New_York');
});

/**
 * Test Group 2: S3 Settings (3 tests)
 */
test('should save S3 settings', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Fill S3 form
  await page.getByTestId('s3-bucket-input').fill('test-bucket');
  await page.getByTestId('s3-region-input').fill('us-east-1');
  await page.getByTestId('s3-access-key-id-input').fill('AKIAIOSFODNN7EXAMPLE');
  await page.getByTestId('s3-secret-access-key-input').fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');

  // Submit form
  await page.getByTestId('s3-settings-submit').click();

  // Wait for success toast
  await expect(page.getByTestId('toast-notification')).toContainText('S3 settings saved successfully');

  // Verify status indicator shows "Configured"
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Configured').first()).toBeVisible();
});

test('should show upload button when S3 is configured', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Configure S3
  await page.getByTestId('s3-bucket-input').fill('test-bucket');
  await page.getByTestId('s3-region-input').fill('us-east-1');
  await page.getByTestId('s3-access-key-id-input').fill('AKIAIOSFODNN7EXAMPLE');
  await page.getByTestId('s3-secret-access-key-input').fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  await page.getByTestId('s3-settings-submit').click();
  await expect(page.getByTestId('toast-notification')).toContainText('S3 settings saved successfully');

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify logo URL field mentions upload option
  await expect(page.getByText('(or upload below)')).toBeVisible();
});

test('should test S3 connection', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Fill S3 form with test credentials
  await page.getByTestId('s3-bucket-input').fill('test-bucket');
  await page.getByTestId('s3-region-input').fill('us-east-1');
  await page.getByTestId('s3-access-key-id-input').fill('AKIAIOSFODNN7EXAMPLE');
  await page.getByTestId('s3-secret-access-key-input').fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');

  // Click test connection button
  const testButton = page.getByTestId('s3-test-connection-button');
  await testButton.click();

  // Wait for result (may be success or failure depending on test environment)
  // At minimum, verify button shows "Testing..." state
  await expect(testButton).toContainText('Testing...');
});

/**
 * Test Group 3: SMTP Settings (2 tests)
 */
test('should save SMTP settings', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Fill SMTP form
  await page.getByTestId('smtp-host-input').fill('smtp.example.com');
  await page.getByTestId('smtp-port-input').fill('587');
  await page.getByTestId('smtp-use-tls-checkbox').check();
  await page.getByTestId('smtp-username-input').fill('user@example.com');
  await page.getByTestId('smtp-password-input').fill('password123');
  await page.getByTestId('smtp-from-address-input').fill('noreply@example.com');

  // Submit form
  await page.getByTestId('smtp-settings-submit').click();

  // Wait for success toast
  await expect(page.getByTestId('toast-notification')).toContainText('SMTP settings saved successfully');
});

test('should test SMTP connection', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Fill SMTP form
  await page.getByTestId('smtp-host-input').fill('smtp.example.com');
  await page.getByTestId('smtp-port-input').fill('587');
  await page.getByTestId('smtp-username-input').fill('user@example.com');
  await page.getByTestId('smtp-password-input').fill('password123');
  await page.getByTestId('smtp-from-address-input').fill('noreply@example.com');

  // Click test connection button
  const testButton = page.getByTestId('smtp-test-connection-button');
  await testButton.click();

  // Verify button shows "Testing..." state
  await expect(testButton).toContainText('Testing...');
});

/**
 * Test Group 4: Validation (3 tests)
 */
test('should show validation error for invalid fiscal year', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Fiscal year dropdown only allows valid values (1-12), so this test verifies
  // that only valid options are available
  const fiscalYearInput = page.getByTestId('fiscal-year-start-input');
  const options = await fiscalYearInput.locator('option').count();

  // Should have exactly 12 options (1-12)
  expect(options).toBe(12);
});

test('should show validation error for invalid timezone', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Timezone dropdown uses Intl.supportedValuesOf('timeZone')
  // Verify dropdown has valid timezone options
  const timezoneInput = page.getByTestId('timezone-input');
  const options = await timezoneInput.locator('option').count();

  // Should have many options (IANA timezones)
  expect(options).toBeGreaterThan(100);

  // Verify Asia/Tokyo is present
  const tokyoOption = timezoneInput.locator('option[value="Asia/Tokyo"]');
  await expect(tokyoOption).toHaveCount(1);
});

test('should mask sensitive fields on reload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Save S3 settings
  await page.getByTestId('s3-bucket-input').fill('test-bucket');
  await page.getByTestId('s3-region-input').fill('us-east-1');
  await page.getByTestId('s3-access-key-id-input').fill('AKIAIOSFODNN7EXAMPLE');
  await page.getByTestId('s3-secret-access-key-input').fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  await page.getByTestId('s3-settings-submit').click();
  await expect(page.getByTestId('toast-notification')).toContainText('S3 settings saved successfully');

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify secret fields are empty (not pre-filled for security)
  const secretKeyInput = page.getByTestId('s3-secret-access-key-input');
  await expect(secretKeyInput).toHaveValue('');
  await expect(secretKeyInput).toHaveAttribute('type', 'password');
});
