/**
 * Debug test for dashboard settings page
 */

import { test, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
}

test('debug settings page', async ({ page }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  // Capture console messages
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  // Login as admin
  await loginAsAdmin(page);

  console.log('Navigating to /dashboard/settings...');

  // Navigate to settings page
  await page.goto(`${BASE_URL}/dashboard/settings`);

  // Wait a bit to see what happens
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());
  console.log('Console messages:', consoleMessages);
  console.log('Page errors:', pageErrors);

  // Try to get page content
  const html = await page.content();
  console.log('Page HTML (first 1000 chars):', html.substring(0, 1000));

  // Check if h1 exists
  const h1 = await page.locator('h1').count();
  console.log('h1 count:', h1);

  if (h1 > 0) {
    const h1Text = await page.locator('h1').first().textContent();
    console.log('h1 text:', h1Text);
  }

  // Check if body has any specific error messages
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
});
