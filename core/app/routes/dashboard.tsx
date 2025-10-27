/**
 * Dashboard Layout
 *
 * Provides the main layout structure for the dashboard with:
 * - Sidebar navigation (left, 240px)
 * - Header with logo and user info (top, full width)
 * - Main content area (right, flexible)
 *
 * Authentication:
 * - All dashboard routes require authentication
 * - Unauthenticated users are redirected to /login
 *
 * Plugin Extensibility:
 * - Sidebar items can be dynamically added by plugins (Task 8.1)
 * - For now, only core navigation items are displayed
 *
 * Layout Structure (3-pane):
 * +----------------------------------------------+
 * | Header                                       |
 * +------------------+---------------------------+
 * | Sidebar          | Main Content Area         |
 * | - Overview       |                           |
 * | - Developers     |                           |
 * | - Campaigns      |                           |
 * | - Funnel         |                           |
 * |                  |                           |
 * | [System Settings]|                           |
 * +------------------+---------------------------+
 */

import { useState } from 'react';
import { type LoaderFunctionArgs, json, type MetaFunction } from '@remix-run/node';
import { Outlet, useLoaderData } from '@remix-run/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { requireAuth } from '~/auth.middleware';
import { DashboardSidebar } from '~/components/dashboard/Sidebar';
import { DashboardHeader } from '~/components/dashboard/Header';
import type { DashboardLayoutData, NavigationItem, NavigationItemChild, User } from '~/types/dashboard';
import {
  getPluginMenuItems,
  filterMenuItemsByPermission,
  type PluginMenuItem,
  type PluginMenuItemChild,
} from '../../plugin-system/menu.js';

/**
 * Meta function - Sets the page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'Dashboard - DevCle' },
    { name: 'description', content: 'Developer Relationship Management Dashboard' },
  ];
};

/**
 * Core navigation items
 *
 * These are the default navigation items for the dashboard.
 * Plugins can add additional items (Task 8.1).
 *
 * Order determines the display order in the sidebar.
 * Items with isBottomItem=true are displayed at the bottom.
 */
const CORE_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/dashboard',
    icon: 'home',
    order: 10,
  },
  {
    key: 'developers',
    label: 'Developers',
    path: '/dashboard/developers',
    icon: 'users',
    order: 20,
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    path: '/dashboard/campaigns',
    icon: 'megaphone',
    order: 30,
  },
  {
    key: 'funnel',
    label: 'Funnel',
    path: '/dashboard/funnel',
    icon: 'funnel',
    order: 40,
  },
  {
    key: 'plugins',
    label: 'Plugins',
    path: '/dashboard/plugins',
    icon: 'puzzle-piece',
    order: 50,
  },
  {
    key: 'system-settings',
    label: 'System Settings',
    path: '/dashboard/settings',
    icon: 'cog',
    order: 1000, // Always at bottom
    isBottomItem: true,
  },
];

/**
 * Loader function
 *
 * Authenticates the user and provides dashboard data.
 *
 * Steps:
 * 1. Authenticate user (requireAuth throws redirect if not authenticated)
 * 2. Get user information from session
 * 3. Get plugin menu items and filter by permissions
 * 4. Merge core navigation items with plugin menu items
 * 5. Return data for the dashboard layout
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Authenticate user
  // requireAuth throws redirect to /login if not authenticated
  const authUser = await requireAuth(request);

  // Convert auth user to dashboard User type
  // Admin users get wildcard capability for permission filtering
  const user: User = {
    userId: authUser.userId,
    email: authUser.email,
    displayName: authUser.displayName || authUser.email,
    role: authUser.role,
    tenantId: authUser.tenantId,
    capabilities: authUser.role === 'admin' ? ['*'] : [],
  };

  // Get plugin menu items with error handling
  // If plugin menu loading fails, continue with empty array (graceful degradation)
  let pluginMenuItems: PluginMenuItem[] = [];
  try {
    // Load all plugin menu items for this tenant
    const rawPluginMenus = await getPluginMenuItems(authUser.tenantId);

    // Filter by user permissions
    const userCapabilities = user.capabilities || [];
    pluginMenuItems = filterMenuItemsByPermission(rawPluginMenus, userCapabilities);
  } catch (error) {
    // Log error but don't throw - page should load even if plugin menus fail
    console.error('[Dashboard Loader] Failed to load plugin menu items:', error);
    pluginMenuItems = [];
  }

  // Convert plugin menu items to NavigationItems
  const pluginNavigationItems: NavigationItem[] = pluginMenuItems.map((pluginMenu) =>
    convertPluginMenuToNavigationItem(pluginMenu)
  );

  // Merge core navigation items with plugin items
  // Core items have order 10-100, plugin items have order 500-999
  const allNavigationItems = [
    ...CORE_NAVIGATION_ITEMS,
    ...pluginNavigationItems,
  ].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Return dashboard data
  return json<DashboardLayoutData>({
    user,
    navigationItems: allNavigationItems,
  });
}

/**
 * Convert PluginMenuItem to NavigationItem
 *
 * Maps plugin menu structure to navigation item structure.
 * - Generates unique key from plugin key and path
 * - Converts children if present
 * - Sets order to 500 (plugin items appear after core items but before settings)
 *
 * @param pluginMenu - Plugin menu item from plugin.json
 * @returns NavigationItem for sidebar rendering
 * @private
 */
