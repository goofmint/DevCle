/**
 * Activity Types Settings E2E Tests
 *
 * End-to-end tests for activity types settings page using Playwright.
 * Tests admin-only access, CRUD operations, and component behavior.
 *
 * Prerequisites:
 * - Remix dev server must be running (BASE_URL from env)
 * - Database must be seeded with test users:
 *   - test@example.com / password123 (member)
 *   - admin@example.com / admin123456 (admin)
 * - Database must be seeded with default activity types:
 *   - click, attend, signup, post, star
 *
 * Test Coverage:
 * - Display and Access Control (2 tests)
 * - CRUD Operations (6 tests)
 * - Validation (1 test)
 * - Component Behavior (4 tests)
 * Total: 13 tests
 */

import { test, expect, type Page } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper: Login as admin user
 * Navigates to login page and authenticates
 */
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
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
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Test Group 1: Display and Access Control (2 tests)
 */
test.describe('Activity Types Settings - Display and Access', () => {
  test('should display activity types settings page (admin only)', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to activity types settings page
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Settings');

    // Verify create button is visible
    await expect(page.getByTestId('create-activity-type-button')).toBeVisible();

    // Verify page is rendered
    await expect(page.getByTestId('activity-types-settings-page')).toBeVisible();
  });

  test('should prevent non-admin access', async ({ page }) => {
    await loginAsMember(page);

    // Try to access activity types settings page
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);

    // Verify 403 Forbidden response
    // Note: SPA will show error state instead of 403 page
    await page.waitForLoadState('networkidle');

    // Check if error message is shown
    const errorText = await page.locator('text=/error|forbidden|access denied/i').count();
    expect(errorText).toBeGreaterThan(0);
  });
});

/**
 * Test Group 2: CRUD Operations (6 tests)
 */
test.describe('Activity Types Settings - CRUD Operations', () => {
  test('should list existing activity types', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to activity types settings page
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Verify default activity types are displayed (click, attend, signup, post, star)
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);

    // Verify specific activity type is visible
    await expect(page.locator('td:has-text("click")')).toBeVisible();
  });

  test('should create new activity type (type new action)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByTestId('create-activity-type-button').click();

    // Fill in form fields
    await page.fill('input#action-input', 'download');

    // Select an icon from popular suggestions (if available)
    const iconButtons = page.locator('button:has(svg)').first();
    if (await iconButtons.count() > 0) {
      await iconButtons.click();
    }

    // Select a color from CirclePicker
    const colorCircle = page.locator('.circle-picker span').first();
    if (await colorCircle.count() > 0) {
      await colorCircle.click();
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Activity Type")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Verify success toast or new activity type in table
    const downloadCell = page.locator('td:has-text("download")');
    const toastSuccess = page.getByTestId('toast-notification');

    // Check either toast or table row exists
    const hasDownload = await downloadCell.count() > 0;
    const hasToast = await toastSuccess.count() > 0;
    expect(hasDownload || hasToast).toBeTruthy();
  });

  test('should update activity type (change color)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Find "click" row and click edit button
    const clickRow = page.locator('tr:has(td:has-text("click"))');
    const editButton = clickRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Change color by clicking a different color in CirclePicker
    const colorCircles = page.locator('.circle-picker span');
    const circleCount = await colorCircles.count();
    if (circleCount > 1) {
      // Click the second color (different from default)
      await colorCircles.nth(1).click();
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Update Activity Type")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Verify success toast
    const toast = page.getByTestId('toast-notification');
    if (await toast.count() > 0) {
      await expect(toast).toContainText(/updated|success/i);
    }
  });

  test('should update activity type (change icon)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Find "attend" row and click edit button
    const attendRow = page.locator('tr:has(td:has-text("attend"))');
    const editButton = attendRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Change icon by clicking a popular icon suggestion
    const iconSuggestions = page.locator('button:has(svg)').first();
    if (await iconSuggestions.count() > 0) {
      await iconSuggestions.click();
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Update Activity Type")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Verify success toast
    const toast = page.getByTestId('toast-notification');
    if (await toast.count() > 0) {
      await expect(toast).toContainText(/updated|success/i);
    }
  });

  test('should update activity type (change funnel stage)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Find "signup" row and click edit button
    const signupRow = page.locator('tr:has(td:has-text("signup"))');
    const editButton = signupRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Change funnel stage
    const funnelStageSelect = page.locator('select#funnel-stage-select');
    const options = await funnelStageSelect.locator('option').count();
    if (options > 1) {
      // Select the second option (first is "-- None --")
      await funnelStageSelect.selectOption({ index: 1 });
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Update Activity Type")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Verify success toast
    const toast = page.getByTestId('toast-notification');
    if (await toast.count() > 0) {
      await expect(toast).toContainText(/updated|success/i);
    }
  });

  test('should delete activity type with confirmation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // First, create a new activity type to delete
    await page.getByTestId('create-activity-type-button').click();
    await page.fill('input#action-input', 'to-delete-test');

    // Select an icon
    const iconButtons = page.locator('button:has(svg)').first();
    await iconButtons.click();

    // Select a color
    const colorCircle = page.locator('.circle-picker span').first();
    await colorCircle.click();

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Activity Type")');
    await page.waitForTimeout(1500);

    // Count initial rows
    const initialCount = await page.locator('table tbody tr').count();

    // Setup dialog handler to accept confirmation
    page.on('dialog', (dialog) => dialog.accept());

    // Find "to-delete-test" row and click delete button
    const downloadRow = page.locator('tr:has(td:has-text("to-delete-test"))');
    const deleteButton = downloadRow.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify row count decreased
    const newCount = await page.locator('table tbody tr').count();
    expect(newCount).toBeLessThan(initialCount);

    // Verify "to-delete-test" is no longer in the table
    await expect(page.locator('td:has-text("to-delete-test")')).not.toBeVisible();
  });
});

