/**
 * Debug test for campaigns page
 */

import { test } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

test('debug campaigns page', async ({ page }) => {
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  // Navigate to campaigns page
  await page.goto(`${BASE_URL}/dashboard/campaigns`);
  await page.waitForLoadState('networkidle');

  // Check for error messages
  const errorMessages = await page.locator('text=/error|fail/i').count();
  console.log('Error messages found:', errorMessages);

  // Get page HTML
  const html = await page.content();
  console.log('Page HTML (first 2000 chars):', html.substring(0, 2000));

  // Check if h1 exists
  const h1 = await page.locator('h1').textContent();
  console.log('H1 text:', h1);

  // Check body text
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
});
