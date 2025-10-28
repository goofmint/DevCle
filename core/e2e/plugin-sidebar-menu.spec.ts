/**
 * Plugin Sidebar Menu E2E Tests
 *
 * End-to-end tests for plugin sidebar menu display using Playwright.
 * Tests menu item rendering, hierarchical structure, icons, and design consistency.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users and plugins
 * - At least one plugin with menu items must be enabled
 *
 * Test scenarios:
 * 1. Plugin menu items appear in sidebar
 * 2. Hierarchical menu items (children) are rendered correctly
 * 3. Menu items have proper icons (Iconify icons)
 * 4. Active state highlighting works
 * 5. Dark/light mode color contrast is correct
 * 6. Design is consistent (alignment, spacing, nesting)
 */

import { test, expect, type Page } from '@playwright/test';

// Base URL for the application (use HTTPS for E2E tests)
const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

// Test credentials (use environment variables with defaults for security)
const E2E_TEST_EMAIL = process.env['E2E_TEST_EMAIL'] ?? 'test@example.com';
const E2E_TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'] ?? 'password123';

/**
 * Helper: Login as test user
 *
 * Logs in with test credentials and navigates to dashboard.
 */
async function loginAndNavigate(page: Page) {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[name="email"]', E2E_TEST_EMAIL);
  await page.fill('input[name="password"]', E2E_TEST_PASSWORD);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for dashboard redirect
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Test: Sidebar renders and contains core navigation items
 */
test('sidebar renders with core navigation items', async ({ page }) => {
  await loginAndNavigate(page);

  // Verify sidebar exists
  const sidebar = page.locator('aside[data-testid="sidebar"]');
  await expect(sidebar).toBeVisible();

  // Verify core navigation items exist
  await expect(page.locator('a[href="/dashboard"]', { hasText: 'Overview' })).toBeVisible();
  await expect(page.locator('a[href="/dashboard/developers"]', { hasText: 'Developers' })).toBeVisible();
  await expect(page.locator('a[href="/dashboard/campaigns"]', { hasText: 'Campaigns' })).toBeVisible();
  await expect(page.locator('a[href="/dashboard/funnel"]', { hasText: 'Funnel' })).toBeVisible();
  await expect(page.locator('a[href="/dashboard/plugins"]', { hasText: 'Plugins' })).toBeVisible();
});

/**
 * Test: drowl-plugin-test menu items appear in sidebar
 *
 * This test verifies that the drowl-plugin-test plugin menus are displayed correctly.
 * The plugin has 3 menu items: Overview, Settings, Activity Logs
 * They are grouped under a collapsible plugin name header.
 */
test('drowl-plugin-test menu items appear in sidebar', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Verify plugin name header exists as collapsible button
  const pluginHeader = sidebar.locator('button:has-text("drowl-plugin-test")');
  await expect(pluginHeader).toBeVisible();

  // Verify chevron icon exists (indicates collapsible)
  const chevronIcon = pluginHeader.locator('svg').last();
  await expect(chevronIcon).toBeVisible();

  // Verify child menu items exist within the group
  // The group has aria-label="drowl-plugin-test submenu"
  const menuGroup = sidebar.locator('div[role="group"][aria-label="drowl-plugin-test submenu"]');

  // Verify Overview menu item exists with correct link
  const overviewLink = menuGroup.locator('a[href="/dashboard/plugins/drowl-plugin-test/overview"]');
  await expect(overviewLink).toBeVisible();
  await expect(overviewLink).toContainText('Overview');

  // Verify Settings menu item exists with correct link
  const settingsLink = menuGroup.locator('a[href="/dashboard/plugins/drowl-plugin-test/settings"]');
  await expect(settingsLink).toBeVisible();
  await expect(settingsLink).toContainText('Settings');

  // Verify Activity Logs menu item exists with correct link
  const logsLink = menuGroup.locator('a[href="/dashboard/plugins/drowl-plugin-test/logs"]');
  await expect(logsLink).toBeVisible();
  await expect(logsLink).toContainText('Activity Logs');
});

/**
 * Test: Plugin name header is collapsible
 *
 * Verifies that clicking the plugin name header toggles visibility of child menu items.
 */