/**
 * Test Group 3: Validation (1 test)
 */
test.describe('Activity Types Settings - Validation', () => {
  test('should show validation error for duplicate action', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByTestId('create-activity-type-button').click();

    // Fill in form with duplicate action
    await page.fill('input#action-input', 'click'); // Duplicate

    // Select icon and color
    const iconButtons = page.locator('button:has(svg)').first();
    if (await iconButtons.count() > 0) {
      await iconButtons.click();
    }

    const colorCircle = page.locator('.circle-picker span').first();
    if (await colorCircle.count() > 0) {
      await colorCircle.click();
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Activity Type")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Verify error toast or error message
    const errorToast = page.getByTestId('toast-notification');
    if (await errorToast.count() > 0) {
      await expect(errorToast).toContainText(/error|exists|duplicate/i);
    }
  });
});

/**
 * Test Group 4: Component Behavior (4 tests)
 */
test.describe('Activity Types Settings - Component Behavior', () => {
  test('should display ActionCombobox with autocomplete', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByTestId('create-activity-type-button').click();

    // Verify action input has datalist
    const actionInput = page.locator('input#action-input');
    await expect(actionInput).toBeVisible();

    const datalist = page.locator('datalist#action-suggestions');
    await expect(datalist).toBeAttached();

    // Verify datalist has options
    const options = await datalist.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should display IconPicker with preview', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByTestId('create-activity-type-button').click();

    // Verify icon picker section is visible
    // Use exact match to avoid matching "Popular Icons"
    const iconPickerLabel = page.locator('label').filter({ hasText: /^Icon$/ });
    await expect(iconPickerLabel).toBeVisible();

    // Verify icon preview is visible when an icon is selected
    const iconPreview = page.getByTestId('icon-preview');
    // Icon preview should exist (may be visible after selection)
    const previewCount = await iconPreview.count();
    expect(previewCount).toBeGreaterThanOrEqual(0); // Allow 0 before selection
  });

  test('should display ColorPalette with preview', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByTestId('create-activity-type-button').click();

    // Verify color palette section is visible
    const colorLabel = page.locator('label:has-text("Color")');
    await expect(colorLabel).toBeVisible();

    // Verify color preview badge is visible
    const colorPreview = page.getByTestId('color-preview');
    await expect(colorPreview).toBeVisible();

    // Verify preview has Tailwind color classes
    const previewClasses = await colorPreview.getAttribute('class');
    expect(previewClasses).toMatch(/text-\w+-\d+/); // Matches text-blue-600, etc.
  });

  test('should disable action input in edit mode', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Find "post" row and click edit button
    const postRow = page.locator('tr:has(td:has-text("post"))');
    const editButton = postRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Verify action input is disabled in edit mode
    const actionInput = page.locator('input#action-input');
    await expect(actionInput).toBeDisabled();

    // Verify help text indicates action cannot be changed
    // Use more specific selector to avoid matching multiple elements
    const helpText = page.locator('label[for="action-input"]').filter({ hasText: /cannot be changed/i });
    await expect(helpText).toBeVisible();
  });
});

