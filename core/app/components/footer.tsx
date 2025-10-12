import { Link } from '@remix-run/react';

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
 */
interface FooterProps {
  /**
   * Dark mode state
   */
  isDark: boolean;

  /**
   * Footer links (optional)
   * If not provided, defaults to Home, Terms of Service, and Privacy Policy
   */
  links?: FooterLink[];

  /**
   * Copyright text (optional)
   * If not provided, defaults to "© 2025 DevCle. All rights reserved."
   */
  copyright?: string;
}

/**
 * Footer component
 * A reusable footer for all pages with dark mode support
 *
 * Features:
 * - Navigation links (Home, Terms of Service, Privacy Policy, etc.)
 * - Copyright notice
 * - Dark mode support
 * - Responsive design
 *
 * Accessibility:
 * - Semantic HTML (footer element with role="contentinfo")
 * - Navigation landmark with aria-label
 * - Focus states for keyboard navigation
 *
 * Usage:
 * ```tsx
 * <Footer isDark={isDark} />
 * // or with custom links
 * <Footer
 *   isDark={isDark}
 *   links={[{ text: 'Custom Link', href: '/custom' }]}
 *   copyright="© 2025 MyCompany."
 * />
 * ```
 */
export default function Footer({
  isDark,
  links,
  copyright = '© 2025 DevCle. All rights reserved.',
}: FooterProps): JSX.Element {
  // Default footer links if not provided
  const defaultLinks: FooterLink[] = [
    { text: 'Home', href: '/' },
    { text: 'Terms of Service', href: '/terms' },
    { text: 'Privacy Policy', href: '/privacy' },
  ];

  const footerLinks = links || defaultLinks;

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
          {footerLinks.map((link) => (
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
        <p
          className={`text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {copyright}
        </p>
      </div>
    </footer>
  );
}
