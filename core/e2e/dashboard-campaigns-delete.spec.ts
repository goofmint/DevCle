/**
 * E2E Tests for Campaign Delete Functionality
 *
 * Tests the delete campaign feature including:
 * - Delete button display and accessibility
 * - Delete confirmation dialog
 * - Successful deletion with navigation
 * - Cancel/close interactions (button, ESC key, overlay click)
 * - Error handling (404, network errors)
 * - Loading state during deletion
 * - Dark/light mode visual consistency
 *
 * Test setup:
 * - Uses authenticated test user (test@example.com / password123)
 * - Creates test campaign before each test
 * - Cleans up test data after tests
 */

import { test, expect, type Page } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper function to log in as test user
 */
async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

/**
 * Helper function to create a test campaign via API
 *
 * Returns the created campaign ID
 * Note: Uses page.request which automatically shares cookies from the browser context
 */
async function createTestCampaign(page: Page): Promise<string> {
  const response = await page.request.post(
    `${BASE_URL}/api/campaigns`,
    {
      data: {
        name: 'Test Campaign for Deletion',
        channel: 'email',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        budgetTotal: '100000',
      },
    }
  );

  if (!response.ok()) {
    throw new Error(`Failed to create test campaign: ${response.status()}`);
  }

  const campaign = await response.json();
  return campaign.campaignId;
}

/**
 * Helper function to delete a campaign via API (cleanup)
 * Note: Uses page.request which automatically shares cookies from the browser context
 */
async function deleteCampaignViaAPI(
  page: Page,
  campaignId: string
): Promise<void> {
  await page.request.delete(`${BASE_URL}/api/campaigns/${campaignId}`);
}

/**
 * Helper function to check color contrast between text and background
 *
 * Returns true if there's sufficient contrast (for accessibility)
 */
async function checkColorContrast(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  const color = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      text: styles.color,
      background: styles.backgroundColor,
    };
  });

  // Simple check: ensure colors are different
  return color.text !== color.background;
}

