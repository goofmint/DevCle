import { test, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

test('check if icons work on settings page', async ({ page }) => {
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });

  // Go to settings page
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');

  // Check for any icon elements
  const svgIcons = page.locator('svg');
  const iconCount = await svgIcons.count();

  console.log(`Found ${iconCount} SVG icons on settings page`);

  if (iconCount > 0) {
    const firstIcon = svgIcons.first();
    const html = await firstIcon.evaluate(el => el.outerHTML);
    console.log('First icon HTML:', html.substring(0, 200));
  } else {
    console.log('NO SVG ICONS FOUND ON SETTINGS PAGE!');
  }

  expect(iconCount).toBeGreaterThan(0);
});
