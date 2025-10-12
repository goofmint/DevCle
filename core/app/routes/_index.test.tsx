import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRemixStub } from '@remix-run/testing';
import Index from './_index';

/**
 * Helper function to render component with Remix Router context
 * Uses createRemixStub to provide proper Remix environment for testing
 */
function renderWithRemix() {
  // Create a stub with the Index route
  const RemixStub = createRemixStub([
    {
      path: '/',
      Component: Index,
    },
  ]);

  return render(<RemixStub />);
}

/**
 * Test suite for the Landing Page component
 *
 * Tests all major sections:
 * - Header with logo, dark mode toggle, and login button
 * - Hero section with heading and CTA
 * - Features section with three feature cards
 * - CTA section with primary and secondary buttons
 * - Footer with links and copyright
 *
 * No mocks are used - all tests verify actual DOM structure
 * Uses createRemixStub to provide proper Remix routing context
 */
describe('Landing Page', () => {
  /**
   * Test: Header
   * Verifies that the header displays logo, service name, dark mode toggle, and login button
   */
  describe('Header', () => {
    it('displays the header', () => {
      renderWithRemix();

      // Find the header by its role
      const header = screen.getByRole('banner');
      expect(header).toBeDefined();
    });

    it('displays DevCle logo and service name', () => {
      renderWithRemix();

      // Find the DevCle home link
      const logoLink = screen.getByRole('link', { name: /DevCle Home/i });
      expect(logoLink).toBeDefined();
      expect(logoLink.getAttribute('href')).toBe('/');

      // Find the service name
      const serviceName = screen.getByText('DevCle');
      expect(serviceName).toBeDefined();
    });

    it('displays dark mode toggle button', () => {
      renderWithRemix();

      // Find the dark mode toggle button
      const toggleButton = screen.getByRole('button', {
        name: /Switch to dark mode/i,
      });
      expect(toggleButton).toBeDefined();
    });

    it('displays login button', () => {
      renderWithRemix();

      // Find the login button
      const loginButton = screen.getByRole('link', {
        name: /Log in to DevCle/i,
      });
      expect(loginButton).toBeDefined();
      expect(loginButton.getAttribute('href')).toBe('/login');
    });
  });

  /**
   * Test: Hero Section
   * Verifies that the hero section displays the main heading and CTA button
   */
  describe('Hero Section', () => {
    it('displays the main heading', () => {
      renderWithRemix();

      // Find the h1 heading
      const heading = screen.getByRole('heading', {
        level: 1,
        name: /Developer Relationship Management/i,
      });
      expect(heading).toBeDefined();
      expect(heading.textContent).toBe('Developer Relationship Management');
    });

    it('displays the subtitle', () => {
      renderWithRemix();

      // Find the subtitle text
      const subtitle = screen.getByText(
        /Track developer engagement, measure DevRel ROI, and analyze community funnels with DevCle/i
      );
      expect(subtitle).toBeDefined();
    });

    it('displays the Get Started CTA button', () => {
      renderWithRemix();

      // Find the CTA button by its text
      const ctaButton = screen.getByRole('link', { name: /Get Started/i });
      expect(ctaButton).toBeDefined();
      expect(ctaButton.getAttribute('href')).toBe('/dashboard');
    });
  });

  /**
   * Test: Features Section
   * Verifies that all three feature cards are displayed with correct content
   */
  describe('Features Section', () => {
    it('displays the features heading', () => {
      renderWithRemix();

      // Find the features section heading
      const heading = screen.getByRole('heading', {
        level: 2,
        name: /Key Features/i,
      });
      expect(heading).toBeDefined();
    });

    it('displays three feature cards', () => {
      renderWithRemix();

      // Find all feature cards by their role
      const featureCards = screen.getAllByRole('article');
      expect(featureCards).toHaveLength(3);
    });

    it('displays DRM feature card', () => {
      renderWithRemix();

      // Find the DRM feature card
      const drmTitle = screen.getByText(
        /DRM \(Developer Relationship Management\)/i
      );
      expect(drmTitle).toBeDefined();

      const drmDescription = screen.getByText(
        /Centralize developer activities and manage relationships/i
      );
      expect(drmDescription).toBeDefined();
    });

    it('displays ROI Analysis feature card', () => {
      renderWithRemix();

      // Find the ROI Analysis feature card
      const roiTitle = screen.getByText(/ROI Analysis/i);
      expect(roiTitle).toBeDefined();

      const roiDescription = screen.getByText(
        /Measure the return on investment for your DevRel campaigns/i
      );
      expect(roiDescription).toBeDefined();
    });

    it('displays Funnel Analysis feature card', () => {
      renderWithRemix();

      // Find the Funnel Analysis feature card
      const funnelTitle = screen.getByText(/Funnel Analysis/i);
      expect(funnelTitle).toBeDefined();

      const funnelDescription = screen.getByText(
        /Visualize the developer journey from Awareness to Advocacy/i
      );
      expect(funnelDescription).toBeDefined();
    });
  });

  /**
   * Test: CTA Section
   * Verifies that the CTA section displays both primary and secondary buttons
   */
  describe('CTA Section', () => {
    it('displays the CTA heading', () => {
      renderWithRemix();

      // Find the CTA section heading
      const heading = screen.getByRole('heading', {
        level: 2,
        name: /Ready to Transform Your DevRel Strategy/i,
      });
      expect(heading).toBeDefined();
    });

    it('displays the CTA subtitle', () => {
      renderWithRemix();

      // Find the CTA subtitle
      const subtitle = screen.getByText(
        /Start tracking developer relationships and measuring ROI today/i
      );
      expect(subtitle).toBeDefined();
    });

    it('displays the primary CTA button', () => {
      renderWithRemix();

      // Find the primary CTA button
      const primaryButton = screen.getByRole('link', {
        name: /Start Free Trial/i,
      });
      expect(primaryButton).toBeDefined();
      expect(primaryButton.getAttribute('href')).toBe('/dashboard');
    });

    it('displays the secondary CTA button', () => {
      renderWithRemix();

      // Find the secondary CTA button
      const secondaryButton = screen.getByRole('link', {
        name: /View Documentation/i,
      });
      expect(secondaryButton).toBeDefined();
      expect(secondaryButton.getAttribute('href')).toBe('/docs');
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
      const h3List = screen.getAllByRole('heading', { level: 3 });

      // Verify heading hierarchy
      expect(h1).toBeDefined();
      expect(h2List.length).toBeGreaterThan(0);
      expect(h3List.length).toBe(3); // Three feature card titles
    });

    it('has navigation landmark in footer', () => {
      renderWithRemix();

      // Find the navigation by its aria-label
      const footerNav = screen.getByLabelText(/Footer navigation/i);
      expect(footerNav).toBeDefined();
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

    it('features grid is responsive', () => {
      const { container } = renderWithRemix();

      // Find the features grid
      const grid = container.querySelector('.grid');
      expect(grid).toBeDefined();

      // Verify responsive grid classes
      const gridClasses = grid?.className || '';
      expect(gridClasses).toContain('grid-cols-1');
      expect(gridClasses).toContain('md:grid-cols-3');
    });
  });
});
