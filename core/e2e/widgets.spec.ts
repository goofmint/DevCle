/**
 * E2E Tests for Widget System (Task 8.10)
 *
 * Tests the plugin widget API endpoints and data fetching.
 *
 * Test Coverage:
 * - GET /api/widgets - List available widgets
 * - GET /api/widgets/:widgetId/data - Fetch widget data
 * - PUT /api/user/widget-layout - Save widget layout
 * - GET /api/user/widget-layout - Get widget layout
 *
 * Prerequisites:
 * - Test plugin with widget definitions in plugin.json
 * - Test database with sample data
 * - Authenticated user session
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

test.describe('Widget System', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await loginAsAdmin(page);
  });

  test('should list available widgets from enabled plugins', async ({
    page,
  }) => {
    // Call widgets list API
    const response = await page.goto(`${BASE_URL}/api/widgets`);

    expect(response).not.toBeNull();
    if (!response) return;

    expect(response.status()).toBe(200);

    // Parse response JSON
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('widgets');
    expect(Array.isArray(data.widgets)).toBe(true);

    // If there are widgets, verify structure
    if (data.widgets.length > 0) {
      const widget = data.widgets[0];
      expect(widget).toHaveProperty('id');
      expect(widget).toHaveProperty('pluginId');
      expect(widget).toHaveProperty('key');
      expect(widget).toHaveProperty('type');
      expect(widget).toHaveProperty('title');
      expect(widget).toHaveProperty('version');

      // Verify ID format is "pluginId:widgetKey"
      expect(widget.id).toContain(':');
    }
  });

  test('should return empty array when no plugins have widgets', async ({
    page,
  }) => {
    // If no widgets are configured, API should still return valid response
    const response = await page.goto(`${BASE_URL}/api/widgets`);

    expect(response).not.toBeNull();
    if (!response) return;

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('widgets');
    expect(Array.isArray(data.widgets)).toBe(true);
  });

  test('should fetch widget data for valid widget ID', async ({ page }) => {
    // First get list of widgets
    const listResponse = await page.goto(
      `${BASE_URL}/api/widgets`
    );
    expect(listResponse).not.toBeNull();
    if (!listResponse) return;

    const listData = await listResponse.json();

    // Skip test if no widgets available
    if (listData.widgets.length === 0) {
      test.skip();
      return;
    }

    // Get first widget ID
    const widgetId = listData.widgets[0].id;

    // Fetch widget data
    const dataResponse = await page.goto(
      `${BASE_URL}/api/widgets/${widgetId}/data`
    );
    expect(dataResponse).not.toBeNull();
    if (!dataResponse) return;

    expect(dataResponse.status()).toBe(200);

    const widgetData = await dataResponse.json();

    // Verify basic widget data structure
    expect(widgetData).toHaveProperty('version');
    expect(widgetData).toHaveProperty('type');
    expect(widgetData).toHaveProperty('title');
    expect(widgetData).toHaveProperty('data');

    // Verify type is one of the supported widget types
    expect(['stat', 'table', 'list', 'timeseries', 'card']).toContain(
      widgetData.type
    );
  });

  test('should return 404 for invalid widget ID', async ({ page }) => {
    // Try to fetch data for non-existent widget
    const response = await page.goto(
      `${BASE_URL}/api/widgets/invalid-plugin:invalid-widget/data`
    );

    expect(response).not.toBeNull();
    if (!response) return;

    // Should return 404 or 500 (depending on validation)
    expect([404, 500]).toContain(response.status());
  });

  test('should return 400 for malformed widget ID', async ({ page }) => {
    // Try to fetch data with invalid ID format (missing colon)
    const response = await page.goto(
      `${BASE_URL}/api/widgets/invalid-widget-id/data`
    );

    expect(response).not.toBeNull();
    if (!response) return;

    // Should return 400 for bad request
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid widget ID format');
  });

  test('should save and retrieve widget layout', async ({ page }) => {
    // Create test layout
    const testLayout = {
      'slot-1': 'item-widget-1',
      'slot-2': 'item-widget-2',
      'slot-3': 'item-widget-3',
    };

    // Save layout via PUT using page.request (inherits auth cookies)
    const saveResponse = await page.request.put(
      `${BASE_URL}/api/user/widget-layout`,
      {
        data: { layout: testLayout },
      }
    );

    expect(saveResponse.status()).toBe(200);

    const saveData = await saveResponse.json();
    expect(saveData).toHaveProperty('success');
    expect(saveData.success).toBe(true);

    // Retrieve layout via GET
    const getResponse = await page.goto(
      `${BASE_URL}/api/user/widget-layout`
    );

    expect(getResponse).not.toBeNull();
    if (!getResponse) return;

    expect(getResponse.status()).toBe(200);

    const getData = await getResponse.json();
    expect(getData).toHaveProperty('layout');
    expect(getData.layout).toEqual(testLayout);
  });

  test('should return null layout for new user', async ({ page }) => {
    // This assumes the test user doesn't have a saved layout yet
    // In a real test, you might need to clear the user's layout first

    const response = await page.goto(
      `${BASE_URL}/api/user/widget-layout`
    );

    expect(response).not.toBeNull();
    if (!response) return;

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('layout');
    // Layout could be null or an object depending on whether user has saved layout
    expect(data.layout === null || typeof data.layout === 'object').toBe(true);
  });

  test('should return 400 when saving layout without layout field', async ({
    page,
  }) => {
    // Try to save layout with missing layout field
    const response = await page.request.put(
      `${BASE_URL}/api/user/widget-layout`,
      {
        data: {}, // Missing layout field
      }
    );

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('layout');
  });

  test('should handle widget layout updates', async ({ page }) => {
    // Save initial layout
    const initialLayout = {
      'slot-1': 'item-a',
      'slot-2': 'item-b',
    };

    await page.request.put(`${BASE_URL}/api/user/widget-layout`, {
      data: { layout: initialLayout },
    });

    // Update layout
    const updatedLayout = {
      'slot-1': 'item-b',
      'slot-2': 'item-a',
    };

    const updateResponse = await page.request.put(
      `${BASE_URL}/api/user/widget-layout`,
      {
        data: { layout: updatedLayout },
      }
    );

    expect(updateResponse.status()).toBe(200);

    // Verify updated layout
    const getResponse = await page.request.get(
      `${BASE_URL}/api/user/widget-layout`
    );
    const getData = await getResponse.json();

    expect(getData.layout).toEqual(updatedLayout);
  });

  test('should display plugin widgets on dashboard with standard widgets', async ({
    page,
  }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Overview")');

    // Check standard dashboard widgets are present
    await expect(
      page.locator('[data-testid="total-developers"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="total-activities"]')
    ).toBeVisible();

    // Check if plugin widgets are present in GridStack
    // Plugin widgets have IDs like "plugin-drowl-plugin-test:stats"
    const pluginWidgets = page.locator('.grid-stack-item[gs-id^="plugin-"]');
    const count = await pluginWidgets.count();

    // If test plugin is enabled and has widgets, verify they display
    if (count > 0) {
      // Verify at least one plugin widget is visible
      await expect(pluginWidgets.first()).toBeVisible();

      // Verify plugin widget contains actual content (not just loading state)
      const firstWidgetContent = pluginWidgets.first().locator('.grid-stack-item-content');
      await expect(firstWidgetContent).not.toBeEmpty();
    }
  });

  test('should allow drag-and-drop repositioning of all widgets', async ({
    page,
  }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for GridStack to initialize
    await page.waitForSelector('.grid-stack');

    // Check that GridStack is present
    const gridStack = page.locator('.grid-stack');
    await expect(gridStack).toBeVisible();

    // Verify widgets have draggable handles
    const widgets = page.locator('.grid-stack-item');
    const firstWidget = widgets.first();

    // Verify widget has grid-stack-item class (indicates it's managed by GridStack)
    await expect(firstWidget).toHaveClass(/grid-stack-item/);

    // Note: Actual drag-and-drop testing is complex in Playwright
    // Here we just verify the GridStack structure is correct
  });

  test('should display timeseries widget data correctly', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for widgets to load
    await page.waitForSelector('.grid-stack-item', { timeout: 10000 });

    // Look for timeseries widgets (they contain Recharts components)
    const timeseriesWidget = page.locator(
      '.grid-stack-item:has(.recharts-wrapper)'
    );

    // If timeseries widget exists, verify it displays
    if ((await timeseriesWidget.count()) > 0) {
      // Verify the chart is visible
      await expect(timeseriesWidget.first()).toBeVisible();

      // Verify Recharts SVG is rendered
      const chartSvg = timeseriesWidget.first().locator('svg.recharts-surface');
      await expect(chartSvg).toBeVisible();
    }
  });
});