function convertPluginMenuToNavigationItem(
  pluginMenu: PluginMenuItem
): NavigationItem {
  // Generate unique key: pluginKey + path hash
  // This ensures uniqueness even if multiple plugins have same label
  const key = `plugin-${pluginMenu.pluginKey}-${pluginMenu.path.replace(/\//g, '-')}`;

  // Create base navigation item
  const navItem: NavigationItem = {
    key,
    label: pluginMenu.label,
    path: pluginMenu.path,
    icon: pluginMenu.icon || 'puzzle-piece', // Default icon for plugins
    pluginId: pluginMenu.pluginKey,
    order: 500, // Plugin items appear after core items (10-100) but before settings (1000)
  };

  // Add children only if they exist (exactOptionalPropertyTypes compliance)
  if (pluginMenu.children && pluginMenu.children.length > 0) {
    navItem.children = pluginMenu.children.map((child: PluginMenuItemChild) => {
      const navChild: NavigationItemChild = {
        key: `plugin-${child.pluginKey}-${child.path.replace(/\//g, '-')}`,
        label: child.label,
        path: child.path,
        pluginId: child.pluginKey,
      };

      // Add icon only if present (exactOptionalPropertyTypes compliance)
      if (child.icon !== undefined) {
        navChild.icon = child.icon;
      }

      return navChild;
    });
  }

  return navItem;
}

/**
 * Dashboard layout component
 *
 * 3-Pane Layout Structure:
 * 1. Header (top, full width) - HIGHEST PRIORITY
 * 2. Sidebar (left, 240px)
 * 3. Content Area (right, flexible)
 *
 * Mobile Behavior:
 * - Sidebar is hidden by default on mobile
 * - Toggle button in header shows/hides sidebar
 * - Sidebar appears as overlay on mobile
 */
export default function DashboardLayout() {
  // Get loader data (user, navigation items)
  const { user, navigationItems } = useLoaderData<typeof loader>();

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  /**
   * Toggle mobile sidebar
   * Only used on mobile devices (< 768px)
   */
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header - Full width at top */}
      <div className="relative z-20">
        <DashboardHeader user={user} />
      </div>

      {/* Mobile Sidebar Toggle Button */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="
          md:hidden fixed bottom-4 right-4 z-50
          p-3 rounded-full
          bg-indigo-600 hover:bg-indigo-700
          text-white shadow-lg
          transition-colors duration-150
        "
        data-testid="sidebar-toggle"
        aria-label="Toggle sidebar"
      >
        {isMobileSidebarOpen ? (
          <XMarkIcon className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Bars3Icon className="w-6 h-6" aria-hidden="true" />
        )}
      </button>

      {/* Main Content Area - Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Left side */}
        <div className="relative z-10">
          {/* Mobile Overlay */}
          {isMobileSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
              onClick={toggleMobileSidebar}
              aria-hidden="true"
            />
          )}

          {/* Sidebar Container */}
          {/* Mobile: Fixed position with top-16 (below header) */}
          {/* Desktop: Static position within flex container */}
          <div
            className={`
              fixed md:static top-16 md:top-0 bottom-0 left-0 z-20
              h-full
              transform md:transform-none transition-transform duration-300
              ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0
            `}
          >
            <DashboardSidebar
              items={navigationItems}
              isCollapsed={false}
            />
          </div>
        </div>

        {/* Content Area - Right side */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Nested routes render here */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