test('plugin name header is collapsible', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Find plugin header button
  const pluginHeader = sidebar.locator('button:has-text("drowl-plugin-test")');
  await expect(pluginHeader).toBeVisible();

  // Verify child menu items are visible by default (expanded)
  const menuGroup = sidebar.locator('div[role="group"][aria-label="drowl-plugin-test submenu"]');
  await expect(menuGroup).toBeVisible();

  // Verify chevron icon is pointing down (expanded state)
  const chevronDown = pluginHeader.locator('svg[class*="w-4"]').last();
  await expect(chevronDown).toBeVisible();

  // Click to collapse
  await pluginHeader.click();
  await page.waitForTimeout(100);

  // Verify child menu items are hidden
  await expect(menuGroup).not.toBeVisible();

  // Click to expand again
  await pluginHeader.click();
  await page.waitForTimeout(100);

  // Verify child menu items are visible again
  await expect(menuGroup).toBeVisible();
});

/**
 * Test: Hierarchical menu items (with children) render correctly
 *
 * Tests that parent-child menu structure is rendered with proper indentation.
 */
test('hierarchical menu items render with proper nesting', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Look for nested menu structure (children with ml-4 indentation)
  const nestedGroups = sidebar.locator('div[role="group"]');
  const groupCount = await nestedGroups.count();

  // If nested groups exist, verify structure
  if (groupCount > 0) {
    const firstGroup = nestedGroups.first();
    await expect(firstGroup).toBeVisible();

    // Verify group has proper styling (indentation, border)
    await expect(firstGroup).toHaveClass(/ml-4/);
    await expect(firstGroup).toHaveClass(/border-l/);
    await expect(firstGroup).toHaveClass(/pl-3/);

    // Verify children links exist within group
    const childLinks = firstGroup.locator('a');
    const childCount = await childLinks.count();
    expect(childCount).toBeGreaterThan(0);

    // Verify child links have smaller text (text-xs)
    const firstChild = childLinks.first();
    await expect(firstChild).toHaveClass(/text-xs/);
  }
});

/**
 * Test: Menu items display icons correctly
 *
 * Verifies that menu items have icons (Heroicons or Iconify).
 */
test('menu items display icons', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Get all navigation links
  const navLinks = sidebar.locator('nav a');
  const linkCount = await navLinks.count();

  if (linkCount > 0) {
    // Check first link for icon (SVG element)
    const firstLink = navLinks.first();
    const icon = firstLink.locator('svg').first();

    await expect(icon).toBeVisible();

    // Verify icon has proper size classes
    await expect(icon).toHaveClass(/w-5/);
    await expect(icon).toHaveClass(/h-5/);
  }
});

/**
 * Test: Active menu item is highlighted
 *
 * Verifies that the currently active page has the correct highlight style.
 */
test('active menu item has correct highlight style', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Overview should be active on /dashboard
  const overviewLink = sidebar.locator('a[href="/dashboard"]');
  await expect(overviewLink).toHaveClass(/bg-indigo-50/);
  await expect(overviewLink).toHaveClass(/text-indigo-600/);

  // Navigate to different page
  await page.goto(`${BASE_URL}/dashboard/developers`);
  await page.waitForLoadState('networkidle');

  // Developers link should now be active
  const developersLink = sidebar.locator('a[href="/dashboard/developers"]');
  await expect(developersLink).toHaveClass(/bg-indigo-50/);
  await expect(developersLink).toHaveClass(/text-indigo-600/);

  // Overview should no longer be active
  const overviewLinkInactive = sidebar.locator('a[href="/dashboard"]');
  await expect(overviewLinkInactive).not.toHaveClass(/bg-indigo-50/);
});

/**
 * Test: Dark mode has correct color contrast for menu items
 *
 * Verifies that sidebar menu items have sufficient contrast in dark mode.
 */
test('dark mode has correct color contrast for menu items', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Test light mode colors
  const sidebarBgColor = await sidebar.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Sidebar should have white background in light mode
  expect(sidebarBgColor).toMatch(/rgb\(255, 255, 255\)/);

  // Get inactive link color
  const developersLink = sidebar.locator('a[href="/dashboard/developers"]');
  const lightTextColor = await developersLink.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  // Inactive link should have gray text in light mode
  expect(lightTextColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((55|75|107), (65|85|114), (87|107|145)\)/);

  // Switch to dark mode (add dark class to html)
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(300);

  // Test dark mode colors
  const darkBgColor = await sidebar.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Sidebar should have dark background in dark mode
  expect(darkBgColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((17|24|31), (24|31|41), (39|51|63)\)/);

  // Get inactive link color in dark mode
  const darkTextColor = await developersLink.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  // Inactive link should have light gray text in dark mode
  expect(darkTextColor).toMatch(/oklch\(0\.\d+\s+[\d.]+\s+[\d.]+\)|rgb\((209|224|243), (213|228|244), (219|232|246)\)/);
});

