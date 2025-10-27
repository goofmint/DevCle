/**
 * Dashboard Sidebar Component
 *
 * Displays navigation items with icons and labels.
 * Supports plugin-registered navigation items.
 *
 * Features:
 * - Active link highlighting
 * - Icon support (Heroicons)
 * - Badge support (for notifications)
 * - System Settings at the bottom
 * - Mobile responsive (collapsible)
 * - Dark mode support
 *
 * Layout:
 * +------------------+
 * | [Logo]           |
 * |                  |
 * | Overview         |
 * | Developers       |
 * | Campaigns        |
 * | Funnel           |
 * |                  |
 * | [System Settings]|
 * +------------------+
 */

import { NavLink } from '@remix-run/react';
import {
  HomeIcon,
  UsersIcon,
  MegaphoneIcon,
  FunnelIcon,
  Cog6ToothIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';
import type { NavigationItem } from '~/types/dashboard';

/**
 * Icon mapping
 *
 * Maps icon names from NavigationItem to actual Heroicons components.
 * Add new icons here as needed.
 */
const ICON_MAP: Record<string, typeof HomeIcon> = {
  home: HomeIcon,
  users: UsersIcon,
  megaphone: MegaphoneIcon,
  funnel: FunnelIcon,
  'puzzle-piece': PuzzlePieceIcon,
  cog: Cog6ToothIcon,
};

/**
 * Props for DashboardSidebar component
 */
interface DashboardSidebarProps {
  /**
   * Navigation items to display
   * Includes both core items and plugin-registered items
   */
  items: NavigationItem[];

  /**
   * Whether the sidebar is collapsed (mobile)
   * When true, sidebar is hidden
   */
  isCollapsed?: boolean;

  /**
   * Callback when sidebar toggle is clicked
   * Used for mobile navigation
   */
  onToggle?: () => void;
}

/**
 * DashboardSidebar component
 *
 * Renders the sidebar navigation with all navigation items.
 * Automatically separates main items and bottom items.
 */
export function DashboardSidebar({
  items,
  isCollapsed = false,
}: DashboardSidebarProps) {
  // Separate main items and bottom items
  // Bottom items (e.g., System Settings) are displayed at the bottom of the sidebar
  const mainItems = items.filter((item) => !item.isBottomItem);
  const bottomItems = items.filter((item) => item.isBottomItem);

  return (
    <aside
      data-testid="sidebar"
      className={`
        h-full w-60
        bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-700
        transition-transform duration-300
        overflow-hidden
        ${isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
      `}
    >
      {/* Scrollable container for main nav + sticky bottom */}
      <div className="h-full flex flex-col">
        {/* Main Navigation Items */}
        <nav
          aria-label="Main navigation"
          className="flex-1 px-3 pt-4 pb-0 space-y-1 overflow-y-auto"
        >
          {mainItems.map((item) => (
            <NavigationItemComponent key={item.key} item={item} />
          ))}
        </nav>

        {/* Bottom Navigation Items (e.g., System Settings) */}
        {/* Always at the bottom of the sidebar viewport */}
        {bottomItems.length > 0 && (
          <nav
            aria-label="Settings navigation"
            className="px-3 py-4 space-y-1 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"
          >
            {bottomItems.map((item) => (
              <NavigationItemComponent key={item.key} item={item} />
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

/**
 * NavigationItemComponent
 *
 * Internal component that renders a single navigation item.
 * Uses NavLink for automatic active state management.
 */
function NavigationItemComponent({ item }: { item: NavigationItem }) {
  // Get the icon component from the icon map
  const IconComponent = ICON_MAP[item.icon];

  return (
    <NavLink
      to={item.path}
      className={({ isActive }: { isActive: boolean }) =>
        `
        flex items-center px-3 py-2 text-sm font-medium rounded-lg
        transition-colors duration-150
        ${
          isActive
            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }
      `
      }
      end
    >
      {/* Icon */}
      {IconComponent && (
        <IconComponent className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span className="flex-1">{item.label}</span>

      {/* Badge (if present) */}
      {item.badge && (
        <span
          className="
            inline-flex items-center justify-center
            px-2 py-1 text-xs font-bold leading-none
            text-white bg-red-600 rounded-full
          "
          aria-label={`${item.badge} notifications`}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}
