import Header from '~/components/header';
import Footer from '~/components/footer';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Props for PageLayout component
 */
interface PageLayoutProps {
  /**
   * The main content of the page
   */
  children: React.ReactNode;
}

/**
 * PageLayout component
 * A reusable layout for content pages (Terms of Service, Privacy Policy, Documentation, etc.)
 *
 * Features:
 * - Fixed header with dark mode toggle
 * - Styled content area with max-width for readability
 * - Footer with links to related pages
 * - Dark mode support via app-level context
 * - Responsive design for mobile, tablet, and desktop
 * - Prose styling for Markdown/MDX content
 *
 * Usage in MDX files:
 * ```mdx
 * export { PageLayout as default } from '~/components/page-layout';
 *
 * # Page Title
 *
 * Content goes here...
 * ```
 *
 * Usage in TSX files:
 * ```tsx
 * <PageLayout variant="legal">
 *   <h1>Page Title</h1>
 *   <p>Content...</p>
 * </PageLayout>
 * ```
 */
export function PageLayout({ children }: PageLayoutProps): JSX.Element {
  // Get dark mode state from app-level context
  const { isDark, toggleDark } = useDarkMode();

  return (
    <div
      className={`min-h-screen transition-colors ${isDark ? 'dark bg-gray-900' : 'bg-white'}`}
    >
      {/* Fixed header with logo, dark mode toggle, and login button */}
      <Header isDark={isDark} toggleDark={toggleDark} />

      {/* Main content area with proper spacing for fixed header */}
      {/* pt-32: accounts for header height (h-16) + extra padding */}
      <main className="pt-32 pb-16">
        {/* Content with prose styling for Markdown/MDX */}
        <article
          className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose lg:prose-lg ${
            isDark ? 'prose-invert' : ''
          } prose-headings:font-semibold prose-h1:text-3xl prose-h1:md:text-4xl prose-h1:mb-4 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-blue-600 ${
            isDark ? 'prose-a:text-blue-400' : ''
          } prose-a:no-underline hover:prose-a:underline`}
        >
          {children}
        </article>
      </main>

      {/* Footer with legal links and copyright */}
      <Footer isDark={isDark} />
    </div>
  );
}
