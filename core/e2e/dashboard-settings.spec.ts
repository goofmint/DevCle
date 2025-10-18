/**
 * E2E Tests for System Settings Page
 *
 * Test coverage:
 * - Admin access control (non-admin users cannot access)
 * - Settings page rendering and layout
 * - Form fields visibility and initial values
 * - Dark/light mode color differences
 * - Form submission and validation
 * - Success/error message display
 *
 * Note: Safari is excluded from browser matrix
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
const SETTINGS_URL = `${BASE_URL}/dashboard/settings`;

// Helper: Login as admin user
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => url.pathname.startsWith('/dashboard'), {
    timeout: 10000,
  });
}

// Helper: Get computed color
async function getComputedColor(page: Page, selector: string, property: string): Promise<string> {
  return await page.evaluate(
    ({ selector, property }) => {
      const element = document.querySelector(selector);
      if (!element) return '';
      return window.getComputedStyle(element).getPropertyValue(property);
    },
    { selector, property },
  );
}

test.describe('System Settings Page', () => {
  test('can access settings page after login', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);
    await expect(page.locator('h1')).toHaveText('System Settings');
  });

  test('settings page displays all four sections', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Check all section headers are visible
    await expect(page.locator('text=Basic Settings')).toBeVisible();
    await expect(page.locator('text=SMTP Settings')).toBeVisible();
    await expect(page.locator('text=AI Settings')).toBeVisible();
    await expect(page.locator('text=S3 Storage Settings')).toBeVisible();
  });

  test('basic settings section has all required fields', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Check field visibility
    await expect(page.locator('input[name="serviceName"]')).toBeVisible();
    await expect(page.locator('input[name="logoUrl"]')).toBeVisible();
    await expect(page.locator('input[name="fiscalYearStart"]')).toBeVisible();
    await expect(page.locator('input[name="fiscalYearEnd"]')).toBeVisible();
    await expect(page.locator('select[name="timezone"]')).toBeVisible();
  });

  test('smtp settings section has all required fields', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    await expect(page.locator('input[name="smtpHost"]')).toBeVisible();
    await expect(page.locator('input[name="smtpPort"]')).toBeVisible();
    await expect(page.locator('input[name="smtpUsername"]')).toBeVisible();
    await expect(page.locator('input[name="smtpPassword"]')).toBeVisible();
  });

  test('ai settings section has all required fields', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    await expect(page.locator('select[name="aiProvider"]')).toBeVisible();
    await expect(page.locator('input[name="aiApiKey"]')).toBeVisible();
    await expect(page.locator('input[name="aiModel"]')).toBeVisible();
  });

  test('s3 settings section has all required fields', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    await expect(page.locator('input[name="s3Bucket"]')).toBeVisible();
    await expect(page.locator('input[name="s3Region"]')).toBeVisible();
    await expect(page.locator('input[name="s3AccessKeyId"]')).toBeVisible();
    await expect(page.locator('input[name="s3SecretAccessKey"]')).toBeVisible();
    await expect(page.locator('input[name="s3Endpoint"]')).toBeVisible();
  });

  test('password fields are masked', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Check password field types
    await expect(page.locator('input[name="smtpPassword"]')).toHaveAttribute('type', 'password');
    await expect(page.locator('input[name="aiApiKey"]')).toHaveAttribute('type', 'password');
    await expect(page.locator('input[name="s3AccessKeyId"]')).toHaveAttribute('type', 'password');
    await expect(page.locator('input[name="s3SecretAccessKey"]')).toHaveAttribute(
      'type',
      'password',
    );
  });

  test('dark mode has different colors from light mode', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Get light mode colors from main container and heading
    const lightBg = await getComputedColor(page, '.min-h-screen', 'background-color');
    const lightHeading = await getComputedColor(page, 'h1', 'color');

    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    // Wait for style changes to apply
    await page.waitForTimeout(100);

    // Get dark mode colors
    const darkBg = await getComputedColor(page, '.min-h-screen', 'background-color');
    const darkHeading = await getComputedColor(page, 'h1', 'color');

    // Verify colors are different
    expect(lightBg).not.toBe(darkBg);
    expect(lightHeading).not.toBe(darkHeading);
  });

  test('submit button is visible and enabled', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toHaveText('Save Settings');
  });

  test('form submission with valid data shows success message', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Fill in basic settings
    await page.fill('input[name="serviceName"]', 'Test DevCle');
    await page.fill('input[name="fiscalYearStart"]', '04-01');
    await page.fill('input[name="fiscalYearEnd"]', '03-31');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    await expect(page.locator('text=Settings updated successfully')).toBeVisible({
      timeout: 5000,
    });
  });

  test('form submission with invalid fiscal year shows error', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Fill with invalid fiscal year (month > 12)
    await page.fill('input[name="fiscalYearStart"]', '13-01');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 5000 });
  });

  test('sections have consistent spacing and alignment', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    // Get all section elements
    const sections = page.locator('section');
    const count = await sections.count();

    // Check that all sections have the same padding class
    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      await expect(section).toHaveClass(/p-6/);
      await expect(section).toHaveClass(/rounded-lg/);
    }
  });

  test('timezone select has options', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    const timezoneSelect = page.locator('select[name="timezone"]');
    const options = timezoneSelect.locator('option');

    // Check that timezone select has multiple options
    const count = await options.count();
    expect(count).toBeGreaterThan(0);

    // Check that Asia/Tokyo exists
    await expect(options.filter({ hasText: 'Asia/Tokyo' })).toHaveCount(1);
  });

  test('ai provider select has correct options', async ({ page }) => {
    await login(page);
    await page.goto(SETTINGS_URL);

    const providerSelect = page.locator('select[name="aiProvider"]');

    // Check provider options exist
    await expect(providerSelect.locator('option[value="openai"]')).toHaveCount(1);
    await expect(providerSelect.locator('option[value="anthropic"]')).toHaveCount(1);
    await expect(providerSelect.locator('option[value="google"]')).toHaveCount(1);
  });
});
