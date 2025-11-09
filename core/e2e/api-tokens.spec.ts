/**
 * E2E Tests for API Tokens Management
 *
 * Test scenarios:
 * 1. Token creation flow (10 tests)
 * 2. Token list display (3 tests)
 * 3. Token detail display (3 tests)
 * 4. Token revocation (3 tests)
 * 5. Validation (5 tests)
 */

import { test, expect } from '@playwright/test';

/**
 * Helper: Login as admin user
 */
async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

/**
 * Helper: Navigate to API Tokens settings
 */
async function navigateToTokensSettings(page: any) {
  await page.goto('/dashboard/settings/tokens');
  await expect(page).toHaveURL('/dashboard/settings/tokens');
}

/**
 * Helper: Get contrast ratio between two RGB colors
 */
function getContrastRatio(rgb1: string, rgb2: string): number {
  const parseRgb = (rgb: string): number[] => {
    const match = rgb.match(/\d+/g);
    return match ? match.map(Number) : [0, 0, 0];
  };

  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const normalized = c / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    // Ensure values are defined
    return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
  };

  const [r1, g1, b1] = parseRgb(rgb1);
  const [r2, g2, b2] = parseRgb(rgb2);

  const l1 = getLuminance(r1 ?? 0, g1 ?? 0, b1 ?? 0);
  const l2 = getLuminance(r2 ?? 0, g2 ?? 0, b2 ?? 0);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('API Tokens Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('Token Creation Flow', () => {
    test('should open create dialog when clicking Create Token button', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Click Create Token button
      await page.click('button:has-text("Create Token")');

      // Verify dialog is visible
      await expect(page.locator('h3:has-text("Create API Token")')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Wait for dialog to be visible
      await expect(page.locator('h3:has-text("Create API Token")')).toBeVisible();

      // Submit empty form (click the Create Token button inside the dialog)
      await page.locator('form button[type="submit"]:has-text("Create Token")').click();

      // Check for validation errors
      await expect(page.locator('text=Name is required')).toBeVisible();
      await expect(page.locator('text=At least one scope is required')).toBeVisible();
    });

    test('should validate name length', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill name with 101 characters
      const longName = 'a'.repeat(101);
      await page.fill('input#token-name', longName);

      // Verify max length is enforced (input should only have 100 chars)
      const nameValue = await page.inputValue('input#token-name');
      expect(nameValue.length).toBeLessThanOrEqual(100);
    });

    test('should validate expiration date is in future', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill form with past date
      await page.fill('input#token-name', 'Test Token');
      await page.check('input[type="checkbox"]');
      await page.fill('input#token-expires-at', '2020-01-01');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Token")');

      // Check for validation error
      await expect(page.locator('text=Expiration date must be in the future')).toBeVisible();
    });

    test('should create token successfully and display plain text token', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill form
      await page.fill('input#token-name', `E2E Test Token ${Date.now()}`);
      await page.check('input[type="checkbox"]');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Token")');

      // Wait for token to be created
      await page.waitForTimeout(1000);

      // Verify dialog title changed
      await expect(page.locator('h3:has-text("Token Created Successfully")')).toBeVisible();

      // Verify warning message is displayed
      await expect(page.locator('text=This token will only be shown once')).toBeVisible();

      // Verify token is displayed (starts with "drowltok_") - look in dialog only
      const dialog = page.locator('[role="dialog"]');
      const tokenElement = dialog.locator('code').filter({ hasText: 'drowltok_' });
      await expect(tokenElement).toBeVisible();

      const tokenText = await tokenElement.textContent();
      expect(tokenText).toMatch(/^drowltok_[A-Za-z0-9_-]{32}$/);
    });

    test('should copy token to clipboard', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill and submit form
      await page.fill('input#token-name', `E2E Copy Test ${Date.now()}`);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');

      await page.waitForTimeout(1000);

      // Get token text from dialog
      const dialog = page.locator('[role="dialog"]');
      const tokenText = await dialog.locator('code').filter({ hasText: 'drowltok_' }).textContent();

      // Click copy button in dialog
      await dialog.locator('button[title="Copy to clipboard"]').click();

      // Verify "Copied to clipboard!" message appears
      await expect(page.locator('text=Copied to clipboard!')).toBeVisible();

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(tokenText);
    });

    test('should close dialog after token is created', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill and submit form
      await page.fill('input#token-name', `E2E Close Test ${Date.now()}`);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');

      await page.waitForTimeout(1000);

      // Click Close button
      await page.click('button:has-text("Close")');

      // Verify dialog is closed
      await expect(page.locator('h3:has-text("Token Created Successfully")')).not.toBeVisible();
    });

    test('should display new token in list after creation', async ({ page }) => {
      await navigateToTokensSettings(page);

      const tokenName = `E2E List Test ${Date.now()}`;

      // Create token
      await page.click('button:has-text("Create Token")');
      await page.fill('input#token-name', tokenName);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');

      await page.waitForTimeout(1000);

      // Close dialog
      await page.click('button:has-text("Close")');

      // Wait for page to reload
      await page.waitForTimeout(1000);

      // Reload page to see new token
      await page.reload();

      // Verify token appears in list
      await expect(page.locator(`text=${tokenName}`)).toBeVisible();
    });

    test('should verify dark mode and light mode color contrast in dialog', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Check light mode - open dialog
      await page.click('button:has-text("Create Token")');
      await page.waitForTimeout(300);

      const dialogTitle = page.locator('h3:has-text("Create API Token")');
      const lightTitleColor = await dialogTitle.evaluate((el) =>
        window.getComputedStyle(el).color
      );
      const lightBgColor = await dialogTitle.evaluate((el) => {
        let parent = el.parentElement;
        while (parent) {
          const bg = window.getComputedStyle(parent).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
          parent = parent.parentElement;
        }
        return 'rgb(255, 255, 255)';
      });

      const lightContrast = getContrastRatio(lightTitleColor, lightBgColor);
      expect(lightContrast).toBeGreaterThan(4.5); // WCAG AA standard

      // Close dialog to access dark mode toggle
      await page.click('button:has-text("Cancel")');
      await page.waitForTimeout(300);

      // Switch to dark mode
      const darkModeToggle = page.locator('button[data-testid="dark-mode-toggle"]');
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      // Reopen dialog in dark mode
      await page.click('button:has-text("Create Token")');
      await page.waitForTimeout(300);

      // Check dark mode contrast
      const darkTitleColor = await dialogTitle.evaluate((el) =>
        window.getComputedStyle(el).color
      );
      const darkBgColor = await dialogTitle.evaluate((el) => {
        let parent = el.parentElement;
        while (parent) {
          const bg = window.getComputedStyle(parent).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
          parent = parent.parentElement;
        }
        return 'rgb(0, 0, 0)';
      });

      const darkContrast = getContrastRatio(darkTitleColor, darkBgColor);
      expect(darkContrast).toBeGreaterThan(4.5); // WCAG AA standard
    });

    test('should check for design alignment issues in dialog', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Get dialog element
      const dialog = page.locator('div[role="dialog"]');

      // Check dialog is centered
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).toBeTruthy();

      if (dialogBox) {
        const viewportSize = page.viewportSize();
        if (viewportSize) {
          const centerX = viewportSize.width / 2;
          const dialogCenterX = dialogBox.x + dialogBox.width / 2;

          // Dialog should be approximately centered (within 10% tolerance)
          const tolerance = viewportSize.width * 0.1;
          expect(Math.abs(dialogCenterX - centerX)).toBeLessThan(tolerance);
        }
      }

      // Check form elements are aligned
      const nameInput = page.locator('input#token-name');
      const firstCheckbox = page.locator('input[type="checkbox"]').first();

      const nameBox = await nameInput.boundingBox();
      const checkboxBox = await firstCheckbox.boundingBox();

      expect(nameBox).toBeTruthy();
      expect(checkboxBox).toBeTruthy();

      if (nameBox && checkboxBox) {
        // Both should have similar left alignment
        expect(Math.abs(nameBox.x - checkboxBox.x)).toBeLessThan(50);
      }
    });
  });

  test.describe('Token List Display', () => {
    test('should display token list with correct columns', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Verify table headers
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Token Prefix")')).toBeVisible();
      await expect(page.locator('th:has-text("Scopes")')).toBeVisible();
      await expect(page.locator('th:has-text("Last Used")')).toBeVisible();
      await expect(page.locator('th:has-text("Expires At")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should filter tokens by status', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Select "Active" filter
      await page.selectOption('select#status-filter', 'active');
      await page.waitForTimeout(500);

      // Verify URL contains status parameter
      expect(page.url()).toContain('status=active');
    });

    test('should navigate between pages', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Check if pagination exists
      const pagination = page.locator('nav[aria-label="Pagination"]');

      if (await pagination.isVisible()) {
        // Click page 2 if it exists
        const page2Button = page.locator('button:has-text("2")');

        if (await page2Button.isVisible()) {
          await page2Button.click();
          await page.waitForTimeout(500);

          // Verify URL contains page parameter
          expect(page.url()).toContain('page=2');
        }
      }
    });
  });

  test.describe('Token Detail Display', () => {
    test('should open token detail dialog when clicking view button', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Click first view button (eye icon)
      const viewButton = page.locator('button[title="View details"]').first();

      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Verify detail dialog is visible
        await expect(page.locator('h3:has-text("Token Details")')).toBeVisible();
      }
    });

    test('should display token information in detail dialog', async ({ page }) => {
      await navigateToTokensSettings(page);

      const viewButton = page.locator('button[title="View details"]').first();

      if (await viewButton.isVisible()) {
        await viewButton.click();
        await page.waitForTimeout(500);

        // Verify token details are displayed
        await expect(page.locator('dt:has-text("Name")')).toBeVisible();
        await expect(page.locator('dt:has-text("Token Prefix")')).toBeVisible();
        await expect(page.locator('dt:has-text("Scopes")')).toBeVisible();
        await expect(page.locator('dt:has-text("Status")')).toBeVisible();
      }
    });

    test('should only display token prefix, not full token', async ({ page }) => {
      await navigateToTokensSettings(page);

      const viewButton = page.locator('button[title="View details"]').first();

      if (await viewButton.isVisible()) {
        await viewButton.click();
        await page.waitForTimeout(500);

        // Get token prefix element
        const tokenPrefix = page.locator('code').filter({ hasText: 'drowltok_' });

        if (await tokenPrefix.isVisible()) {
          const prefixText = await tokenPrefix.textContent();

          // Verify it ends with "..." (truncated)
          expect(prefixText).toMatch(/drowltok_[A-Za-z0-9_-]+\.\.\./);

          // Verify it's not a full 41-character token
          expect(prefixText && prefixText.length).toBeLessThan(30);
        }
      }
    });
  });

  test.describe('Token Revocation', () => {
    test('should open revoke confirmation dialog', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Find an active token's revoke button
      const revokeButton = page.locator('button[title="Revoke token"]').first();

      if (await revokeButton.isVisible()) {
        await revokeButton.click();

        // Verify confirmation dialog is visible
        await expect(page.locator('h3:has-text("Revoke API Token?")')).toBeVisible();
        await expect(page.locator('text=Webhooks using this token will stop working')).toBeVisible();
      }
    });

    test('should revoke token successfully', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Create a new token to revoke
      const tokenName = `E2E Revoke Test ${Date.now()}`;
      await page.click('button:has-text("Create Token")');
      await page.fill('input#token-name', tokenName);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Close")');
      await page.reload();
      await page.waitForTimeout(500);

      // Find the token and click revoke
      const tokenRow = page.locator(`tr:has-text("${tokenName}")`);
      await tokenRow.locator('button[title="Revoke token"]').click();

      // Confirm revocation
      await page.click('button:has-text("Revoke Token")');
      await page.waitForTimeout(1000);

      // Reload and verify status changed
      await page.reload();
      await page.waitForTimeout(500);

      // Check if token status is "Revoked"
      const statusBadge = tokenRow.locator('span:has-text("Revoked")');
      await expect(statusBadge).toBeVisible();
    });

    test('should not show revoke button for revoked tokens', async ({ page }) => {
      await navigateToTokensSettings(page);

      // Filter by revoked tokens
      await page.selectOption('select#status-filter', 'revoked');
      await page.waitForTimeout(500);

      // Check if any rows exist
      const tableRows = page.locator('tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        // Verify revoke button is not present in revoked token rows
        const revokeButtons = tableRows.first().locator('button[title="Revoke token"]');
        await expect(revokeButtons).not.toBeVisible();
      }
    });
  });

  test.describe('Validation', () => {
    test('should require token name', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Leave name empty, but fill scopes
      await page.check('input[type="checkbox"]');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Token")');

      // Verify error message
      await expect(page.locator('text=Name is required')).toBeVisible();
    });

    test('should enforce name length limit', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Try to fill name with 101 characters
      const longName = 'a'.repeat(101);
      await page.fill('input#token-name', longName);

      // Verify input is truncated to 100
      const actualValue = await page.inputValue('input#token-name');
      expect(actualValue.length).toBeLessThanOrEqual(100);
    });

    test('should require at least one scope', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill name but don't select scopes
      await page.fill('input#token-name', 'Test Token');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Token")');

      // Verify error message
      await expect(page.locator('text=At least one scope is required')).toBeVisible();
    });

    test('should validate future expiration date', async ({ page }) => {
      await navigateToTokensSettings(page);
      await page.click('button:has-text("Create Token")');

      // Fill form with past date
      await page.fill('input#token-name', 'Test Token');
      await page.check('input[type="checkbox"]');
      await page.fill('input#token-expires-at', '2020-01-01');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Token")');

      // Verify error message
      await expect(page.locator('text=Expiration date must be in the future')).toBeVisible();
    });

    test('should prevent duplicate token names', async ({ page }) => {
      await navigateToTokensSettings(page);

      const duplicateName = `Duplicate Test ${Date.now()}`;

      // Create first token
      await page.click('button:has-text("Create Token")');
      await page.fill('input#token-name', duplicateName);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Close")');

      // Try to create second token with same name
      await page.click('button:has-text("Create Token")');
      await page.fill('input#token-name', duplicateName);
      await page.check('input[type="checkbox"]');
      await page.click('button[type="submit"]:has-text("Create Token")');
      await page.waitForTimeout(1000);

      // Verify error response (should show error in dialog or as toast)
      // The exact error handling depends on implementation
      const errorText = page.locator('text=/already exists|duplicate/i');
      const isErrorVisible = await errorText.isVisible();

      // If no error is shown in dialog, check if creation failed (no success state)
      if (!isErrorVisible) {
        const successTitle = page.locator('h3:has-text("Token Created Successfully")');
        const isSuccess = await successTitle.isVisible();
        expect(isSuccess).toBe(false); // Should not succeed
      }
    });
  });
});
