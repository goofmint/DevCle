import type { MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';

/**
 * Meta tags for SEO optimization
 * Provides title and description for the landing page
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'DevCle - Developer Relationship Management' },
    {
      name: 'description',
      content:
        'Track developer engagement, measure DevRel ROI, and analyze community funnels with DevCle.',
    },
  ];
};

/**
 * Header component
 * Displays logo, service name, dark mode toggle, and login button
 * Fixed at the top of the page for easy navigation
 */
function Header({ isDark, toggleDark }: { isDark: boolean; toggleDark: () => void }): JSX.Element {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} transition-colors`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Logo and Service Name */}
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
              aria-label="DevCle Home"
            >
              <div
                className={`text-2xl font-bold ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                } group-hover:scale-110 transition-transform`}
                aria-hidden="true"
              >
                📊
              </div>
              <span
                className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                } ${
                  isDark ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'
                } transition-colors`}
              >
                DevCle
              </span>
            </Link>
          </div>

          {/* Right side: Dark mode toggle and Login button */}
          <div className="flex items-center space-x-4">
            {/* Dark mode toggle button */}
            <button
              onClick={toggleDark}
              className={`p-2 rounded-lg ${
                isDark
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                // Sun icon for light mode
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                // Moon icon for dark mode
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Login button */}
            <Link
              to="/login"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              aria-label="Log in to DevCle"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Props for the HeroSection component
 * Defines the main heading, subtitle, and call-to-action
 */
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  isDark: boolean;
}

/**
 * HeroSection component
 * Displays the main heading, subtitle, and primary CTA button
 * Uses gradient background that adapts to dark mode
 */
function HeroSection({
  title,
  subtitle,
  ctaText,
  ctaLink,
  isDark,
}: HeroSectionProps): JSX.Element {
  return (
    <section
      className={`pt-32 pb-20 px-4 sm:px-6 lg:px-8 transition-colors ${
        isDark
          ? 'bg-gradient-to-r from-blue-900 to-blue-950'
          : 'bg-gradient-to-r from-blue-600 to-blue-800'
      }`}
      aria-label="Hero section"
    >
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          {title}
        </h1>
        <p
          className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
            isDark ? 'text-blue-200' : 'text-blue-100'
          }`}
        >
          {subtitle}
        </p>
        <Link
          to={ctaLink}
          className={`inline-block px-8 py-4 rounded-lg text-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${
            isDark
              ? 'bg-white text-blue-900 hover:bg-gray-100 focus:ring-offset-blue-950'
              : 'bg-white text-blue-600 hover:bg-gray-100 focus:ring-offset-blue-600'
          }`}
          aria-label={ctaText}
        >
          {ctaText}
        </Link>
      </div>
    </section>
  );
}

/**
 * Feature interface
 * Represents a single feature card with icon, title, and description
 */
interface Feature {
  icon: string;
  title: string;
  description: string;
}

/**
 * Props for the FeaturesSection component
 * Contains an array of features to display
 */
interface FeaturesSectionProps {
  features: Feature[];
  isDark: boolean;
}

/**
 * FeaturesSection component
 * Displays a 3-column grid of feature cards (responsive)
 * Each card shows an icon, title, and description with dark mode support
 */
