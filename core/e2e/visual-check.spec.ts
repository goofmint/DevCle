import { test, expect } from '@playwright/test';

/**
 * E2E Visual Check Tests
 *
 * Tests to verify:
 * - Dark mode toggle works correctly
 * - Text is readable in dark mode (sufficient contrast)
 * - Header design is consistent across pages
 * - Footer design is consistent across pages
 */

test.describe('Visual Check', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure consistent state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('Landing page - dark mode text contrast', async ({ page }) => {
    await page.goto('/');

    // Toggle to dark mode
    const darkModeToggle = page.getByRole('button', { name: /Switch to dark mode/i });
    await darkModeToggle.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Check hero section text color in dark mode
    const heroTitle = page.getByRole('heading', { level: 1, name: /Developer Relationship Management/i });
    const heroTitleColor = await heroTitle.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Check background color
    const heroSection = page.locator('section[aria-label="Hero section"]');
    const heroBgColor = await heroSection.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Hero title color (dark mode):', heroTitleColor);
    console.log('Hero background color (dark mode):', heroBgColor);

    // Hero title should be white (rgb(255, 255, 255)) or very light color
    expect(heroTitleColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/);

    // Features section text
    const featureTitle = page.getByRole('heading', { level: 3 }).first();
    const featureTitleColor = await featureTitle.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    const featureCard = page.getByRole('article').first();
    const featureCardBgColor = await featureCard.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Feature title color (dark mode):', featureTitleColor);
    console.log('Feature card background (dark mode):', featureCardBgColor);

    // Feature title should be white or very light
    expect(featureTitleColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/);
  });

  test('Terms page - dark mode text contrast', async ({ page }) => {
    await page.goto('/terms');

    // Toggle to dark mode
    const darkModeToggle = page.getByRole('button', { name: /Switch to dark mode/i });
    await darkModeToggle.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Check main heading color in dark mode
    const mainHeading = page.getByRole('heading', { level: 1, name: /Terms of Service/i });
    const headingColor = await mainHeading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    console.log('Terms heading color (dark mode):', headingColor);

    // Heading should be white or very light color (not black)
    expect(headingColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/);

    // Check paragraph text color
    const paragraph = page.locator('article p').first();
    const paragraphColor = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    console.log('Terms paragraph color (dark mode):', paragraphColor);

    // Paragraph should be light gray or white (not black)
    // Should NOT be rgb(0, 0, 0) or very dark colors like rgb(17, 24, 39)
    expect(paragraphColor).not.toMatch(/rgb\(0,\s*0,\s*0\)/);
    expect(paragraphColor).not.toMatch(/rgb\([0-9],\s*[0-9],\s*[0-9]\)/);
    expect(paragraphColor).not.toMatch(/rgb\([0-5][0-9],\s*[0-5][0-9],\s*[0-5][0-9]\)/);

    // Check background color
    const article = page.locator('article');
    const articleBgColor = await article.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Terms article background (dark mode):', articleBgColor);
  });

  test('Header design consistency', async ({ page }) => {
    // Get header styles from landing page
    await page.goto('/');
    const landingHeader = page.getByRole('banner');
    const landingHeaderClasses = await landingHeader.getAttribute('class');
    const landingLogo = page.getByRole('link', { name: /DevCle Home/i });
    const landingLogoExists = await landingLogo.count();

    // Get header styles from terms page
    await page.goto('/terms');
    const termsHeader = page.getByRole('banner');
    const termsHeaderClasses = await termsHeader.getAttribute('class');
    const termsLogo = page.getByRole('link', { name: /DevCle Home/i });
    const termsLogoExists = await termsLogo.count();

    console.log('Landing header classes:', landingHeaderClasses);
    console.log('Terms header classes:', termsHeaderClasses);

    // Both pages should have a header
    expect(landingHeaderClasses).toBeTruthy();
    expect(termsHeaderClasses).toBeTruthy();

    // Both should have the logo link
    expect(landingLogoExists).toBeGreaterThan(0);
    expect(termsLogoExists).toBeGreaterThan(0);

    // Both should have dark mode toggle
    const landingToggle = await page.getByRole('button', { name: /Switch to (dark|light) mode/i }).count();
    await page.goto('/terms');
    const termsToggle = await page.getByRole('button', { name: /Switch to (dark|light) mode/i }).count();

    expect(landingToggle).toBeGreaterThan(0);
    expect(termsToggle).toBeGreaterThan(0);
  });

  test('Footer design consistency', async ({ page }) => {
    // Get footer from landing page
    await page.goto('/');
    const landingFooter = page.getByRole('contentinfo');
    const landingFooterClasses = await landingFooter.getAttribute('class');
    const landingTermsLink = await page.getByRole('link', { name: /Terms of Service/i }).count();

    // Get footer from terms page
    await page.goto('/terms');
    const termsFooter = page.getByRole('contentinfo');
    const termsFooterClasses = await termsFooter.getAttribute('class');
    const termsTermsLink = await page.getByRole('link', { name: /Terms of Service/i }).count();

    console.log('Landing footer classes:', landingFooterClasses);
    console.log('Terms footer classes:', termsFooterClasses);

    // Both pages should have a footer
    expect(landingFooterClasses).toBeTruthy();
    expect(termsFooterClasses).toBeTruthy();

    // Both should have Terms of Service link
    expect(landingTermsLink).toBeGreaterThan(0);
    expect(termsTermsLink).toBeGreaterThan(0);
  });

  test('Dark mode toggle persistence', async ({ page }) => {
    await page.goto('/');

    // Toggle to dark mode
    const darkModeToggle = page.getByRole('button', { name: /Switch to dark mode/i });
    await darkModeToggle.click();
    await page.waitForTimeout(500);

    // Navigate to terms page
    await page.goto('/terms');
    await page.waitForTimeout(500);

    // Check if still in dark mode by checking localStorage
    const darkModeValue = await page.evaluate(() => {
      return localStorage.getItem('darkMode');
    });

    console.log('Dark mode value after navigation:', darkModeValue);
    expect(darkModeValue).toBe('true');

    // Check visual confirmation - heading should be light colored
    const heading = page.getByRole('heading', { level: 1, name: /Terms of Service/i });
    const headingColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    console.log('Terms heading color after dark mode navigation:', headingColor);
    expect(headingColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/);
  });
});
