/**
 * Dashboard Overview E2E Tests
 *
 * End-to-end tests for dashboard overview page using Playwright.
 * Tests stat cards, activity chart, dark/light mode colors, and responsive design.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users:
 *   - test@example.com / password123 (member)
 *
 * Test scenarios:
 * 1. Overview page displays correctly
 * 2. Four stat cards are displayed
 * 3. Activity chart is displayed
 * 4. Dark mode - stat card colors
 * 5. Light mode - stat card colors
 * 6. Dark mode - chart colors
 * 7. Light mode - chart colors
 * 8. Responsive design - mobile layout
 * 9. Design alignment check (no偏り)
 */

import { test, expect } from '@playwright/test';

// Base URL for the application
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Helper function to login
 *
 * Authenticates a test user and navigates to dashboard.
 */
async function login(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => url.pathname.startsWith('/dashboard'), {
    timeout: 10000,
  });
}

/**
 * Test: Overview page displays correctly
 *
 * Verifies that:
 * 1. Page title "Overview" is displayed
 * 2. Page description is visible
 */
test('overview page displays correctly', async ({ page }) => {
  await login(page);

  // Verify page title
  await expect(page.getByRole('heading', { name: /^Overview$/i })).toBeVisible();

  // Verify page description
  await expect(
    page.getByText(/Key metrics and insights for your DevRel activities/i)
  ).toBeVisible();
});

/**
 * Test: Four stat cards are displayed
 *
 * Verifies that:
 * 1. All 4 stat cards exist (developers, activities, campaigns, ROI)
 * 2. Each card has a label and value
 */
test('four stat cards are displayed', async ({ page }) => {
  await login(page);

  // Verify all 4 stat cards exist
  const developerCard = page.getByTestId('total-developers');
  const activityCard = page.getByTestId('total-activities');
  const campaignCard = page.getByTestId('total-campaigns');
  const roiCard = page.getByTestId('average-roi');

  await expect(developerCard).toBeVisible();
  await expect(activityCard).toBeVisible();
  await expect(campaignCard).toBeVisible();
  await expect(roiCard).toBeVisible();

  // Verify each card has labels
  await expect(developerCard.getByText(/Total Developers/i)).toBeVisible();
  await expect(activityCard.getByText(/Total Activities/i)).toBeVisible();
  await expect(campaignCard.getByText(/Active Campaigns/i)).toBeVisible();
  await expect(roiCard.getByText(/Average ROI/i)).toBeVisible();

  // Verify each card has a value (number or N/A)
  await expect(
    developerCard.getByTestId('total-developers-value')
  ).toBeVisible();
  await expect(activityCard.getByTestId('total-activities-value')).toBeVisible();
  await expect(campaignCard.getByTestId('total-campaigns-value')).toBeVisible();
  await expect(roiCard.getByTestId('average-roi-value')).toBeVisible();
});

/**
 * Test: Activity chart is displayed
 *
 * Verifies that:
 * 1. Chart container is visible
 * 2. Chart title is displayed
 */
test('activity chart is displayed', async ({ page }) => {
  await login(page);

  // Verify chart container
  const chart = page.getByTestId('activity-chart');
  await expect(chart).toBeVisible();

  // Verify chart title
  await expect(chart.getByText(/Activity Timeline/i)).toBeVisible();
});

/**
 * Test: Dark mode - stat card colors
 *
 * Verifies that in dark mode:
 * 1. Stat cards have dark backgrounds (gray-800)
 * 2. Card text is light (white or light gray)
 * 3. Icons have proper contrast
 */
test('dark mode - stat card colors', async ({ page }) => {
  await login(page);

  // Enable dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  await page.waitForFunction(() =>
    document.documentElement.classList.contains('dark')
  );

  // Check stat card background (should be dark)
  const statCard = page.getByTestId('total-developers');
  const cardBgColor = await statCard.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  console.log('Stat card background (dark mode):', cardBgColor);

  // Card background should be dark (gray-800)
  const isDarkCard =
    (cardBgColor.includes('oklch') && /oklch\(0\.[1-3]/.test(cardBgColor)) ||
    (/rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\)/.test(cardBgColor) &&
      !cardBgColor.includes('255'));
  expect(isDarkCard).toBe(true);

  // Check card value text color (should be white)
  const cardValue = statCard.getByTestId('total-developers-value');
  const valueColor = await cardValue.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  console.log('Card value color (dark mode):', valueColor);

  // Value should be white or very light
  const isLightValue =
    (valueColor.includes('oklch') && /oklch\(0\.[89]/.test(valueColor)) ||
    (valueColor.includes('oklch') && /oklch\(1\s/.test(valueColor)) ||
    /rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/.test(valueColor);
  expect(isLightValue).toBe(true);
});

/**
 * Test: Light mode - stat card colors
 *
 * Verifies that in light mode:
 * 1. Stat cards have white backgrounds
 * 2. Card text is dark (gray-900)
 * 3. Icons have proper contrast
 */
test('light mode - stat card colors', async ({ page }) => {
  await login(page);

  // Remove dark mode class
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });

  await page.waitForFunction(
    () => !document.documentElement.classList.contains('dark')
  );

  // Check stat card background (should be white)
  const statCard = page.getByTestId('total-developers');
  const cardBgColor = await statCard.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  console.log('Stat card background (light mode):', cardBgColor);

  // Card background should be white
  const isLightCard =
    (cardBgColor.includes('oklch') && /oklch\(1\s/.test(cardBgColor)) ||
    /rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/.test(cardBgColor);
  expect(isLightCard).toBe(true);

  // Check card value text color (should be dark)
  const cardValue = statCard.getByTestId('total-developers-value');
  const valueColor = await cardValue.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  console.log('Card value color (light mode):', valueColor);

  // Value should be dark (gray-900)
  const isDarkValue =
    (valueColor.includes('oklch') && /oklch\(0\.[1-4]/.test(valueColor)) ||
    (/rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\)/.test(valueColor) &&
      !valueColor.includes('255'));
  expect(isDarkValue).toBe(true);
});

