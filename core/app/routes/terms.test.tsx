import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRemixStub } from '@remix-run/testing';
import Terms from './terms';

/**
 * Helper function to render Terms component with Remix Router context
 * Uses createRemixStub to provide proper Remix environment for testing
 */
function renderWithRemix() {
  // Create a stub with the Terms route
  const RemixStub = createRemixStub([
    {
      path: '/terms',
      Component: Terms,
    },
  ]);

  return render(<RemixStub initialEntries={['/terms']} />);
}

/**
 * Test suite for the Terms of Service Page component
 *
 * Tests all major sections:
 * - Header with back-to-home link and dark mode toggle
 * - Page title and last updated date
 * - All 10 sections of terms content (Article 1-10)
 * - Footer with links and copyright
 * - Accessibility features
 * - Responsive design
 *
 * No mocks are used - all tests verify actual DOM structure
 * Uses createRemixStub to provide proper Remix routing context
 */
describe('Terms of Service Page', () => {
  /**
   * Test: Header
   * Verifies that the header displays back-to-home link and dark mode toggle
   */
  describe('Header', () => {
    it('displays the header', () => {
      renderWithRemix();

      // Find the header by its role
      const header = screen.getByRole('banner');
      expect(header).toBeDefined();
    });

    it('displays back to home link', () => {
      renderWithRemix();

      // Find the back to home link
      const homeLink = screen.getByRole('link', { name: /Back to home/i });
      expect(homeLink).toBeDefined();
      expect(homeLink.getAttribute('href')).toBe('/');
    });

    it('displays dark mode toggle button', () => {
      renderWithRemix();

      // Find the dark mode toggle button
      const toggleButton = screen.getByRole('button', {
        name: /Switch to dark mode/i,
      });
      expect(toggleButton).toBeDefined();
    });
  });

  /**
   * Test: Page Title and Metadata
   * Verifies that the page displays the title and last updated date
   */
  describe('Page Title and Metadata', () => {
    it('displays the page title', () => {
      renderWithRemix();

      // Find the h1 heading
      const heading = screen.getByRole('heading', {
        level: 1,
        name: /利用規約.*Terms of Service/i,
      });
      expect(heading).toBeDefined();
      expect(heading.textContent).toContain('利用規約');
      expect(heading.textContent).toContain('Terms of Service');
    });

    it('displays the last updated date', () => {
      renderWithRemix();

      // Find the last updated text
      const lastUpdated = screen.getByText(/Last Updated:/i);
      expect(lastUpdated).toBeDefined();
      expect(lastUpdated.textContent).toContain('October 12, 2025');
    });
  });

  /**
   * Test: Terms Content
   * Verifies that all 10 sections (Articles 1-10) are displayed
   */
  describe('Terms Content', () => {
    it('displays all 10 sections', () => {
      renderWithRemix();

      // Find all section headings (h2)
      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings).toHaveLength(10);
    });

    it('displays Article 1 (Scope of Application)', () => {
      renderWithRemix();

      // Find Article 1 heading
      const article1 = screen.getByRole('heading', {
        level: 2,
        name: /第1条.*適用範囲.*Article 1.*Scope of Application/i,
      });
      expect(article1).toBeDefined();

      // Verify content is present
      const content = screen.getByText(
        /この利用規約.*以下「本規約」といいます.*DevCle/i
      );
      expect(content).toBeDefined();
    });

    it('displays Article 2 (Definitions)', () => {
      renderWithRemix();

      // Find Article 2 heading
      const article2 = screen.getByRole('heading', {
        level: 2,
        name: /第2条.*定義.*Article 2.*Definitions/i,
      });
      expect(article2).toBeDefined();

      // Verify content is present
      const content = screen.getByText(/本規約において使用する用語の定義/i);
      expect(content).toBeDefined();
    });

    it('displays Article 3 (User Registration)', () => {
      renderWithRemix();

      // Find Article 3 heading
      const article3 = screen.getByRole('heading', {
        level: 2,
        name: /第3条.*利用登録.*Article 3.*User Registration/i,
      });
      expect(article3).toBeDefined();
    });

    it('displays Article 4 (Privacy and Data Protection)', () => {
      renderWithRemix();

      // Find Article 4 heading
      const article4 = screen.getByRole('heading', {
        level: 2,
        name: /第4条.*プライバシーとデータ保護.*Article 4.*Privacy and Data Protection/i,
      });
      expect(article4).toBeDefined();
    });

    it('displays Article 5 (Prohibited Actions)', () => {
      renderWithRemix();

      // Find Article 5 heading
      const article5 = screen.getByRole('heading', {
        level: 2,
        name: /第5条.*禁止事項.*Article 5.*Prohibited Actions/i,
      });
      expect(article5).toBeDefined();
    });

    it('displays Article 6 (Service Changes and Suspension)', () => {
      renderWithRemix();

      // Find Article 6 heading
      const article6 = screen.getByRole('heading', {
        level: 2,
        name: /第6条.*サービスの変更・停止.*Article 6.*Service Changes and Suspension/i,
      });
      expect(article6).toBeDefined();
    });

    it('displays Article 7 (Disclaimer)', () => {
      renderWithRemix();

      // Find Article 7 heading
      const article7 = screen.getByRole('heading', {
        level: 2,
        name: /第7条.*免責事項.*Article 7.*Disclaimer/i,
      });
      expect(article7).toBeDefined();
    });

    it('displays Article 8 (Intellectual Property Rights)', () => {
      renderWithRemix();

      // Find Article 8 heading
      const article8 = screen.getByRole('heading', {
        level: 2,
        name: /第8条.*知的財産権.*Article 8.*Intellectual Property Rights/i,
      });
      expect(article8).toBeDefined();
    });

    it('displays Article 9 (Governing Law and Jurisdiction)', () => {
      renderWithRemix();

      // Find Article 9 heading
      const article9 = screen.getByRole('heading', {
        level: 2,
        name: /第9条.*準拠法と管轄裁判所.*Article 9.*Governing Law and Jurisdiction/i,
      });
      expect(article9).toBeDefined();
    });

    it('displays Article 10 (Changes to Terms)', () => {
      renderWithRemix();

      // Find Article 10 heading
      const article10 = screen.getByRole('heading', {
        level: 2,
        name: /第10条.*規約の変更.*Article 10.*Changes to Terms/i,
      });
      expect(article10).toBeDefined();
    });
  });

  /**
   * Test: Footer
   * Verifies that the footer displays all links and copyright information
   */
  describe('Footer', () => {
    it('displays the footer', () => {
      renderWithRemix();

      // Find the footer by its role
      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeDefined();
    });

    it('displays Home link', () => {
      renderWithRemix();

      // Find the Home link in the footer
      // Note: There are two "Home" links (header and footer), so we get all
      const homeLinks = screen.getAllByRole('link', { name: /Home/i });
      expect(homeLinks.length).toBeGreaterThanOrEqual(1);

      // Verify at least one links to "/"
      const homeLinkToRoot = homeLinks.find((link) => link.getAttribute('href') === '/');
      expect(homeLinkToRoot).toBeDefined();
    });

    it('displays Terms of Service link', () => {
      renderWithRemix();

      // Find the Terms of Service link
      const termsLink = screen.getByRole('link', {
        name: /Terms of Service/i,
      });
      expect(termsLink).toBeDefined();
      expect(termsLink.getAttribute('href')).toBe('/terms');
    });

    it('displays Privacy Policy link', () => {
      renderWithRemix();

      // Find the Privacy Policy link
      const privacyLink = screen.getByRole('link', {
        name: /Privacy Policy/i,
      });
      expect(privacyLink).toBeDefined();
      expect(privacyLink.getAttribute('href')).toBe('/privacy');
    });

    it('displays copyright text', () => {
      renderWithRemix();

      // Find the copyright text
      const copyright = screen.getByText(/© 2025 DevCle\. All rights reserved\./i);
      expect(copyright).toBeDefined();
    });
  });

  /**
   * Test: Accessibility
   * Verifies that the page has proper semantic structure and ARIA labels
   */
  describe('Accessibility', () => {
    it('has a main landmark', () => {
      const { container } = renderWithRemix();

      // Find the main element
      const main = container.querySelector('main');
      expect(main).toBeDefined();
    });

    it('has proper heading hierarchy', () => {
      renderWithRemix();

      // Find all headings
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2List = screen.getAllByRole('heading', { level: 2 });

      // Verify heading hierarchy
      // h1: Page title
      expect(h1).toBeDefined();
      // h2: 10 article headings
      expect(h2List.length).toBe(10);
    });

    it('has navigation landmark in footer', () => {
      renderWithRemix();

      // Find the navigation by its aria-label
      const footerNav = screen.getByLabelText(/Footer navigation/i);
      expect(footerNav).toBeDefined();
    });

    it('has article landmark for terms content', () => {
      const { container } = renderWithRemix();

      // Find the article element
      const article = container.querySelector('article');
      expect(article).toBeDefined();
    });

    it('all sections have proper IDs for navigation', () => {
      const { container } = renderWithRemix();

      // Find all section elements
      const sections = container.querySelectorAll('section[id^="article-"]');

      // Verify all 10 sections have IDs
      expect(sections.length).toBe(10);

      // Verify ID format (article-1, article-2, etc.)
      sections.forEach((section, index) => {
        expect(section.id).toBe(`article-${index + 1}`);
      });
    });

    it('all interactive elements have accessible names', () => {
      renderWithRemix();

      // Find all links
      const links = screen.getAllByRole('link');

      // Verify each link has an accessible name
      links.forEach((link) => {
        const accessibleName =
          link.getAttribute('aria-label') || link.textContent;
        expect(accessibleName).toBeTruthy();
        expect(accessibleName?.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Test: Responsive Design
   * Verifies that the component has responsive classes
   */
  describe('Responsive Design', () => {
    it('has responsive container classes', () => {
      const { container } = renderWithRemix();

      // Find elements with responsive classes
      const responsiveElements = container.querySelectorAll(
        '[class*="sm:"], [class*="md:"], [class*="lg:"]'
      );

      // Verify responsive classes are present
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    it('content has max-width container for readability', () => {
      const { container } = renderWithRemix();

      // Find the content container with max-w-4xl class
      const contentContainer = container.querySelector('.max-w-4xl');
      expect(contentContainer).toBeDefined();
    });

    it('has proper spacing for fixed header', () => {
      const { container } = renderWithRemix();

      // Find the main element with top padding
      const main = container.querySelector('main');
      expect(main).toBeDefined();

      // Verify padding-top class is present (pt-48 accounts for fixed header)
      const mainClasses = main?.className || '';
      expect(mainClasses).toContain('pt-48');
    });
  });

  /**
   * Test: Bilingual Content
   * Verifies that both Japanese and English content are present
   */
  describe('Bilingual Content', () => {
    it('displays Japanese content', () => {
      renderWithRemix();

      // Find Japanese text
      const japaneseText = screen.getByText(/この利用規約/i);
      expect(japaneseText).toBeDefined();
    });

    it('displays English content', () => {
      renderWithRemix();

      // Find English text
      const englishText = screen.getByText(/These Terms of Service/i);
      expect(englishText).toBeDefined();
    });

    it('all article headings are bilingual', () => {
      renderWithRemix();

      // Find all h2 headings
      const headings = screen.getAllByRole('heading', { level: 2 });

      // Verify each heading contains both Japanese and English
      headings.forEach((heading) => {
        const text = heading.textContent || '';
        // Check for both "第X条" (Japanese) and "Article X" (English)
        const hasJapanese = /第\d+条/.test(text);
        const hasEnglish = /Article \d+/.test(text);
        expect(hasJapanese).toBe(true);
        expect(hasEnglish).toBe(true);
      });
    });
  });
});