/**
 * Test: Sidebar layout has consistent spacing and alignment
 *
 * Verifies that menu items are properly aligned with consistent spacing.
 */
test('sidebar has consistent spacing and alignment', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Verify sidebar has fixed width
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox?.width).toBe(240); // w-60 = 240px

  // Get all main navigation links (exclude children)
  const mainNav = sidebar.locator('nav[aria-label="Main navigation"]');
  const mainLinks = mainNav.locator('> a, > div > a');
  const linkCount = await mainLinks.count();

  if (linkCount > 1) {
    // Verify all links have consistent padding
    const firstLinkPadding = await mainLinks.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
    });

    const secondLinkPadding = await mainLinks.nth(1).evaluate((el) => {
      const style = window.getComputedStyle(el);
      return `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
    });

    // Padding should be consistent (py-2 px-3 = 8px 12px)
    expect(firstLinkPadding).toBe(secondLinkPadding);
    expect(firstLinkPadding).toMatch(/8px 12px/);
  }

  // Verify no horizontal overflow
  const hasOverflow = await sidebar.evaluate((el) => {
    return el.scrollWidth > el.clientWidth;
  });
  expect(hasOverflow).toBe(false);
});

/**
 * Test: System Settings is at bottom of sidebar
 *
 * Verifies that System Settings is separated and appears at the bottom.
 */
test('system settings appears at bottom of sidebar', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Get bottom navigation section
  const bottomNav = sidebar.locator('nav[aria-label="Settings navigation"]');
  await expect(bottomNav).toBeVisible();

  // Verify it has border-top (separated from main items)
  await expect(bottomNav).toHaveClass(/border-t/);

  // Verify System Settings link exists in bottom nav
  const settingsLink = bottomNav.locator('a[href="/dashboard/settings"]');
  await expect(settingsLink).toBeVisible();
  await expect(settingsLink).toContainText('System Settings');
});

/**
 * Test: Maximum nesting depth of 2 levels is enforced
 *
 * Verifies that menu items don't exceed 2 levels of nesting.
 */
test('menu hierarchy does not exceed 2 levels', async ({ page }) => {
  await loginAndNavigate(page);

  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // Look for any nested groups (Level 2)
  const level2Groups = sidebar.locator('div[role="group"]');
  const level2Count = await level2Groups.count();

  if (level2Count > 0) {
    // Check if any Level 2 item has nested children (Level 3 - should not exist)
    const level3Groups = level2Groups.locator('div[role="group"]');
    const level3Count = await level3Groups.count();

    // Level 3 should not exist (max 2 levels)
    expect(level3Count).toBe(0);
  }
});

/**
 * Test: Mobile sidebar toggle button exists and works
 *
 * Verifies that mobile sidebar toggle is visible and functional.
 */
test('mobile sidebar toggle button works', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  await loginAndNavigate(page);

  // Verify toggle button exists on mobile
  const toggleButton = page.locator('button[data-testid="sidebar-toggle"]');
  await expect(toggleButton).toBeVisible();

  // Check sidebar position via wrapper div
  const sidebar = page.locator('aside[data-testid="sidebar"]');

  // On mobile, sidebar should be off-screen initially (x position negative)
  const initialBox = await sidebar.boundingBox();
  expect(initialBox).toBeTruthy();
  if (initialBox) {
    // Sidebar should be translated off-screen (negative x position)
    expect(initialBox.x).toBeLessThan(0);
  }

  // Click toggle button to open sidebar
  await toggleButton.click();
  await page.waitForTimeout(400); // Wait for transition

  // Sidebar should now be visible (x position = 0)
  const openBox = await sidebar.boundingBox();
  expect(openBox).toBeTruthy();
  if (openBox) {
    // Sidebar should be on screen (x position = 0)
    expect(openBox.x).toBeGreaterThanOrEqual(0);
  }

  // Click toggle again to close
  await toggleButton.click();
  await page.waitForTimeout(400);

  // Sidebar should be off-screen again
  const closedBox = await sidebar.boundingBox();
  expect(closedBox).toBeTruthy();
  if (closedBox) {
    // Sidebar should be off-screen again (negative x position)
    expect(closedBox.x).toBeLessThan(0);
  }
});
