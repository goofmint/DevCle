import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Props for the Header component
 * Unified header for all pages
 */
interface HeaderProps {
  /**
   * Dark mode state
   */
  isDark: boolean;

  /**
   * Dark mode toggle function
   */
  toggleDark: () => void;
}

/**
 * Header component
 * A reusable header for all pages with dark mode support
 *
 * Features:
 * - Fixed position at the top of the page
 * - Logo + Service name
 * - Dark mode toggle button
 * - Login button
 * - Responsive design
 *
 * Accessibility:
 * - Semantic HTML (header element with role="banner")
 * - ARIA labels for all interactive elements
 * - Focus states for keyboard navigation
 */
export default function Header({
  isDark,
  toggleDark,
}: HeaderProps): JSX.Element {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} transition-colors`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Logo (consistent across all page types) */}
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

          {/* Right side: Dark mode toggle (+ Login button for landing) */}
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
              <Icon
                icon={isDark ? 'ph:sun-bold' : 'ph:moon-bold'}
                className="w-5 h-5"
                aria-hidden="true"
              />
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
