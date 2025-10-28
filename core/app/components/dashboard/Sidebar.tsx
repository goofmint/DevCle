/**
 * Dashboard Sidebar Component
 *
 * Displays navigation items with icons and labels.
 * Supports plugin-registered navigation items with hierarchical structure.
 *
 * Features:
 * - Active link highlighting
 * - Icon support (Heroicons + Iconify for plugins)
 * - Badge support (for notifications)
 * - Hierarchical menu (max 2 levels)
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
 * | Plugins          |
 * |   > Plugin A     | <- Child item (Level 2)
 * |   > Plugin B     | <- Child item (Level 2)
 * |                  |
 * | [System Settings]|
 * +------------------+
 */

import { useState } from 'react';
import { NavLink } from '@remix-run/react';
import {
  HomeIcon,
  UsersIcon,
  MegaphoneIcon,
  FunnelIcon,
  Cog6ToothIcon,
  PuzzlePieceIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Icon } from '@iconify/react';
import type { NavigationItem, NavigationItemChild } from '~/types/dashboard';

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

  // State for collapsed plugin groups (expandable sections)
  // Stores keys of collapsed items (default is expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Toggle function for collapsing/expanding groups
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
            <NavigationItemComponent
              key={item.key}
              item={item}
              isCollapsed={collapsedGroups.has(item.key)}
              onToggle={() => toggleGroup(item.key)}
            />
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
              <NavigationItemComponent
                key={item.key}
                item={item}
                isCollapsed={false}
                onToggle={() => {}}
              />
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
 * Internal component that renders a single navigation item with optional children.
 * Supports collapsible groups for items with children.
 * Enforces maximum depth of 2 levels.
 *
 * @param item - Navigation item to render
 * @param depth - Current depth (0 = top level, 1 = child level)
 * @param isCollapsed - Whether this group is collapsed
 * @param onToggle - Function to toggle collapse state
 */
function NavigationItemComponent({
  item,
  depth = 0,
  isCollapsed = false,
  onToggle,
}: {
  item: NavigationItem | NavigationItemChild;
  depth?: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
}) {
  // Depth limit enforcement (maximum 2 levels: 0 and 1)
  // If depth > 1, render only the link without children and log warning
  if (depth > 1) {
    console.warn(
      `[Sidebar] Maximum nesting depth (2) exceeded for path: ${item.path}`
    );
    return <NavigationLink item={item} depth={depth} />;
  }

  // Check if item has children (type guard)
  const hasChildren =
    depth < 1 && 'children' in item && item.children && item.children.length > 0;

  return (
    <div>
      {/* Parent/Top-level Item */}
      {hasChildren ? (
        // Collapsible header for items with children
        <CollapsibleHeader
          item={item as NavigationItem}
          isCollapsed={isCollapsed}
          onToggle={onToggle || (() => {})}
        />
      ) : (
        // Regular link for items without children
        <NavigationLink item={item} depth={depth} />
      )}

      {/* Child Items (Level 2) - Only render if not collapsed */}
      {hasChildren && !isCollapsed && (
        <div
          className="ml-4 mt-1 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-3"
          role="group"
          aria-label={`${item.label} submenu`}
        >
          {item.children!.map((child) => (
            <NavigationItemComponent
              key={child.key}
              item={child}
              depth={depth + 1}
              isCollapsed={false}
              onToggle={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * CollapsibleHeader
 *
 * Renders a clickable header for collapsible menu groups.
 * Shows chevron icon to indicate collapse state.
 */
function CollapsibleHeader({
  item,
  isCollapsed,
  onToggle,
}: {
  item: NavigationItem;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const IconComponent = item.icon ? ICON_MAP[item.icon] : undefined;
  const isIconifyIcon = item.icon?.includes(':');

  return (
    <button
      type="button"
      onClick={onToggle}
      className="
        w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg
        transition-colors duration-150
        text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800
      "
    >
      {/* Icon - Heroicons or Iconify */}
      {IconComponent && (
        <IconComponent className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
      )}
      {!IconComponent && isIconifyIcon && item.icon && (
        <Icon icon={item.icon} className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span className="flex-1 text-left">{item.label}</span>

      {/* Chevron icon */}
      {isCollapsed ? (
        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      ) : (
        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * NavigationLink
 *
 * Renders the actual navigation link with icon, label, and badge.
 * Supports both Heroicons (for core items) and Iconify (for plugin items).
 *
 * @param item - Navigation item to render
 * @param depth - Current depth (for styling)
 */
function NavigationLink({
  item,
  depth,
}: {
  item: NavigationItem | NavigationItemChild;
  depth: number;
}) {
  // Get Heroicons component if available (only if icon is defined)
  const HeroiconComponent = item.icon ? ICON_MAP[item.icon] : undefined;

  // Determine if this is an Iconify icon (contains colon, e.g., "mdi:chart-line")
  const isIconifyIcon = item.icon?.includes(':');

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
        ${depth > 0 ? 'text-xs' : ''}
      `
      }
      end
    >
      {/* Icon - Heroicons or Iconify */}
      {HeroiconComponent && (
        <HeroiconComponent className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
      )}
      {!HeroiconComponent && isIconifyIcon && item.icon && (
        <Icon icon={item.icon} className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span className="flex-1">{item.label}</span>

      {/* Badge (if present) - Only on NavigationItem, not NavigationItemChild */}
      {'badge' in item && item.badge && (
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
