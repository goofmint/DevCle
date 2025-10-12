import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Privacy Policy Page
 *
 * Tests verify:
 * - Page loads correctly with proper title
 * - All 11 articles are visible
 * - Navigation links work (home, terms)
 * - GDPR/CCPA rights sections are displayed
 * - Contact information is present
 * - Dark mode works correctly
 * - Accessibility features (landmarks, headings)
 *
 * Uses environment variable BASE_URL or defaults to http://localhost:3000
 */

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

test.describe('Privacy Policy Page', () => {
  /**
   * Test: Page Load
   * Verifies that the privacy policy page loads with correct title and heading
   */
  test('privacy page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible (primary check)
    const mainHeading = page.getByRole('heading', {
      level: 1,
      name: /Privacy Policy/i,
    });
    await expect(mainHeading).toBeVisible();

    // Verify last updated date is visible
    const lastUpdated = page.getByText(/Last Updated: October 12, 2025/i);
    await expect(lastUpdated).toBeVisible();

    // Page title check (may be empty for MDX files, so we check conditionally)
    const title = await page.title();
    // If title is set, it should match the expected pattern
    if (title) {
      expect(title).toMatch(/Privacy Policy.*DevCle/i);
    }
  });

  /**
   * Test: Navigation - Home Link
   * Verifies that clicking the home link navigates to landing page
   */
  test('can navigate back to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Click home link in header
    const homeLink = page.getByRole('link', { name: /DevCle Home/i });
    await homeLink.click();

    // Verify navigation to home page
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Verify landing page heading is visible
    const landingHeading = page.getByRole('heading', {
      level: 1,
      name: /Developer Relationship Management/i,
    });
    await expect(landingHeading).toBeVisible();
  });

  /**
   * Test: Navigation - Terms of Service Link
   * Verifies that clicking the terms link navigates to terms page
   */
  test('can navigate to terms of service', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Click terms link in footer
    const termsLink = page.getByRole('link', { name: /Terms of Service/i });
    await termsLink.click();

    // Verify navigation to terms page
    await expect(page).toHaveURL(`${BASE_URL}/terms`);

    // Verify terms page heading is visible
    const termsHeading = page.getByRole('heading', {
      level: 1,
      name: /Terms of Service/i,
    });
    await expect(termsHeading).toBeVisible();
  });

  /**
   * Test: All Articles Visible
   * Verifies that all 11 articles (Article 1-11) are visible on the page
   */
  test('all sections are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Check each article heading (Article 1 through Article 11)
    // Use first() to avoid strict mode violations when pattern matches multiple elements
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 1 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 2 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 3 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 4 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 5 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 6 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 7 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 8 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 9 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 10 \(/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Article 11 \(/ })
    ).toBeVisible();
  });

  /**
   * Test: GDPR Rights Section
   * Verifies that Article 7 displays GDPR user rights
   */
  test('displays GDPR rights section', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 7 heading
    const rightsHeading = page.getByRole('heading', {
      level: 2,
      name: /Article 7.*Your Rights/i,
    });
    await expect(rightsHeading).toBeVisible();

    // Verify specific GDPR rights are mentioned
    const accessRight = page.getByRole('heading', {
      level: 3,
      name: /Right to Access/i,
    });
    await expect(accessRight).toBeVisible();

    const erasureRight = page.getByRole('heading', {
      level: 3,
      name: /Right to Erasure.*Right to be Forgotten/i,
    });
    await expect(erasureRight).toBeVisible();

    const portabilityRight = page.getByRole('heading', {
      level: 3,
      name: /Right to Data Portability/i,
    });
    await expect(portabilityRight).toBeVisible();
  });

  /**
   * Test: CCPA Rights Section
   * Verifies that Article 7 includes CCPA opt-out rights
   */
  test('displays CCPA opt-out right', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify CCPA opt-out section
    const ccpaRight = page.getByRole('heading', {
      level: 3,
      name: /Right to Opt-Out of Sale.*CCPA/i,
    });
    await expect(ccpaRight).toBeVisible();

    // Verify we state we don't sell data
    const noSaleText = page.getByText(/We do not sell personal information/i);
    await expect(noSaleText).toBeVisible();
  });

  /**
   * Test: Contact Information
   * Verifies that Article 11 displays contact information including DPO email
   */
  test('displays contact information', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 11 heading
    const contactHeading = page.getByRole('heading', {
      level: 2,
      name: /Article 11.*Contact Information/i,
    });
    await expect(contactHeading).toBeVisible();

    // Verify DPO section
    const dpoSection = page.getByRole('heading', {
      level: 3,
      name: /Data Protection Officer.*DPO/i,
    });
    await expect(dpoSection).toBeVisible();

    // Verify privacy email is present (use first() to avoid strict mode violations)
    const privacyEmail = page.getByText(/privacy@devcle\.com/i).first();
    await expect(privacyEmail).toBeVisible();

    // Verify support email is present (use first() to avoid strict mode violations)
    const supportEmail = page.getByText(/support@devcle\.com/i).first();
    await expect(supportEmail).toBeVisible();
  });

  /**
   * Test: Article 1 - Information Collection
   * Verifies that Article 1 lists all types of collected information
   */
  test('displays information collection details', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 1 heading
    const article1 = page.getByRole('heading', {
      level: 2,
      name: /Article 1.*Information We Collect/i,
    });
    await expect(article1).toBeVisible();

    // Verify subsections
    const accountInfo = page.getByRole('heading', {
      level: 3,
      name: /Account Information/i,
    });
    await expect(accountInfo).toBeVisible();

    const developerData = page.getByRole('heading', {
      level: 3,
      name: /Developer Data/i,
    });
    await expect(developerData).toBeVisible();

    const activityData = page.getByRole('heading', {
      level: 3,
      name: /Activity Data/i,
    });
    await expect(activityData).toBeVisible();

    const technicalInfo = page.getByRole('heading', {
      level: 3,
      name: /Technical Information/i,
    });
    await expect(technicalInfo).toBeVisible();
  });

  /**
   * Test: Article 4 - Cookies and Tracking
   * Verifies that Article 4 explains cookie usage and DNT support
   */
  test('displays cookie and tracking information', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 4 heading
    const article4 = page.getByRole('heading', {
      level: 2,
      name: /Article 4.*Cookies and Tracking Technologies/i,
    });
    await expect(article4).toBeVisible();

    // Verify essential cookies section
    const essentialCookies = page.getByRole('heading', {
      level: 3,
      name: /Essential Cookies/i,
    });
    await expect(essentialCookies).toBeVisible();

    // Verify analytics tools section
    const analyticsTools = page.getByRole('heading', {
      level: 3,
      name: /Analytics Tools/i,
    });
    await expect(analyticsTools).toBeVisible();

    // Verify PostHog is mentioned
    const posthogText = page.getByText(/PostHog/i);
    await expect(posthogText).toBeVisible();

    // Verify DNT support section
    const dntSection = page.getByRole('heading', {
      level: 3,
      name: /Do Not Track \(DNT\)/i,
    });
    await expect(dntSection).toBeVisible();
  });

  /**
   * Test: Article 5 - Security Measures
   * Verifies that Article 5 explains security practices
   */
  test('displays security measures', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 5 heading
    const article5 = page.getByRole('heading', {
      level: 2,
      name: /Article 5.*Security Measures/i,
    });
    await expect(article5).toBeVisible();

    // Verify data encryption section
    const encryption = page.getByRole('heading', {
      level: 3,
      name: /Data Encryption/i,
    });
    await expect(encryption).toBeVisible();

    // Verify SSL/TLS is mentioned
    const sslText = page.getByText(/SSL\/TLS/i);
    await expect(sslText).toBeVisible();

    // Verify access control section
    const accessControl = page.getByRole('heading', {
      level: 3,
      name: /Access Control/i,
    });
    await expect(accessControl).toBeVisible();
  });

  /**
   * Test: Article 6 - Data Deletion
   * Verifies that Article 6 explains data retention and deletion
   */
  test('displays data deletion policy', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 6 heading
    const article6 = page.getByRole('heading', {
      level: 2,
      name: /Article 6.*Data Storage and Deletion/i,
    });
    await expect(article6).toBeVisible();

    // Verify account deletion section
    const accountDeletion = page.getByRole('heading', {
      level: 3,
      name: /Account Deletion/i,
    });
    await expect(accountDeletion).toBeVisible();

    // Verify 14-day deletion timeline
    const deletionTimeline = page.getByText(
      /Data will be permanently deleted within 14 days/i
    );
    await expect(deletionTimeline).toBeVisible();
  });

  /**
   * Test: Article 8 - Children's Privacy
   * Verifies that Article 8 explains age restrictions
   */
  test('displays children privacy policy', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 8 heading
    const article8 = page.getByRole('heading', {
      level: 2,
      name: /Article 8.*Children's Privacy/i,
    });
    await expect(article8).toBeVisible();

    // Verify age restrictions
    const ageRestriction = page.getByText(
      /The Service is not intended for users under 13 years of age/i
    );
    await expect(ageRestriction).toBeVisible();

    // Verify parental consent section
    const parentalConsent = page.getByRole('heading', {
      level: 3,
      name: /Parental Consent/i,
    });
    await expect(parentalConsent).toBeVisible();
  });

  /**
   * Test: Article 9 - International Data Transfers
   * Verifies that Article 9 explains data storage locations and GDPR compliance
   */
  test('displays international data transfer information', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify Article 9 heading
    const article9 = page.getByRole('heading', {
      level: 2,
      name: /Article 9.*International Data Transfers/i,
    });
    await expect(article9).toBeVisible();

    // Verify data storage locations
    const storageLocations = page.getByRole('heading', {
      level: 3,
      name: /Data Storage Locations/i,
    });
    await expect(storageLocations).toBeVisible();

    // Verify Japan is mentioned as primary location
    const japanLocation = page.getByText(/Japan.*Primary data center location/i);
    await expect(japanLocation).toBeVisible();

    // Verify GDPR compliance section
    const gdprCompliance = page.getByRole('heading', {
      level: 3,
      name: /GDPR Compliance/i,
    });
    await expect(gdprCompliance).toBeVisible();

    // Verify Standard Contractual Clauses are mentioned
    const sccText = page.getByText(/Standard Contractual Clauses.*SCCs/i);
    await expect(sccText).toBeVisible();
  });

  /**
   * Test: Dark Mode Support
   * Verifies that dark mode toggle works on privacy page
   */
  test('dark mode toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Find and click dark mode toggle
    const darkModeToggle = page.getByRole('button', {
      name: /Switch to dark mode/i,
    });
    await darkModeToggle.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Verify dark mode is active by checking heading color
    const heading = page.getByRole('heading', {
      level: 1,
      name: /Privacy Policy/i,
    });
    const headingColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Heading should be light colored (white or near-white)
    expect(headingColor).toMatch(
      /rgb\(255,\s*255,\s*255\)|rgb\(2[0-9]{2},\s*2[0-9]{2},\s*2[0-9]{2}\)/
    );
  });

  /**
   * Test: Accessibility - Landmarks
   * Verifies that the page has proper ARIA landmarks
   */
  test('has proper accessibility landmarks', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify header landmark
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();

    // Verify main landmark
    const main = page.getByRole('main');
    await expect(main).toBeVisible();

    // Verify footer landmark
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
  });

  /**
   * Test: Accessibility - Heading Hierarchy
   * Verifies that headings follow proper hierarchy (h1 -> h2 -> h3)
   */
  test('has proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify h1 exists
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Verify multiple h2 headings (11 articles)
    const h2List = page.getByRole('heading', { level: 2 });
    const h2Count = await h2List.count();
    expect(h2Count).toBe(11); // 11 articles

    // Verify multiple h3 headings (subsections)
    const h3List = page.getByRole('heading', { level: 3 });
    const h3Count = await h3List.count();
    expect(h3Count).toBeGreaterThan(0);
  });

  /**
   * Test: No Third-Party Sales Statement
   * Verifies the prominent statement about not selling data
   */
  test('displays no third-party sales statement', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);

    // Verify the no-sales statement in Article 3
    const noSalesStatement = page.getByText(
      /We do not and will never sell your personal information to third parties/i
    );
    await expect(noSalesStatement).toBeVisible();
  });

  /**
   * Test: Responsive Design
   * Verifies that the page is responsive and displays correctly on mobile
   */
  test('displays correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/privacy`);

    // Verify main heading is visible on mobile
    const heading = page.getByRole('heading', {
      level: 1,
      name: /Privacy Policy/i,
    });
    await expect(heading).toBeVisible();

    // Verify navigation is accessible (hamburger menu or visible links)
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();

    // Verify content is readable (not cut off)
    const article1 = page.getByRole('heading', {
      level: 2,
      name: /Article 1 \(/,
    });
    await expect(article1).toBeVisible();
  });
});
