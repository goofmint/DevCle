/**
 * Dashboard Header Component
 *
 * Displays logo and user information with dropdown menu.
 *
 * Features:
 * - Logo (links to dashboard overview)
 * - User avatar (or initials if no avatar)
 * - User name and role
 * - Dropdown menu (Profile, Settings, Logout)
 * - Dark mode support
 * - Responsive design
 *
 * Layout:
 * +------------------------------------------------+
 * | [Logo]                          [User ▼]       |
 * +------------------------------------------------+
 */

import { Link, Form } from '@remix-run/react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import {
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import type { User } from '~/types/dashboard';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Props for DashboardHeader component
 */
interface DashboardHeaderProps {
  /**
   * Current user information
   * Contains user data from the authentication session
   */
  user: User;
}

/**
 * DashboardHeader component
 *
 * Renders the header with logo, dark mode toggle, and user menu.
 * The header spans the full width of the page.
 */
export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { isDark, toggleDark } = useDarkMode();

  return (
    <header
      className="
        flex items-center justify-between
        h-16 px-6
        bg-white dark:bg-gray-900
        border-b border-gray-200 dark:border-gray-700
      "
    >
      {/* Logo */}
      <Link
        to="/dashboard"
        className="text-xl font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        DevCle
      </Link>

      {/* Right side: Dark mode toggle + User menu */}
      <div className="flex items-center space-x-4">
        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleDark}
          className="
            p-2 rounded-lg
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-indigo-500
          "
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <SunIcon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <MoonIcon className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* User Menu */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/**
 * UserMenu component
 *
 * Renders the user avatar/initials and dropdown menu.
 * Uses Headless UI Menu component for accessibility.
 */
function UserMenu({ user }: { user: User }) {
  // Get user initials from display name
  // Example: "John Doe" -> "JD"
  // Fallback to email first letter if displayName is empty/whitespace
  const trimmedName = user.displayName.trim();
  let initials: string;

  if (trimmedName) {
    // Generate initials from display name
    initials = trimmedName
      .split(' ')
      .map((name) => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  } else {
    // Fallback: use first letter of email, or "UN" if email is also empty
    const trimmedEmail = user.email.trim();
    initials = trimmedEmail ? trimmedEmail.charAt(0).toUpperCase() : 'UN';
  }

  // Ensure we always have at least one character
  if (!initials) {
    initials = 'UN';
  }

  return (
    <Menu as="div" className="relative">
      {/* Menu Button */}
      <MenuButton
        className="
          flex items-center space-x-3
          text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          rounded-lg px-3 py-2
          transition-colors duration-150
          hover:bg-gray-100 dark:hover:bg-gray-800
        "
        aria-label="User menu"
      >
        {/* Avatar or Initials */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div
            className="
              w-8 h-8 rounded-full
              bg-indigo-600 dark:bg-indigo-500
              flex items-center justify-center
              text-white text-sm font-medium
            "
            aria-label={`${user.displayName} avatar`}
          >
            {initials}
          </div>
        )}

        {/* User Name and Email */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {user.displayName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {user.email}
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className="w-4 h-4 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </MenuButton>

      {/* Dropdown Menu */}
      <MenuItems
        className="
          absolute right-0 mt-2 w-56
          origin-top-right
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg shadow-lg
          divide-y divide-gray-100 dark:divide-gray-700
          focus:outline-none
          z-50
        "
      >
        {/* User Info Section (mobile only, shows full info) */}
        <div className="md:hidden px-4 py-3">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {user.displayName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {user.email}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Role: {user.role}
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <MenuItem>
            {({ active }: { active: boolean }) => (
              <Link
                to="/dashboard/profile"
                className={`
                  flex items-center px-4 py-2 text-sm
                  ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                  text-gray-700 dark:text-gray-300
                `}
              >
                <UserCircleIcon className="w-5 h-5 mr-3" aria-hidden="true" />
                Profile
              </Link>
            )}
          </MenuItem>

          <MenuItem>
            {({ active }: { active: boolean }) => (
              <Link
                to="/dashboard/settings"
                className={`
                  flex items-center px-4 py-2 text-sm
                  ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                  text-gray-700 dark:text-gray-300
                `}
              >
                <Cog6ToothIcon className="w-5 h-5 mr-3" aria-hidden="true" />
                Settings
              </Link>
            )}
          </MenuItem>
        </div>

        {/* Logout Section */}
        <div className="py-1">
          <MenuItem>
            {({ active }: { active: boolean }) => (
              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className={`
                    flex items-center w-full px-4 py-2 text-sm text-left
                    ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                    text-red-600 dark:text-red-400
                  `}
                >
                  <ArrowRightOnRectangleIcon
                    className="w-5 h-5 mr-3"
                    aria-hidden="true"
                  />
                  Logout
                </button>
              </Form>
            )}
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
  );
}
