/**
 * Dashboard Type Definitions
 *
 * Defines types for dashboard layout, navigation, and widgets.
 * These types support plugin extensibility for dynamic navigation items.
 */

/**
 * Navigation item type
 *
 * Represents a single navigation item in the sidebar.
 * Can be a core item or a plugin-registered item.
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
   * Icon name (from icon library)
   * Should match Heroicons icon names
   * Example: 'home', 'users', 'megaphone'
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
}
