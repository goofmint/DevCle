import { useState, useEffect } from 'react';
import Header from '~/components/header';
import Footer from '~/components/footer';

/**
 * Props for the LegalLayout component
 * Used to wrap legal pages (Terms of Service, Privacy Policy, etc.)
 */
interface LegalLayoutProps {
  /**
   * The page title displayed in the header
   * Example: "Terms of Service" or "Privacy Policy"
   */
  title: string;

  /**
   * The last updated date of the document
   * Example: "October 12, 2025"
   */
  lastUpdated: string;

  /**
   * The main content of the page (MDX content)
   * This is automatically passed by MDX when used as a layout
   */
  children: React.ReactNode;
}

/**
 * LegalLayout component
 * A reusable layout for legal pages (Terms of Service, Privacy Policy, etc.)
 *
 * Features:
 * - Fixed header with back-to-home link and dark mode toggle
 * - Page title and last updated date display
 * - Styled content area with max-width for readability
 * - Footer with links to related pages
 * - Dark mode support with localStorage persistence
 * - Responsive design for mobile, tablet, and desktop
 *
 * Usage in MDX files:
 * ```mdx
 * import LegalLayout from '~/components/legal-layout';
 *
 * export default function MDXContent(props) {
 *   return <LegalLayout title="Terms of Service" lastUpdated="October 12, 2025" {...props} />;
 * }
 *
 * # Article 1 (Scope of Application)
 *
 * These Terms of Service...
 * ```
 */
export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: LegalLayoutProps): JSX.Element {
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

  return (
    <div
      className={`min-h-screen transition-colors ${isDark ? 'bg-gray-900' : 'bg-white'}`}
    >
      {/* Fixed header with back-to-home link and dark mode toggle */}
      <Header isDark={isDark} toggleDark={toggleDark} variant="legal" />

      {/* Page title and last updated - displayed below the header */}
      <div
        className={`fixed top-16 left-0 right-0 z-40 border-b ${
          isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
        } transition-colors`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1
            className={`text-3xl md:text-4xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Last Updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Main content area with proper spacing for fixed header and title */}
      {/* pt-48: accounts for header height (h-16) + title section height */}
      <main className="pt-48 pb-16">
        {/* MDX content with styling */}
        <article
          className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose ${
            isDark ? 'prose-invert' : ''
          } prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-p:leading-relaxed prose-p:mb-4`}
        >
          {children}
        </article>
      </main>

      {/* Footer with legal links and copyright */}
      <Footer isDark={isDark} />
    </div>
  );
}
