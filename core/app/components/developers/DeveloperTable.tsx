/**
 * Developer Table Component
 *
 * Displays developers in table format (for desktop view).
 * Includes sortable columns: name, email, organization, created date, activity count.
 * Rows are clickable and navigate to developer detail page.
 */

import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Developer type for table display
 */
interface DeveloperListItem {
  developerId: string;
  displayName: string | null;
  primaryEmail: string;
  avatarUrl: string | null;
  organizationId: string | null;
  organization?: {
    organizationId: string;
    name: string;
  } | null;
  activityCount?: number;
  createdAt: string | Date;
}

/**
 * Props for DeveloperTable component
 */
interface DeveloperTableProps {
  /** List of developers to display */
  developers: DeveloperListItem[];
  /** Current sort field */
  sortBy: 'name' | 'email' | 'createdAt' | 'activityCount';
  /** Current sort order */
  sortOrder: 'asc' | 'desc';
  /** Callback when column header is clicked for sorting */
  onSort: (column: 'name' | 'email' | 'createdAt' | 'activityCount') => void;
}

/**
 * DeveloperTable Component
 *
 * Renders developer data in table format with sortable column headers.
 */
export function DeveloperTable({
  developers,
  sortBy,
  sortOrder,
  onSort,
}: DeveloperTableProps) {
  // Generate initials from display name for avatar fallback
  // Falls back to email or "Developer" if displayName is null
  const getInitials = (name: string | null, email: string) => {
    const displayText = name || email || 'Developer';
    return displayText
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format date to human-readable string
  // Handles both Date objects and ISO string dates
  // Uses user's locale if available, falls back to navigator.language or 'en-US'
  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render sort icon for column header
  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return (
        <Icon
          icon="heroicons:arrows-up-down"
          className="w-4 h-4 text-gray-400"
        />
      );
    }

    return sortOrder === 'asc' ? (
      <Icon
        icon="heroicons:chevron-up"
        className="w-4 h-4 text-blue-600 dark:text-blue-400"
      />
    ) : (
      <Icon
        icon="heroicons:chevron-down"
        className="w-4 h-4 text-blue-600 dark:text-blue-400"
      />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {/* Table header */}
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {/* Developer column (with avatar) */}
            <th
              scope="col"
              className="px-6 py-3 text-left"
              aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                           hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => onSort('name')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSort('name');
                  }
                }}
                aria-label={`Sort by developer name ${sortBy === 'name' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
              >
                Developer
                <SortIcon column="name" />
              </button>
            </th>

            {/* Email column */}
            <th
              scope="col"
              className="px-6 py-3 text-left"
              aria-sort={sortBy === 'email' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                           hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => onSort('email')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSort('email');
                  }
                }}
                aria-label={`Sort by email ${sortBy === 'email' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
              >
                Email
                <SortIcon column="email" />
              </button>
            </th>

            {/* Organization column (not sortable) */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Organization
            </th>

            {/* Activity count column */}
            <th
              scope="col"
              className="px-6 py-3 text-left"
              aria-sort={sortBy === 'activityCount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                           hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => onSort('activityCount')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSort('activityCount');
                  }
                }}
                aria-label={`Sort by activity count ${sortBy === 'activityCount' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
              >
                Activities
                <SortIcon column="activityCount" />
              </button>
            </th>

            {/* Created date column */}
            <th
              scope="col"
              className="px-6 py-3 text-left"
              aria-sort={sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                           hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => onSort('createdAt')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSort('createdAt');
                  }
                }}
                aria-label={`Sort by creation date ${sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
              >
                Created
                <SortIcon column="createdAt" />
              </button>
            </th>
          </tr>
        </thead>

        {/* Table body */}
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {developers.map((developer) => (
            <tr
              key={developer.developerId}
              className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Developer cell (with avatar and name) */}
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  to={`/dashboard/developers/${developer.developerId}`}
                  className="flex items-center gap-3"
                >
                  {developer.avatarUrl ? (
                    <img
                      src={developer.avatarUrl}
                      alt={developer.displayName || developer.primaryEmail}
                      className="w-10 h-10 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900
                                 flex items-center justify-center text-blue-600 dark:text-blue-300
                                 font-semibold text-sm"
                      aria-label={`Avatar for ${developer.displayName || developer.primaryEmail}`}
                    >
                      {getInitials(developer.displayName, developer.primaryEmail)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {developer.displayName || developer.primaryEmail}
                  </span>
                </Link>
              </td>

              {/* Email cell */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {developer.primaryEmail}
                </span>
              </td>

              {/* Organization cell */}
              <td className="px-6 py-4 whitespace-nowrap">
                {developer.organization ? (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {developer.organization.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                    N/A
                  </span>
                )}
              </td>

              {/* Activity count cell */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                               bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  {developer.activityCount || 0}
                </span>
              </td>

              {/* Created date cell */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                {formatDate(developer.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {developers.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800">
          <Icon
            icon="heroicons:users"
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No developers found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  );
}
