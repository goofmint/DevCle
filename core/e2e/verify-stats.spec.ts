/**
 * Verify Statistics Display - Screenshot Test
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
const TEST_PLUGIN_KEY = 'drowl-plugin-test';

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
});

test('verify statistics are NOT zero with screenshot', async ({ page }) => {
  // Navigate to data page
  await page.goto(`${BASE_URL}/dashboard/plugins/${TEST_PLUGIN_KEY}/data`);
  await page.waitForLoadState('networkidle');

  // Wait for stats container to be visible
  const statsContainer = page.locator('[data-testid="events-stats"]');
  await statsContainer.waitFor({ state: 'visible', timeout: 10000 });

  // Wait for stats to finish loading (wait for at least one non-skeleton card)
  await page.waitForSelector('[data-testid="events-stats"] .text-2xl', { timeout: 10000 });

  // Take screenshot of the entire page
  await page.screenshot({ path: '/tmp/stats-page-full.png', fullPage: true });

  // Take screenshot of just the stats section
  await statsContainer.screenshot({ path: '/tmp/stats-section.png' });

  // Use simpler approach: get all stat cards and extract their values by position
  const statCards = statsContainer.locator('> div'); // Direct children divs (stat cards)
  await expect(statCards).toHaveCount(6);

  // Get text content of each card's value (the text-2xl element)
  const totalText = await statCards.nth(0).locator('.text-2xl').textContent();
  const processedText = await statCards.nth(1).locator('.text-2xl').textContent();
  const failedText = await statCards.nth(2).locator('.text-2xl').textContent();
  const pendingText = await statCards.nth(3).locator('.text-2xl').textContent();

  console.log('Statistics values:');
  console.log(`  Total Events: ${totalText}`);
  console.log(`  Processed: ${processedText}`);
  console.log(`  Failed: ${failedText}`);
  console.log(`  Pending: ${pendingText}`);

  // Verify stats are properly formatted as numbers
  expect(totalText).toMatch(/^\d+$/);
  expect(processedText).toMatch(/^\d+$/);
  expect(failedText).toMatch(/^\d+$/);
  expect(pendingText).toMatch(/^\d+$/);

  // Verify total should be greater than or equal to sum of processed, failed, and pending
  const total = parseInt(totalText || '0', 10);
  const processed = parseInt(processedText || '0', 10);
  const failed = parseInt(failedText || '0', 10);
  const pending = parseInt(pendingText || '0', 10);

  // Total must match the sum (processed + failed + pending)
  expect(total).toBe(processed + failed + pending);

  // Verify we have some events (based on seed data)
  expect(total).toBeGreaterThan(0);
});