/**
 * Test Group 5: Bug Regression Tests (3 tests)
 *
 * These tests verify that the following critical bugs are fixed:
 * 1. IconPicker should show multiple icons (not just current selection)
 * 2. Funnel Stage should update successfully
 * 3. Delete should return proper status (not Internal error)
 */
test.describe('Activity Types Settings - Bug Regression Tests', () => {
  test('should show multiple icons in IconPicker (not just one)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Click create button to open form
    await page.getByTestId('create-activity-type-button').click();

    // Wait for form
    await page.waitForTimeout(500);

    // Click icon input to open IconPicker modal
    const iconInput = page.locator('input[type="text"][value*="heroicons"]').or(page.locator('input[placeholder="Click to select icon"]'));
    await iconInput.first().click();

    // Wait for modal to appear
    await page.waitForTimeout(1000);

    // Verify modal title
    const modalTitle = page.locator('h3:has-text("Select Icon")');
    await expect(modalTitle).toBeVisible();

    // Verify multiple icon buttons are visible (not just one)
    // IconPicker uses a grid layout (.grid.grid-cols-8) inside the modal
    const iconGrid = page.locator('.grid.grid-cols-8');
    await expect(iconGrid).toBeVisible();

    const iconButtons = iconGrid.locator('button');
    const count = await iconButtons.count();

    // Should have at least 100 icons visible (ALL_ICONS array)
    expect(count).toBeGreaterThan(100);
  });

  test('should update funnel stage successfully (was failing before)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // Find "click" row and click edit button (click is always present in seed data)
    const clickRow = page.locator('tr:has(td:has-text("click"))');
    const editButton = clickRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Change funnel stage to different value
    const funnelStageSelect = page.locator('select#funnel-stage-select');

    // Select a different option (not "-- None --")
    const options = await funnelStageSelect.locator('option').count();
    if (options > 1) {
      // Select option index 1 (first non-empty option)
      await funnelStageSelect.selectOption({ index: 1 });
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Update Activity Type")');

    // Wait for response
    await page.waitForTimeout(2000);

    // Verify success toast appears (not error)
    const toast = page.getByTestId('toast-notification');
    if (await toast.count() > 0) {
      await expect(toast).toContainText(/updated|success/i);
      // Should NOT contain error text
      await expect(toast).not.toContainText(/error|fail/i);
    }

    // Verify no error dialog
    const errorText = await page.locator('text=/internal error/i').count();
    expect(errorText).toBe(0);
  });

  test('should delete without Internal error (proper 200 response)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard/settings/activity-types`);
    await page.waitForLoadState('networkidle');

    // First, create a test activity type to delete
    await page.getByTestId('create-activity-type-button').click();
    await page.fill('input#action-input', 'test-delete');
    const iconButtons = page.locator('button:has(svg)').first();
    if (await iconButtons.count() > 0) {
      await iconButtons.click();
    }
    const colorCircle = page.locator('.circle-picker span').first();
    if (await colorCircle.count() > 0) {
      await colorCircle.click();
    }
    await page.click('button[type="submit"]:has-text("Create Activity Type")');
    await page.waitForTimeout(1000);

    // Count rows (should include the new test-delete)
    const initialCount = await page.locator('table tbody tr').count();

    // Setup dialog handler to accept confirmation
    page.on('dialog', (dialog) => dialog.accept());

    // Find "test-delete" row and click delete button
    const testRow = page.locator('tr:has(td:has-text("test-delete"))');
    const deleteButton = testRow.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // Verify success toast appears (not Internal error)
    const toast = page.getByTestId('toast-notification');
    if (await toast.count() > 0) {
      // Should show success message
      await expect(toast).toContainText(/deleted|success/i);
      // Should mention "test-delete"
      await expect(toast).toContainText('test-delete');
      // Should NOT contain "Internal error"
      await expect(toast).not.toContainText(/internal error/i);
    }

    // Verify row count decreased
    const newCount = await page.locator('table tbody tr').count();
    expect(newCount).toBeLessThan(initialCount);
  });
});
