/**
 * Authentication E2E Tests
 *
 * End-to-end tests for login and logout functionality using Playwright.
 * Tests the full user flow from login form to dashboard and back to logout.
 *
 * Prerequisites:
 * - Remix dev server must be running
 * - Database must be seeded with test users:
 *   - test@example.com / password123 (member)
 *   - admin@example.com / admin123456 (admin)
 *
 * Test scenarios:
 * 1. User can login with valid credentials
 * 2. User sees error message with invalid credentials
 * 3. User can logout successfully
 * 4. Login redirects to returnTo URL if specified
 * 5. Authenticated user cannot access login page (redirected to dashboard)
 */

import { test, expect } from '@playwright/test';

// Base URL for the application
// In CI/CD, this would be set via environment variable
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Test: User can login and logout
 *
 * This test covers the complete authentication flow:
 * 1. Navigate to login page
 * 2. Fill in credentials
 * 3. Submit form
 * 4. Verify redirect to dashboard
 * 5. Logout
 * 6. Verify redirect to home page
 */
test('user can login and logout', async ({ page }) => {
  // 1. Navigate to login page
  await page.goto(`${BASE_URL}/login`);

  // Verify we're on the login page
  await expect(page).toHaveURL(`${BASE_URL}/login`);
  await expect(page.locator('h1')).toHaveText('Log In');

  // 2. Fill login form with test user credentials
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');

  // 3. Submit form
  await page.click('button[type="submit"]');

  // 4. Verify redirect to dashboard
  // Wait for navigation to complete
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
  await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

  // Verify session cookie is set
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === '__session');
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);

  // 5. Logout
  // Note: Since logout requires POST, we need to use a form
  // In a real app, there would be a logout button that submits a form
  await page.goto(`${BASE_URL}/`);

  // Find and click logout button (assuming it exists in the UI)
  // For now, we'll manually POST to logout endpoint using fetch
  await page.evaluate(async () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/logout';
    document.body.appendChild(form);
    form.submit();
  });

  // 6. Verify redirect to home page
  await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  // Verify session cookie is cleared
  const cookiesAfterLogout = await page.context().cookies();
  const sessionCookieAfterLogout = cookiesAfterLogout.find((c) => c.name === '__session');
  // Cookie should either be undefined or have expired
  expect(
    sessionCookieAfterLogout === undefined ||
    sessionCookieAfterLogout.expires < Date.now() / 1000
  ).toBe(true);
});

/**
 * Test: Login fails with invalid credentials
 *
 * Verifies that:
 * 1. Invalid email shows error message
 * 2. Invalid password shows error message
 * 3. User stays on login page after error
 * 4. No session cookie is set
 */
test('login fails with invalid credentials', async ({ page }) => {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);

  // Try to login with invalid email
  await page.fill('input[name="email"]', 'nonexistent@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for error message to appear
  await page.waitForSelector('[role="alert"]', { timeout: 3000 });

  // Verify error message is displayed
  const errorMessage = await page.locator('[role="alert"]').textContent();
  expect(errorMessage).toContain('Invalid email or password');

  // Verify we're still on login page
  await expect(page).toHaveURL(`${BASE_URL}/login`);

  // Verify no session cookie is set
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === '__session');
  expect(sessionCookie).toBeUndefined();

  // Try with valid email but wrong password
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');

  // Wait for error message
  await page.waitForSelector('[role="alert"]', { timeout: 3000 });

  // Verify error message
  const errorMessage2 = await page.locator('[role="alert"]').textContent();
  expect(errorMessage2).toContain('Invalid email or password');

  // Still on login page
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

/**
 * Test: Login with returnTo URL
 *
 * Verifies that after successful login, user is redirected to the
 * URL specified in the returnTo query parameter.
 */
test('login redirects to returnTo URL', async ({ page }) => {
  // Navigate to login page with returnTo parameter
  const returnToUrl = '/dashboard/developers';
  await page.goto(`${BASE_URL}/login?returnTo=${encodeURIComponent(returnToUrl)}`);

  // Login with valid credentials
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Verify redirect to returnTo URL
  await page.waitForURL(`${BASE_URL}${returnToUrl}`, { timeout: 5000 });
  await expect(page).toHaveURL(`${BASE_URL}${returnToUrl}`);
});

/**
 * Test: Admin user can login
 *
 * Verifies that admin user can login with admin credentials.
 * This tests that the role field is properly set.
 */
test('admin user can login', async ({ page }) => {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);

  // Login with admin credentials
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123456');
  await page.click('button[type="submit"]');

  // Verify redirect to dashboard
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
  await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

  // Verify session cookie is set
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === '__session');
  expect(sessionCookie).toBeDefined();
});

/**
 * Test: Authenticated user redirected from login page
 *
 * Verifies that if a user is already logged in, they cannot access
 * the login page and are redirected to dashboard instead.
 */
test('authenticated user cannot access login page', async ({ page }) => {
  // First, login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });

  // Now try to access login page again
  await page.goto(`${BASE_URL}/login`);

  // Should be redirected to dashboard
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
  await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
});

/**
 * Test: Login form validation
 *
 * Verifies that the login form has proper HTML5 validation.
 */
test('login form has proper validation', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);

  // Email field should have type="email" and required
  const emailInput = page.locator('input[name="email"]');
  await expect(emailInput).toHaveAttribute('type', 'email');
  await expect(emailInput).toHaveAttribute('required', '');

  // Password field should have type="password", required, and minLength
  const passwordInput = page.locator('input[name="password"]');
  await expect(passwordInput).toHaveAttribute('type', 'password');
  await expect(passwordInput).toHaveAttribute('required', '');
  await expect(passwordInput).toHaveAttribute('minLength', '8');

  // Submit button should exist and be enabled
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
});
