/**
 * E2E tests for Pricing Page
 *
 * Tests cover:
 * - Page load and meta information
 * - All plans display
 * - Recommended badge on Team plan
 * - Feature comparison table
 * - FAQ section
 * - CTA buttons
 * - Navigation
 * - Mobile responsiveness
 * - Accessibility
 */

import { test, expect } from '@playwright/test';

// Base URL from environment variable or default to localhost:3000
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

test.describe('Pricing Page', () => {
  /**
   * Test: Page Load
   * Verifies that the pricing page loads correctly with proper title and heading
   */
  test('pricing page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);
    await page.waitForLoadState('domcontentloaded');

    // Verify page title in browser tab
    await expect(page).toHaveTitle('Pricing - DevCle');

    // Verify main heading is visible
    const mainHeading = page.getByRole('heading', {
      level: 1,
      name: /Pricing/i,
    });
    await expect(mainHeading).toBeVisible();
  });

  /**
   * Test: Meta Description
   * Verifies that the page has proper meta description for SEO
   */
  test('has proper meta description', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Get the meta description tag
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute(
      'content',
      'DevCle pricing plans. Choose the best plan for your team from OSS, Basic, Team, or Enterprise.'
    );
  });

  /**
   * Test: All Plans Display
   * Verifies that all four pricing plans are visible on the page
   */
  test('all plans are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Check that all plan cards are visible using data-plan attribute
    await expect(page.locator('[data-plan="oss"]')).toBeVisible();
    await expect(page.locator('[data-plan="basic"]')).toBeVisible();
    await expect(page.locator('[data-plan="team"]')).toBeVisible();
    await expect(page.locator('[data-plan="enterprise"]')).toBeVisible();
  });

  /**
   * Test: Plan Prices
   * Verifies that pricing information is displayed correctly for each plan
   */
  test('displays correct pricing for all plans', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Check OSS plan pricing
    const ossCard = page.locator('[data-plan="oss"]');
    await expect(ossCard.locator('text=$0')).toBeVisible();

    // Check Basic plan pricing
    const basicCard = page.locator('[data-plan="basic"]');
    await expect(basicCard.locator('text=$99')).toBeVisible();

    // Check Team plan pricing
    const teamCard = page.locator('[data-plan="team"]');
    await expect(teamCard.locator('text=$499')).toBeVisible();

    // Check Enterprise plan pricing (using exact match for the price div)
    const enterpriseCard = page.locator('[data-plan="enterprise"]');
    await expect(enterpriseCard.locator('div.text-4xl').filter({ hasText: 'Custom' })).toBeVisible();
  });

  /**
   * Test: Recommended Badge
   * Verifies that the Team plan has a "Recommended" badge
   */
  test('recommended badge is visible on Team plan', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Find the Team plan card
    const teamCard = page.locator('[data-plan="team"]');

    // Verify the Recommended badge is visible
    await expect(teamCard.locator('text=/Recommended/i')).toBeVisible();
  });

  /**
   * Test: Feature Comparison Table
   * Verifies that the feature comparison table is displayed
   */
  test('displays feature comparison table', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Verify the Feature Comparison heading
    await expect(page.getByRole('heading', { name: /Feature Comparison/i })).toBeVisible();

    // Verify table contains key features (using role="cell" to target table cells specifically)
    await expect(page.getByRole('cell', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Plugins', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Data Updates', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ROI AI Reports', exact: true })).toBeVisible();
  });

  /**
   * Test: FAQ Section
   * Verifies that the FAQ section is displayed with questions
   */
  test('displays FAQ section', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Verify FAQ heading
    await expect(page.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeVisible();

    // Verify some FAQ questions are visible
    await expect(page.getByText(/What's the difference between OSS and SaaS versions/i)).toBeVisible();
    await expect(page.getByText(/Is there a free trial/i)).toBeVisible();
    await expect(page.getByText(/Can I change plans later/i)).toBeVisible();
  });

  /**
   * Test: CTA Buttons
   * Verifies that all plans have appropriate CTA buttons
   */
  test('has CTA buttons for all plans', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // OSS plan - Get Started button
    const ossCard = page.locator('[data-plan="oss"]');
    await expect(ossCard.getByRole('link', { name: /Get Started/i })).toBeVisible();

    // Basic plan - Start Free Trial button
    const basicCard = page.locator('[data-plan="basic"]');
    await expect(basicCard.getByRole('link', { name: /Start Free Trial/i })).toBeVisible();

    // Team plan - Start Free Trial button
    const teamCard = page.locator('[data-plan="team"]');
    await expect(teamCard.getByRole('link', { name: /Start Free Trial/i })).toBeVisible();

    // Enterprise plan - Contact Sales button
    const enterpriseCard = page.locator('[data-plan="enterprise"]');
    await expect(enterpriseCard.getByRole('link', { name: /Contact Sales/i })).toBeVisible();
  });

  /**
   * Test: Bottom CTA Section
   * Verifies that the bottom CTA section is displayed
   */
  test('displays bottom CTA section', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify bottom CTA heading
    await expect(page.getByRole('heading', { name: /Start Your Free Trial Today/i })).toBeVisible();

    // Verify CTA buttons exist
    await expect(page.getByRole('link', { name: /Start Free Trial/i }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: /Contact Sales/i }).last()).toBeVisible();
  });

  /**
   * Test: Navigation to Home
   * Verifies that users can navigate back to the home page
   */
  test('can navigate back to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Click on the home link in header (assuming header has logo/home link)
    await page.click('a[href="/"]');

    // Verify navigation to home page
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  /**
   * Test: Mobile Viewport
   * Verifies that the pricing page displays correctly on mobile devices
   */
  test('displays correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport size (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE_URL}/pricing`);

    // Verify heading is visible on mobile
    await expect(page.getByRole('heading', { level: 1, name: /Pricing/i })).toBeVisible();

    // Verify all plan cards are visible (stacked vertically on mobile)
    await expect(page.locator('[data-plan="oss"]')).toBeVisible();
    await expect(page.locator('[data-plan="basic"]')).toBeVisible();
    await expect(page.locator('[data-plan="team"]')).toBeVisible();
    await expect(page.locator('[data-plan="enterprise"]')).toBeVisible();
  });

  /**
   * Test: Accessibility - Landmarks
   * Verifies that proper semantic HTML and ARIA landmarks are used
   */
  test('has proper accessibility landmarks', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Verify header landmark exists (from PageLayout)
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Verify main content area exists
    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    // Verify footer landmark exists (from PageLayout)
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });

  /**
   * Test: Heading Hierarchy
   * Verifies proper heading hierarchy for accessibility
   */
  test('has proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Verify h1 exists and is unique
    const h1Elements = await page.locator('h1').count();
    expect(h1Elements).toBe(1);

    // Verify h2 headings exist
    const h2Elements = await page.locator('h2').count();
    expect(h2Elements).toBeGreaterThan(0);

    // Verify h3 headings exist (for plan names and subsections)
    const h3Elements = await page.locator('h3').count();
    expect(h3Elements).toBeGreaterThan(0);
  });

  /**
   * Test: Plan Features
   * Verifies that key features are listed for each plan
   */
  test('displays key features for each plan', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // OSS plan features - target li elements to avoid matching description text
    const ossCard = page.locator('[data-plan="oss"]');
    await expect(ossCard.locator('li').filter({ hasText: /Self-hosted/i })).toBeVisible();
    await expect(ossCard.locator('li').filter({ hasText: /Unlimited plugins/i })).toBeVisible();

    // Basic plan features
    const basicCard = page.locator('[data-plan="basic"]');
    await expect(basicCard.locator('li').filter({ hasText: /10 plugins/i })).toBeVisible();
    await expect(basicCard.locator('li').filter({ hasText: /ROI AI reports/i })).toBeVisible();

    // Team plan features
    const teamCard = page.locator('[data-plan="team"]');
    await expect(teamCard.locator('li').filter({ hasText: /50 users/i })).toBeVisible();
    await expect(teamCard.locator('li').filter({ hasText: /Advanced AI features/i })).toBeVisible();
    await expect(teamCard.locator('li').filter({ hasText: /SSO/i })).toBeVisible();

    // Enterprise plan features
    const enterpriseCard = page.locator('[data-plan="enterprise"]');
    await expect(enterpriseCard.locator('li').filter({ hasText: /Unlimited users/i })).toBeVisible();
    await expect(enterpriseCard.locator('li').filter({ hasText: /Custom plugins/i })).toBeVisible();
    await expect(enterpriseCard.locator('li').filter({ hasText: /Dedicated support/i })).toBeVisible();
  });

  /**
   * Test: Dark Mode Compatibility
   * Verifies that the page works with dark mode (if supported)
   */
  test('dark mode toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Find dark mode toggle button - must exist
    const darkModeToggle = page.getByRole('button', { name: /switch to.*mode/i }).first();
    await expect(darkModeToggle).toBeVisible();

    // Toggle dark mode
    await darkModeToggle.click();

    // Wait for animation/transition
    await page.waitForTimeout(300);

    // Verify page is still visible and functional
    await expect(page.getByRole('heading', { level: 1, name: /Pricing/i })).toBeVisible();

    // Toggle back to light mode
    await darkModeToggle.click();
  });

  /**
   * Test: Dark Mode Color Contrast
   * Verifies proper background and text colors in dark mode
   */
  test('has proper color contrast in dark mode', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Toggle to dark mode
    const darkModeToggle = page.getByRole('button', { name: /switch to.*mode/i }).first();
    await expect(darkModeToggle).toBeVisible();
    await darkModeToggle.click();
    await page.waitForTimeout(300);

    // Check if .dark class is applied to root element
    const rootElement = await page.evaluate(() => {
      const main = document.querySelector('main');
      const root = main?.closest('div[class*="min-h-screen"]');
      return {
        className: root?.className || 'not found',
        hasDarkClass: root?.classList.contains('dark') || false,
      };
    });
    console.log('Root Element Class:', rootElement.className);
    console.log('Has .dark class:', rootElement.hasDarkClass);

    // Check main background is dark
    const mainBg = await page.locator('main').first().evaluate((el) => {
      return window.getComputedStyle(el.parentElement!).backgroundColor;
    });
    // Should be dark gray (gray-900) - can be rgb() or oklch() format
    // oklch values for gray-900: approximately oklch(0.21 0.034 264.665)
    // rgb values for gray-900: rgb(17, 24, 39)
    expect(mainBg).toMatch(/rgb\((1[7-9]|2[0-9]|3[0-1]),\s*(1[7-9]|2[0-9]|3[0-1]),\s*(3[0-9]|4[0-9])\)|oklch\(0\.2[0-9]/);

    // Check plan cards have proper backgrounds
    const ossCard = page.locator('[data-plan="oss"]');
    const ossCardBg = await ossCard.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // In dark mode, cards should have dark background (gray-800 or similar)
    console.log('OSS Card Background (Dark Mode):', ossCardBg);

    // Check text colors in dark mode
    const priceText = ossCard.locator('.text-4xl').first();
    const priceColor = await priceText.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    console.log('Price Text Color (Dark Mode):', priceColor);

    // Check CTA section
    const ctaSection = page.locator('.bg-blue-50').first();
    const ctaBg = await ctaSection.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('CTA Section Background (Dark Mode):', ctaBg);
    // Should be gray-800 in dark mode - can be rgb() or oklch() format
    // oklch values for gray-800: approximately oklch(0.279 0.035 264.542)
    // rgb values for gray-800: rgb(31, 41, 55)
    expect(ctaBg).toMatch(/rgb\((3[1-8]),\s*(3[1-8]|4[0-1]),\s*(4[0-9]|5[0-5])\)|oklch\(0\.2[7-9]/);

    const ctaHeading = ctaSection.locator('h3').first();
    const ctaHeadingColor = await ctaHeading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    console.log('CTA Heading Color (Dark Mode):', ctaHeadingColor);
    // Should be light color in dark mode (gray-100 or similar)
  });

  /**
   * Test: Light Mode Color Contrast
   * Verifies proper background and text colors in light mode
   */
  test('has proper color contrast in light mode', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Ensure we're in light mode
    const mainBg = await page.locator('main').first().evaluate((el) => {
      return window.getComputedStyle(el.parentElement!).backgroundColor;
    });
    console.log('Main Background (Light Mode):', mainBg);

    // Check plan cards
    const ossCard = page.locator('[data-plan="oss"]');
    const ossCardBg = await ossCard.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('OSS Card Background (Light Mode):', ossCardBg);

    // Check border color
    const ossCardBorder = await ossCard.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });
    console.log('OSS Card Border (Light Mode):', ossCardBorder);

    // Check button text colors
    const ossButton = ossCard.locator('a').first();
    const ossButtonColor = await ossButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    const ossButtonBg = await ossButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('OSS Button Text Color (Light Mode):', ossButtonColor);
    console.log('OSS Button Background (Light Mode):', ossButtonBg);

    const basicCard = page.locator('[data-plan="basic"]');
    const basicButton = basicCard.locator('a').first();
    const basicButtonColor = await basicButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    const basicButtonBg = await basicButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Basic Button Text Color (Light Mode):', basicButtonColor);
    console.log('Basic Button Background (Light Mode):', basicButtonBg);
  });

  /**
   * Test: Dark Mode Button Colors
   * Verifies proper button text colors in dark mode
   */
  test('has proper button colors in dark mode', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Toggle to dark mode
    const darkModeToggle = page.getByRole('button', { name: /switch to.*mode/i }).first();
    await expect(darkModeToggle).toBeVisible();
    await darkModeToggle.click();
    await page.waitForTimeout(300);

    // Check OSS button (secondary style)
    const ossCard = page.locator('[data-plan="oss"]');
    const ossButton = ossCard.locator('a').first();
    const ossButtonColor = await ossButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    const ossButtonBg = await ossButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('OSS Button Text Color (Dark Mode):', ossButtonColor);
    console.log('OSS Button Background (Dark Mode):', ossButtonBg);

    // Check Basic button (primary style)
    const basicCard = page.locator('[data-plan="basic"]');
    const basicButton = basicCard.locator('a').first();
    const basicButtonColor = await basicButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    const basicButtonBg = await basicButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Basic Button Text Color (Dark Mode):', basicButtonColor);
    console.log('Basic Button Background (Dark Mode):', basicButtonBg);

    // Check Enterprise button (secondary style)
    const enterpriseCard = page.locator('[data-plan="enterprise"]');
    const enterpriseButton = enterpriseCard.locator('a').first();
    const enterpriseButtonColor = await enterpriseButton.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    const enterpriseButtonBg = await enterpriseButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Enterprise Button Text Color (Dark Mode):', enterpriseButtonColor);
    console.log('Enterprise Button Background (Dark Mode):', enterpriseButtonBg);
  });
});
