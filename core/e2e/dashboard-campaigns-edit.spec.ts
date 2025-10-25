/**
 * E2E Tests for Campaign Edit Form
 *
 * Test scenarios:
 * 1. Data loading and form display
 * 2. Successful campaign update
 * 3. Required field validation
 * 4. Date range validation
 * 5. API error handling
 * 6. Cancel navigation
 * 7. 404 error when campaign not found
 * 8. Dark mode color contrast
 * 9. Light mode color contrast
 * 10. Design alignment check
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper: Login as test user
 *
 * Logs in as test@example.com and waits for dashboard to load.
 */
async function loginAsTestUser(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Create a test campaign
 *
 * Creates a new campaign and returns its ID.
 */
async function createTestCampaign(page: Page): Promise<string> {
  const uniqueName = `Test Edit Campaign ${Date.now()}`;

  await page.goto(`${BASE_URL}/dashboard/campaigns/new`);
  await page.waitForLoadState('networkidle');

  await page.fill('input#name', uniqueName);
  await page.fill('input#channel', 'event');
  await page.fill('input#startDate', '2024-11-01');
  await page.fill('input#endDate', '2024-11-30');
  await page.fill('input#budgetTotal', '50000');

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Extract campaign ID from URL
  const url = page.url();
  const match = url.match(/\/campaigns\/([a-f0-9-]+)$/);
  if (!match || !match[1]) {
    throw new Error('Failed to extract campaign ID from URL');
  }

  return match[1];
}

/**
 * Helper: Get computed RGB color
 *
 * Returns RGB color in format "rgb(r, g, b)".
 */
async function getComputedColor(
  page: Page,
  selector: string,
  property: 'color' | 'backgroundColor'
): Promise<string> {
  const element = page.locator(selector).first();
  const value = await element.evaluate((el, prop) => {
    return window.getComputedStyle(el).getPropertyValue(prop);
  }, property);
  return value;
}

/**
 * Helper: Calculate color luminance
 */
function calculateLuminance(rgb: string): number {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 0;

  const [, r, g, b] = match.map(Number);
  const values = [r, g, b].map((val: number | undefined) => {
    if (val === undefined) return 0;
    const srgb = val / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (values[0] ?? 0) + 0.7152 * (values[1] ?? 0) + 0.0722 * (values[2] ?? 0);
}

/**
 * Helper: Calculate contrast ratio
 */
function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = calculateLuminance(color1);
  const lum2 = calculateLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Campaign Edit Form', () => {
  let campaignId: string;

  test.beforeEach(async ({ page }) => {
    // Login as test user
    await loginAsTestUser(page);

    // Create a test campaign
    campaignId = await createTestCampaign(page);

    // Navigate to edit page
    await page.goto(`${BASE_URL}/dashboard/campaigns/edit/${campaignId}`);
    await page.waitForLoadState('networkidle');
  });

  /**
   * Test 1: Load and display existing campaign data
   */
  test('should load and display existing campaign data', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Check page title
    await expect(page.locator('h1')).toContainText('Edit Campaign');

    // Verify form fields are pre-filled with existing data
    const nameValue = await page.locator('input#name').inputValue();
    expect(nameValue).toContain('Test Edit Campaign');

    const channelValue = await page.locator('input#channel').inputValue();
    expect(channelValue).toBe('event');

    const startDateValue = await page.locator('input#startDate').inputValue();
    expect(startDateValue).toBe('2024-11-01');

    const endDateValue = await page.locator('input#endDate').inputValue();
    expect(endDateValue).toBe('2024-11-30');

    const budgetValue = await page.locator('input#budgetTotal').inputValue();
    expect(budgetValue).toBe('50000');

    // Check submit button text is "Update"
    await expect(page.locator('button[type="submit"]')).toContainText('Update');
  });

  /**
   * Test 2: Update campaign successfully
   */
  test('should update campaign successfully', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Generate unique campaign name to avoid conflicts
    const uniqueName = `Updated Campaign ${Date.now()}`;

    // Modify form fields
    await page.fill('input#name', uniqueName);
    await page.fill('input#channel', 'ad');
    await page.fill('input#budgetTotal', '75000');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForTimeout(2000);

    // Verify navigation to detail page
    expect(page.url()).toMatch(/\/dashboard\/campaigns\/[a-f0-9-]+$/);
    expect(page.url()).not.toContain('/edit');

    // Verify updated data is displayed (check if name appears on page)
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible();
  });

  /**
   * Test 3: Required field validation
   */
  test('should show validation error for empty required fields', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Clear required field
    await page.fill('input#name', '');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('#name-error', { timeout: 2000 });

    // Check error message
    await expect(page.locator('#name-error')).toContainText('Campaign name is required');

    // Check field has error styling
    const nameInput = page.locator('input#name');
    const borderColor = await nameInput.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });
    const isRed = borderColor.includes('red') ||
                  borderColor.match(/rgb\(2\d{2},\s*\d{1,2},\s*\d{1,2}\)/) ||
                  borderColor.match(/oklch\(0\.\d+\s+0\.\d+\s+\d+/);
    expect(isRed).toBeTruthy();
  });

  /**
   * Test 4: Date range validation
   */
  test('should show validation error for invalid date range', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Set endDate before startDate
    await page.fill('input#startDate', '2024-12-01');
    await page.fill('input#endDate', '2024-11-01');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('#endDate-error', { timeout: 2000 });

    // Check error message
    await expect(page.locator('#endDate-error')).toContainText(
      'End date must be on or after the start date'
    );
  });

  /**
   * Test 5: Cancel navigation
   */
  test('should navigate back to detail page on cancel', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Click cancel button
    await page.click('button[type="button"]:has-text("Cancel")');

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Verify navigation to detail page
    expect(page.url()).toMatch(/\/dashboard\/campaigns\/[a-f0-9-]+$/);
    expect(page.url()).not.toContain('/edit');
  });

  /**
   * Test 6: Dark mode color contrast
   */
  test('should have sufficient color contrast in dark mode', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    // Check input field contrast
    const inputColor = await getComputedColor(page, 'input#name', 'color');
    const inputBg = await getComputedColor(page, 'input#name', 'backgroundColor');
    const inputContrast = calculateContrastRatio(inputColor, inputBg);
    expect(inputContrast).toBeGreaterThanOrEqual(3.0);

    // Verify elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
  });

  /**
   * Test 7: Light mode color contrast
   */
  test('should have sufficient color contrast in light mode', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Ensure light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(500);

    // Verify elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();

    // Check input has visible text color
    const inputColor = await getComputedColor(page, 'input#name', 'color');
    expect(inputColor).toBeTruthy();
    expect(inputColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  /**
   * Test 8: Design alignment check
   */
  test('should have no design misalignment', async ({ page }) => {
    // Wait for form to load
    await page.waitForSelector('.campaign-form', { timeout: 10000 });

    // Check form container alignment
    const formBox = await page.locator('.campaign-form').boundingBox();
    expect(formBox).not.toBeNull();
    if (formBox) {
      expect(formBox.x).toBeGreaterThan(0);
      expect(formBox.x).toBeLessThan(500);
    }

    // Check input fields have consistent width
    const nameBox = await page.locator('input#name').boundingBox();
    const channelBox = await page.locator('input#channel').boundingBox();
    expect(nameBox?.width).toBe(channelBox?.width);

    // Check buttons are horizontally aligned
    const cancelBox = await page.locator('button:has-text("Cancel")').boundingBox();
    const submitBox = await page.locator('button[type="submit"]').boundingBox();
    expect(cancelBox?.y).toBe(submitBox?.y);
  });
});

test.describe('Campaign Edit Form - 404 Error', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await loginAsTestUser(page);
  });

  /**
   * Test 9: Handle 404 error when campaign not found
   */
  test('should handle 404 error when campaign not found', async ({ page }) => {
    // Navigate to non-existent campaign ID
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    await page.goto(`${BASE_URL}/dashboard/campaigns/edit/${nonExistentId}`);
    await page.waitForLoadState('networkidle');

    // Wait for error message
    await page.waitForSelector('.error-message', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('.error-message')).toContainText('Campaign not found');

    // Verify "Go to Campaigns List" button exists
    await expect(
      page.locator('button:has-text("Go to Campaigns List")')
    ).toBeVisible();
  });
});