function FeaturesSection({ features, isDark }: FeaturesSectionProps): JSX.Element {
  return (
    <section
      className={`py-20 px-4 sm:px-6 lg:px-8 transition-colors ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
      aria-label="Features section"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}
              role="article"
              aria-label={`Feature: ${feature.title}`}
            >
              <div className="text-4xl mb-4" aria-hidden="true">
                {feature.icon}
              </div>
              <h3
                className={`text-xl font-semibold mb-3 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {feature.title}
              </h3>
              <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Props for the CTASection component
 * Defines the CTA heading, subtitle, and two action buttons
 */
interface CTASectionProps {
  title: string;
  subtitle: string;
  primaryCTA: {
    text: string;
    link: string;
  };
  secondaryCTA: {
    text: string;
    link: string;
  };
  isDark: boolean;
}

/**
 * CTASection component
 * Displays a call-to-action section with primary and secondary buttons
 * Primary CTA uses solid color, secondary uses outline style
 */
function CTASection({
  title,
  subtitle,
  primaryCTA,
  secondaryCTA,
  isDark,
}: CTASectionProps): JSX.Element {
  return (
    <section
      className={`py-20 px-4 sm:px-6 lg:px-8 transition-colors ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}
      aria-label="Call to action section"
    >
      <div className="max-w-4xl mx-auto text-center">
        <h2
          className={`text-3xl md:text-4xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </h2>
        <p className={`text-xl mb-8 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={primaryCTA.link}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={primaryCTA.text}
          >
            {primaryCTA.text}
          </Link>
          <Link
            to={secondaryCTA.link}
            className={`px-8 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400'
            }`}
            aria-label={secondaryCTA.text}
          >
            {secondaryCTA.text}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * FooterLink interface
 * Represents a single link in the footer
 */
interface FooterLink {
  text: string;
  href: string;
}

/**
 * Props for the Footer component
 * Contains footer links and copyright text
 */
interface FooterProps {
  links: FooterLink[];
  copyright: string;
  isDark: boolean;
}

/**
 * Footer component
 * Displays footer links (Terms, Privacy, etc.) and copyright notice
 * Uses semantic HTML for accessibility with dark mode support
 */
function Footer({ links, copyright, isDark }: FooterProps): JSX.Element {
  return (
    <footer
      className={`py-8 px-4 sm:px-6 lg:px-8 transition-colors ${
        isDark ? 'bg-gray-950 text-gray-300' : 'bg-gray-800 text-white'
      }`}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto">
        <nav
          className="flex flex-wrap justify-center gap-6 mb-4"
          aria-label="Footer navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 rounded ${
                isDark
                  ? 'hover:text-blue-400 focus:ring-blue-400 focus:ring-offset-gray-950'
                  : 'hover:text-blue-400 focus:ring-blue-400 focus:ring-offset-gray-800'
              }`}
              aria-label={link.text}
            >
              {link.text}
            </Link>
          ))}
        </nav>
        <p className={`text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {copyright}
        </p>
      </div>
    </footer>
  );
}

/**
 * Landing Page component
 * Main entry point for the home page
 * Composes Header, HeroSection, FeaturesSection, CTASection, and Footer
 *
 * Features:
 * - Fixed header with logo, dark mode toggle, and login button
 * - Dark mode support with localStorage persistence
 * - Hero section with gradient background
 * - Three feature cards (DRM, ROI Analysis, Funnel Analysis)
 * - Call-to-action section with two buttons
 * - Footer with links to Terms and Privacy Policy
 *
 * Accessibility:
 * - Semantic HTML elements (header, section, nav, footer)
 * - ARIA labels for all interactive elements
 * - Focus states for keyboard navigation
 * - Screen reader friendly structure
 *
 * Responsive Design:
 * - Mobile-first approach
 * - Breakpoints: sm (640px), md (768px), lg (1024px)
 * - Grid layout adapts from 1 to 3 columns
 *
 * Dark Mode:
 * - Toggleable via button in header
 * - Persisted in localStorage
 * - Smooth transitions between modes
 */
export default function Index(): JSX.Element {
  // Dark mode state management
  // Initializes from localStorage or system preference (prefers-color-scheme)
  const [isDark, setIsDark] = useState<boolean>(false);

  // Load dark mode preference on mount
  // Priority: 1. localStorage (user preference), 2. System preference (prefers-color-scheme)
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      // User has explicitly set a preference - use it
      setIsDark(savedMode === 'true');
    } else {
      // No saved preference - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  // Toggle dark mode and persist to localStorage
  const toggleDark = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('darkMode', String(newMode));
  };

  // Feature data for the features section
  // Each feature represents a core capability of DevCle
  const features: Feature[] = [
    {
      icon: '👥',
      title: 'DRM (Developer Relationship Management)',
      description:
        'Centralize developer activities and manage relationships across all touchpoints.',
    },
    {
      icon: '📊',
      title: 'ROI Analysis',
      description:
        'Measure the return on investment for your DevRel campaigns and initiatives.',
    },
    {
      icon: '🔄',
      title: 'Funnel Analysis',
      description:
        'Visualize the developer journey from Awareness to Advocacy with detailed funnel metrics.',
    },
  ];

  // Footer links data
  // Links to legal pages and external resources
  const footerLinks: FooterLink[] = [
    { text: 'Terms of Service', href: '/terms' },
    { text: 'Privacy Policy', href: '/privacy' },
  ];

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Fixed header with logo, dark mode toggle, and login button */}
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main>
        {/* Hero section with main heading and CTA */}
        <HeroSection
          title="Developer Relationship Management"
          subtitle="Track developer engagement, measure DevRel ROI, and analyze community funnels with DevCle."
          ctaText="Get Started"
          ctaLink="/dashboard"
          isDark={isDark}
        />

        {/* Features section with three main features */}
        <FeaturesSection features={features} isDark={isDark} />

        {/* CTA section encouraging users to take action */}
        <CTASection
          title="Ready to Transform Your DevRel Strategy?"
          subtitle="Start tracking developer relationships and measuring ROI today."
          primaryCTA={{
            text: 'Start Free Trial',
            link: '/dashboard',
          }}
          secondaryCTA={{
            text: 'View Documentation',
            link: '/docs',
          }}
          isDark={isDark}
        />

        {/* Footer with legal links and copyright */}
        <Footer links={footerLinks} copyright="© 2025 DevCle. All rights reserved." isDark={isDark} />
      </main>
    </div>
  );
}
