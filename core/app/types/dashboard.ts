/**
 * Dashboard Type Definitions
 *
 * Defines types for dashboard layout, navigation, and widgets.
 * These types support plugin extensibility for dynamic navigation items.
 */

/**
 * Child navigation item type (Level 2)
 *
 * Represents a second-level navigation item in the sidebar.
 * Cannot have children (maximum 2 levels enforced).
 */
export interface NavigationItemChild {
  /**
   * Unique key for the navigation item
   * Used for React keys and identification
   */
  key: string;

  /**
   * Display label
   * Shown in the sidebar navigation
   */
  label: string;

  /**
   * Route path
   * The URL path this item links to
   * Example: '/dashboard/plugins/github/settings'
   */
  path: string;

  /**
   * Icon name (from icon library or Iconify)
   * Example: 'users', 'mdi:account-multiple'
   */
  icon?: string;

  /**
   * Badge text (optional, for notifications)
   * Displayed as a small badge next to the label
   * Example: '3' for 3 unread notifications
   */
  badge?: string;

  /**
   * Plugin ID (if registered by a plugin)
   * Undefined for core navigation items
   * Set by plugins when registering custom navigation items
   */
  pluginId?: string;
}

/**
 * Navigation item type (Level 1)
 *
 * Represents a top-level navigation item in the sidebar.
 * Can be a core item or a plugin-registered item.
 * Can have children (max 2 levels total).
 */
export interface NavigationItem {
  /**
   * Unique key for the navigation item
   * Used for React keys and identification
   */
  key: string;

  /**
   * Display label
   * Shown in the sidebar navigation
   */
  label: string;

  /**
   * Route path
   * The URL path this item links to
   * Example: '/dashboard', '/dashboard/developers'
   */
  path: string;

  /**
   * Icon name (from icon library or Iconify)
   * Should match Heroicons icon names for core items
   * Can be Iconify icon names for plugin items
   * Example: 'home', 'users', 'mdi:chart-line'
   */
  icon: string;

  /**
   * Badge text (optional, for notifications)
   * Displayed as a small badge next to the label
   * Example: '3' for 3 unread notifications
   */
  badge?: string;

  /**
   * Whether this item should be shown at the bottom
   * Items with isBottomItem=true are separated from main items
   * Example: System Settings should be at the bottom
   */
  isBottomItem?: boolean;

  /**
   * Plugin ID (if registered by a plugin)
   * Undefined for core navigation items
   * Set by plugins when registering custom navigation items
   */
  pluginId?: string;

  /**
   * Order number (for sorting)
   * Lower numbers appear first
   * Core items: 10, 20, 30, 40
   * Bottom items: 1000+
   */
  order?: number;

  /**
   * Child navigation items (Level 2 only, no further nesting)
   * Plugin menu items can have children
   * Maximum depth: 2 levels
   */
  children?: NavigationItemChild[];
}

/**
 * Dashboard layout data
 *
 * Data passed to the dashboard layout component.
 * Returned by the loader function in dashboard.tsx
 */
export interface DashboardLayoutData {
  /**
   * Current user
   * Contains user information from the authentication session
   */
  user: User;

  /**
   * Navigation items (core + plugins)
   * Array of navigation items to display in the sidebar
   * Includes both core items and plugin-registered items
   */
  navigationItems: NavigationItem[];
}

/**
 * User type
 *
 * Represents the currently authenticated user.
 * This is the single source of truth for user data in dashboard components.
 */
export interface User {
  /**
   * User ID
   * Unique identifier for the user
   */
  userId: string;

  /**
   * Email address
   * Used for display and identification
   */
  email: string;

  /**
   * Display name
   * User's full name or preferred display name
   */
  displayName: string;

  /**
   * Role (admin, member)
   * Determines user permissions
   */
  role: 'admin' | 'member';

  /**
   * Tenant ID
   * The tenant this user belongs to (for multi-tenancy)
   */
  tenantId: string;

  /**
   * Avatar URL (optional)
   * URL to the user's avatar image
   * If not provided, initials will be shown instead
   */
  avatarUrl?: string;

  /**
   * User capabilities (permissions)
   * Used for filtering plugin menu items and other permission checks
   * Admin users typically have ["*"] (wildcard)
   * Example: ["analytics:read", "campaigns:write"]
   */
  capabilities?: string[];
}
