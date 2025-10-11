import type { MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';

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
 * Props for the HeroSection component
 * Defines the main heading, subtitle, and call-to-action
 */
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

/**
 * HeroSection component
 * Displays the main heading, subtitle, and primary CTA button
 * Uses gradient background for visual appeal
 */
function HeroSection({
  title,
  subtitle,
  ctaText,
  ctaLink,
}: HeroSectionProps): JSX.Element {
  return (
    <section
      className="bg-gradient-to-r from-blue-600 to-blue-800 py-20 px-4 sm:px-6 lg:px-8"
      aria-label="Hero section"
    >
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          {title}
        </h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
          {subtitle}
        </p>
        <Link
          to={ctaLink}
          className="inline-block bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
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
}

/**
 * FeaturesSection component
 * Displays a 3-column grid of feature cards (responsive)
 * Each card shows an icon, title, and description
 */
function FeaturesSection({ features }: FeaturesSectionProps): JSX.Element {
  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50"
      aria-label="Features section"
    >
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow"
              role="article"
              aria-label={`Feature: ${feature.title}`}
            >
              <div className="text-4xl mb-4" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
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
}: CTASectionProps): JSX.Element {
  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
      aria-label="Call to action section"
    >
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {title}
        </h2>
        <p className="text-xl text-gray-600 mb-8">{subtitle}</p>
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
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
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
}

/**
 * Footer component
 * Displays footer links (Terms, Privacy, etc.) and copyright notice
 * Uses semantic HTML for accessibility
 */
function Footer({ links, copyright }: FooterProps): JSX.Element {
  return (
    <footer
      className="bg-gray-800 text-white py-8 px-4 sm:px-6 lg:px-8"
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
              className="hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800 rounded"
              aria-label={link.text}
            >
              {link.text}
            </Link>
          ))}
        </nav>
        <p className="text-center text-gray-400 text-sm">{copyright}</p>
      </div>
    </footer>
  );
}

/**
 * Landing Page component
 * Main entry point for the home page
 * Composes HeroSection, FeaturesSection, CTASection, and Footer
 *
 * Features:
 * - Hero section with gradient background
 * - Three feature cards (DRM, ROI Analysis, Funnel Analysis)
 * - Call-to-action section with two buttons
 * - Footer with links to Terms and Privacy Policy
 *
 * Accessibility:
 * - Semantic HTML elements (section, nav, footer)
 * - ARIA labels for all interactive elements
 * - Focus states for keyboard navigation
 * - Screen reader friendly structure
 *
 * Responsive Design:
 * - Mobile-first approach
 * - Breakpoints: sm (640px), md (768px), lg (1024px)
 * - Grid layout adapts from 1 to 3 columns
 */
export default function Index(): JSX.Element {
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
    <main className="min-h-screen bg-white">
      {/* Hero section with main heading and CTA */}
      <HeroSection
        title="Developer Relationship Management"
        subtitle="Track developer engagement, measure DevRel ROI, and analyze community funnels with DevCle."
        ctaText="Get Started"
        ctaLink="/dashboard"
      />

      {/* Features section with three main features */}
      <FeaturesSection features={features} />

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
      />

      {/* Footer with legal links and copyright */}
      <Footer links={footerLinks} copyright="© 2025 DevCle. All rights reserved." />
    </main>
  );
}
