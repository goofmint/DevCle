import type { MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import Header from '~/components/header';
import Footer from '~/components/footer';
import { useDarkMode } from '~/contexts/dark-mode-context';

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
  // Dark mode state from app-level context
  const { isDark, toggleDark } = useDarkMode();

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

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Fixed header with logo, dark mode toggle, and login button */}
      <Header isDark={isDark} toggleDark={toggleDark} variant="landing" />

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

        {/* Footer with legal links and copyright - uses default links */}
        <Footer isDark={isDark} />
      </main>
    </div>
  );
}
