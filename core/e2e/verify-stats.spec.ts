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

  // Wait for stats to load
  await page.waitForTimeout(2000);

  // Take screenshot of the entire page
  await page.screenshot({ path: '/tmp/stats-page-full.png', fullPage: true });

  // Take screenshot of just the stats section
  const statsSection = page.locator('text=Plugin Collected Data').locator('..')
  await statsSection.screenshot({ path: '/tmp/stats-section.png' });

  // Verify statistics are displayed
  const totalEvents = page.locator('text=Total Events').locator('..').locator('text=/^\\d+$/');
  const processedEvents = page.locator('text=Processed').locator('..').locator('text=/^\\d+$/');
  const failedEvents = page.locator('text=Failed').locator('..').locator('text=/^\\d+$/');
  const pendingEvents = page.locator('text=Pending').locator('..').locator('text=/^\\d+$/');

  // Get the actual values
  const totalText = await totalEvents.first().textContent();
  const processedText = await processedEvents.first().textContent();
  const failedText = await failedEvents.first().textContent();
  const pendingText = await pendingEvents.first().textContent();

  console.log('Statistics values:');
  console.log(`  Total Events: ${totalText}`);
  console.log(`  Processed: ${processedText}`);
  console.log(`  Failed: ${failedText}`);
  console.log(`  Pending: ${pendingText}`);

  // Verify they are NOT zero
  expect(totalText).not.toBe('0');
  expect(processedText).not.toBe('0');
  expect(failedText).not.toBe('0');
  expect(pendingText).not.toBe('0');

  // Verify expected values based on seeded data
  expect(totalText).toBe('25');
  expect(processedText).toBe('10');
  expect(failedText).toBe('8');
  expect(pendingText).toBe('7');
});