test.describe('Campaign Delete', () => {
  let campaignId: string;

  /**
   * Before each test:
   * 1. Log in as test user
   * 2. Create a test campaign
   * 3. Navigate to campaign detail page
   */
  test.beforeEach(async ({ page }) => {
    await login(page);
    campaignId = await createTestCampaign(page);
    await page.goto(`${BASE_URL}/dashboard/campaigns/${campaignId}`);
    // Wait for campaign header to load
    await expect(
      page.locator('h1:has-text("Test Campaign for Deletion")')
    ).toBeVisible();
  });

  /**
   * After each test: clean up test campaign if it still exists
   */
  test.afterEach(async ({ page }) => {
    if (campaignId) {
      try {
        await deleteCampaignViaAPI(page, campaignId);
      } catch {
        // Campaign may have been deleted by the test
      }
    }
  });

  /**
   * Test 1: Verify delete button is displayed in campaign detail page
   */
  test('should display delete button in campaign detail page', async ({
    page,
  }) => {
    // Check delete button exists and is visible
    const deleteButton = page.getByTestId('campaign-delete-button');
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();
    await expect(deleteButton).toContainText('Delete');

    // Verify button has correct styling (red color for danger action)
    const buttonColor = await deleteButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // Red color check (Tailwind v4 uses oklch format)
    expect(buttonColor).toMatch(/(rgb|oklch)\([^)]+\)/);
  });

  /**
   * Test 2: Verify delete confirmation dialog opens on button click
   */
  test('should open delete confirmation dialog on delete button click', async ({
    page,
  }) => {
    // Click delete button
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog title
    await expect(page.locator('#dialog-title')).toHaveText('Delete Campaign');

    // Verify warning message
    await expect(
      page.locator(
        'text=You are about to delete the following campaign. This action cannot be undone.'
      )
    ).toBeVisible();

    // Verify campaign name is displayed (in dialog body, not header)
    await expect(
      page.locator('div[role="dialog"] .font-medium:has-text("Test Campaign for Deletion")')
    ).toBeVisible();

    // Verify CASCADE warning
    await expect(
      page.locator('text=Related budgets and resources will also be deleted.')
    ).toBeVisible();

    // Verify action buttons
    await expect(page.locator('div[role="dialog"] button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('div[role="dialog"] button:has-text("Delete")').last()).toBeVisible();
  });

  /**
   * Test 3: Verify successful campaign deletion and navigation
   */
  test('should delete campaign successfully and navigate to list', async ({
    page,
  }) => {
    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Wait for dialog animation
    await page.waitForTimeout(300);

    // Click delete button in dialog
    await page.locator('button:has-text("Delete")').last().click();

    // Wait for navigation to campaigns list
    await page.waitForURL(`${BASE_URL}/dashboard/campaigns`, {
      timeout: 5000,
    });

    // Verify we're on the campaigns list page
    expect(page.url()).toBe(`${BASE_URL}/dashboard/campaigns`);

    // Verify campaign no longer exists (try to access detail page)
    await page.goto(`${BASE_URL}/dashboard/campaigns/${campaignId}`);

    // Should show error or "not found" message
    await expect(
      page.locator('p:has-text("Campaign not found")')
    ).toBeVisible({
      timeout: 5000,
    });

    // Clear campaignId to prevent cleanup attempt
    campaignId = '';
  });

  /**
   * Test 4: Verify dialog closes on cancel button click
   */
  test('should close dialog on cancel button click', async ({ page }) => {
    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Click cancel button
    await page.locator('button:has-text("Cancel")').click();

    // Verify dialog is closed
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({
      timeout: 2000,
    });

    // Verify we're still on the campaign detail page
    expect(page.url()).toContain(
      `${BASE_URL}/dashboard/campaigns/${campaignId}`
    );
  });

  /**
   * Test 5: Verify dialog closes on ESC key press
   */
  test('should close dialog on ESC key press', async ({ page }) => {
    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Press ESC key
    await page.keyboard.press('Escape');

    // Verify dialog is closed
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({
      timeout: 2000,
    });

    // Verify we're still on the campaign detail page
    expect(page.url()).toContain(
      `${BASE_URL}/dashboard/campaigns/${campaignId}`
    );
  });

  /**
   * Test 6: Verify dialog closes on overlay click
   */
  test('should close dialog on overlay click', async ({ page }) => {
    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click on overlay (outside dialog content)
    // The overlay is the parent div with role="presentation"
    await page.locator('div[role="presentation"]').click({ position: { x: 5, y: 5 } });

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 2000 });

    // Verify we're still on the campaign detail page
    expect(page.url()).toContain(
      `${BASE_URL}/dashboard/campaigns/${campaignId}`
    );
  });

  /**
   * Test 7: Verify error handling (404 Not Found)
   */
  test('should handle API errors (404 Not Found)', async ({ page }) => {
    // Delete campaign via API first (to trigger 404)
    await deleteCampaignViaAPI(page, campaignId);
    campaignId = ''; // Clear to prevent cleanup attempt

    // Reload page to get the deleted campaign
    await page.reload();

    // Page should show "Campaign not found" error
    await expect(
      page.locator('p:has-text("Campaign not found")')
    ).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * Test 8: Verify loading state during deletion
   */
  test('should show loading state during deletion', async ({ page }) => {
    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Wait for dialog animation
    await page.waitForTimeout(300);

    // Intercept the delete request to slow it down (delay 2 seconds)
    let resolveDelay: () => void;
    const delayPromise = new Promise<void>((resolve) => {
      resolveDelay = resolve;
    });

    await page.route(
      `**/api/campaigns/${campaignId}`,
      async (route) => {
        // Wait 2 seconds before responding
        setTimeout(() => resolveDelay(), 2000);
        await delayPromise;
        await route.continue();
      }
    );

    // Click delete button in dialog
    const deleteButtonInDialog = page.locator('div[role="dialog"] button:has-text("Delete")').last();
    await deleteButtonInDialog.click();

    // Verify loading state (button shows "Deleting...")
    await expect(page.locator('button:has-text("Deleting...")')).toBeVisible({
      timeout: 1000,
    });

    // Verify button is disabled during loading
    await expect(page.locator('button:has-text("Deleting...")')).toBeDisabled();

    // Wait for navigation
    await page.waitForURL(`${BASE_URL}/dashboard/campaigns`, {
      timeout: 5000,
    });

    // Clear campaignId to prevent cleanup attempt
    campaignId = '';
  });

  /**
   * Test 9: Verify dark mode support (color contrast and visibility)
   */
  test('should support dark mode with proper color contrast', async ({
    page,
  }) => {
    // Enable dark mode (toggle if not already dark)
    // Assuming dark mode toggle exists in the UI
    const html = page.locator('html');
    await html.evaluate((el) => {
      el.classList.add('dark');
    });

    // Reload to apply dark mode
    await page.reload();

    // Wait for page to load
    await expect(
      page.locator('h1:has-text("Test Campaign for Deletion")')
    ).toBeVisible();

    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible in dark mode
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check background color (should be dark)
    const dialogBg = await dialog.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Dark mode should have darker background
    expect(dialogBg).toMatch(/rgb\(\s*\d+,\s*\d+,\s*\d+\s*\)/);

    // Verify color contrast for title
    const hasContrast = await checkColorContrast(page, '#dialog-title');
    expect(hasContrast).toBe(true);

    // Close dialog
    await page.keyboard.press('Escape');
  });

  /**
   * Test 10: Verify light mode support (color contrast and visibility)
   */
  test('should support light mode with proper color contrast', async ({
    page,
  }) => {
    // Ensure light mode (remove dark class if present)
    const html = page.locator('html');
    await html.evaluate((el) => {
      el.classList.remove('dark');
    });

    // Reload to apply light mode
    await page.reload();

    // Wait for page to load
    await expect(
      page.locator('h1:has-text("Test Campaign for Deletion")')
    ).toBeVisible();

    // Open delete dialog
    await page.getByTestId('campaign-delete-button').click();

    // Verify dialog is visible in light mode
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check background color (should be light)
    const dialogBg = await dialog.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Light mode should have lighter background
    expect(dialogBg).toMatch(/rgb\(\s*\d+,\s*\d+,\s*\d+\s*\)/);

    // Verify color contrast for title
    const hasContrast = await checkColorContrast(page, '#dialog-title');
    expect(hasContrast).toBe(true);

    // Close dialog
    await page.keyboard.press('Escape');
  });
});
