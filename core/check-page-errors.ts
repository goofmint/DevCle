import { chromium } from '@playwright/test';

async function checkPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log('PAGE ERROR:', error.message);
    console.log('Stack:', error.stack);
  });

  // Login first
  try {
    await page.goto('https://devcle.test/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login successful');
  } catch (e) {
    console.log('Login failed:', e);
    await browser.close();
    return;
  }

  // Navigate to plugin data page
  try {
    console.log('Navigating to plugin data page...');
    await page.goto('https://devcle.test/dashboard/plugins/drowl-plugin-test/data', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    console.log('Page loaded');

    // Wait for any JS errors to appear
    await page.waitForTimeout(1000);

    // Wait a bit for any React errors to appear
    await page.waitForTimeout(2000);

    // Print all console messages
    console.log('\n=== Console Messages ===');
    consoleMessages.forEach((msg) => console.log(msg));

    // Get page content
    const content = await page.content();
    if (content.includes('An Error Occurred')) {
      console.log('\n❌ Page shows error screen');
    } else {
      console.log('\n✅ Page loaded successfully');
    }

    // Try to find the stats element
    const statsElement = await page.locator('[data-testid="events-stats"]').count();
    console.log(`Stats element found: ${statsElement > 0 ? 'YES' : 'NO'}`);

  } catch (e) {
    console.log('Navigation error:', e);
  }

  await browser.close();
}

checkPage().catch(console.error);