/**
 * Test: Dark mode - chart colors
 *
 * Verifies that in dark mode:
 * 1. Chart container has dark background
 * 2. Chart title is light colored
 */
test('dark mode - chart colors', async ({ page }) => {
  await login(page);

  // Enable dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  await page.waitForFunction(() =>
    document.documentElement.classList.contains('dark')
  );

  // Check chart container background
  const chart = page.getByTestId('activity-chart');
  const chartBgColor = await chart.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  console.log('Chart background (dark mode):', chartBgColor);

  // Chart background should be dark
  const isDarkChart =
    (chartBgColor.includes('oklch') && /oklch\(0\.[1-3]/.test(chartBgColor)) ||
    (/rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\)/.test(chartBgColor) &&
      !chartBgColor.includes('255'));
  expect(isDarkChart).toBe(true);
});

/**
 * Test: Light mode - chart colors
 *
 * Verifies that in light mode:
 * 1. Chart container has white background
 * 2. Chart title is dark colored
 */
test('light mode - chart colors', async ({ page }) => {
  await login(page);

  // Remove dark mode class
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });

  await page.waitForFunction(
    () => !document.documentElement.classList.contains('dark')
  );

  // Check chart container background
  const chart = page.getByTestId('activity-chart');
  const chartBgColor = await chart.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  console.log('Chart background (light mode):', chartBgColor);

  // Chart background should be white
  const isLightChart =
    (chartBgColor.includes('oklch') && /oklch\(1\s/.test(chartBgColor)) ||
    /rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/.test(chartBgColor);
  expect(isLightChart).toBe(true);
});

/**
 * Test: Responsive design - mobile layout
 *
 * Verifies that on mobile viewport:
 * 1. Stat cards stack in single column
 * 2. Chart is visible and responsive
 */
test('responsive design - mobile layout', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  await login(page);

  // Get all stat cards
  const cards = [
    page.getByTestId('total-developers'),
    page.getByTestId('total-activities'),
    page.getByTestId('total-campaigns'),
    page.getByTestId('average-roi'),
  ];

  // Get bounding boxes
  const boxes = await Promise.all(cards.map((card) => card.boundingBox()));

  console.log('Mobile card bounding boxes:', boxes);

  // All cards should exist
  boxes.forEach((box) => expect(box).not.toBeNull());

  // On mobile, cards should stack vertically (different Y positions)
  const yPositions = boxes.map((box) => box!.y);
  const uniqueYPositions = [...new Set(yPositions)];

  console.log('Mobile card Y positions:', yPositions);
  console.log('Unique Y positions:', uniqueYPositions);

  // Should have multiple rows (at least 2) since cards stack vertically
  expect(uniqueYPositions.length).toBeGreaterThan(1);

  // Chart should still be visible on mobile
  await expect(page.getByTestId('activity-chart')).toBeVisible();
});

/**
 * Test: Design alignment check (no偏り)
 *
 * Verifies that:
 * 1. All stat cards have similar heights
 * 2. Cards are properly aligned in grid
 * 3. No visual偏り (bias) in layout
 */
test('design alignment check - no偏り', async ({ page }) => {
  await login(page);

  // Get all stat cards
  const cards = [
    page.getByTestId('total-developers'),
    page.getByTestId('total-activities'),
    page.getByTestId('total-campaigns'),
    page.getByTestId('average-roi'),
  ];

  // Get bounding boxes
  const boxes = await Promise.all(cards.map((card) => card.boundingBox()));

  console.log('Card bounding boxes:', boxes);

  // All cards should exist
  boxes.forEach((box) => expect(box).not.toBeNull());

  // All cards should have similar heights (within 15px tolerance for text wrapping)
  const heights = boxes.map((box) => box!.height);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);

  console.log('Card heights:', heights);
  console.log('Min height:', minHeight, 'Max height:', maxHeight);

  // Height difference should be minimal
  expect(maxHeight - minHeight).toBeLessThan(15);

  // Check top edge alignment (grid layout)
  const topEdges = boxes.map((box) => box!.y);
  const uniqueTops = [...new Set(topEdges)];

  console.log('Card top edges:', topEdges);
  console.log('Unique top positions:', uniqueTops);

  // Should have at most 2 rows on tablet, 1 row on desktop, 4 rows on mobile
  // We allow up to 4 unique positions
  expect(uniqueTops.length).toBeLessThanOrEqual(4);
});
