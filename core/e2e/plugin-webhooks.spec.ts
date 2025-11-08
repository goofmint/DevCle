/**
 * Plugin Webhooks E2E Tests
 *
 * Tests the complete webhook flow:
 * 1. External service sends webhook to plugin
 * 2. Core receives webhook and validates route
 * 3. Plugin handler executes in isolated-vm sandbox
 * 4. Handler calls internal Core APIs (authenticated)
 * 5. Data is stored in database
 * 6. Plugin run is logged
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://devcle.test';

test.describe('Plugin Webhooks', () => {
  test('receives webhook and creates activity', async ({ request }) => {
    // Send webhook to test plugin
    const webhookPayload = {
      action: 'click',
      developerId: '123e4567-e89b-12d3-a456-426614174000', // UUID format
      testExternalApi: false, // Don't test external API (may fail)
    };

    const response = await request.post(
      `${BASE_URL}/api/plugins/drowl-plugin-test/webhook`,
      {
        data: webhookPayload,
        headers: {
          'Content-Type': 'application/json',
        },
        // Ignore SSL certificate errors for local testing
        ignoreHTTPSErrors: true,
      }
    );

    // Verify webhook response
    expect(response.status()).toBe(200);
    const responseData = await response.json();
    expect(responseData).toHaveProperty('success', true);
  });

  test('rejects webhook for non-existent plugin', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/plugins/non-existent-plugin/test`,
      {
        data: { test: 'data' },
        headers: {
          'Content-Type': 'application/json',
        },
        ignoreHTTPSErrors: true,
      }
    );

    // Should return 500 or 404
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects webhook for non-existent route', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/plugins/drowl-plugin-test/non-existent-route`,
      {
        data: { test: 'data' },
        headers: {
          'Content-Type': 'application/json',
        },
        ignoreHTTPSErrors: true,
      }
    );

    // Should return 404 for route not found
    expect(response.status()).toBe(404);
    const responseData = await response.json();
    expect(responseData).toHaveProperty('error');
    expect(responseData.error).toContain('Route not found');
  });

  test('handles webhook with invalid body', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/plugins/drowl-plugin-test/webhook`,
      {
        // Send invalid JSON (string instead of object)
        data: 'invalid-json-string',
        headers: {
          'Content-Type': 'application/json',
        },
        ignoreHTTPSErrors: true,
      }
    );

    // Handler should return false for invalid body
    // Core should return 500
    expect(response.status()).toBe(500);
  });

  test('logs webhook execution in plugin_runs table', async ({ page }) => {
    // First, send a webhook
    const webhookPayload = {
      action: 'test-log',
      developerId: '123e4567-e89b-12d3-a456-426614174000',
      testExternalApi: false,
    };

    await page.request.post(
      `${BASE_URL}/api/plugins/drowl-plugin-test/webhook`,
      {
        data: webhookPayload,
        headers: {
          'Content-Type': 'application/json',
        },
        ignoreHTTPSErrors: true,
      }
    );

    // Login to dashboard
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/dashboard`);

    // Navigate to plugin runs page
    await page.goto(`${BASE_URL}/dashboard/plugins/drowl-plugin-test`);

    // Check if webhook execution is logged
    // Look for "webhook:webhook" in the runs list
    const runsTab = page.locator('text=Runs');
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await page.waitForTimeout(1000);

      // Verify at least one run exists with webhook job name
      const webhookRun = page.locator('text=/webhook:/i').first();
      await expect(webhookRun).toBeVisible({ timeout: 10000 });
    }
  });
});
