/**
 * Developer Card Component
 *
 * Displays developer information in card format (for mobile/tablet views).
 * Includes avatar, name, email, organization, and activity count.
 * Clickable card navigates to developer detail page.
 */

import { Link } from '@remix-run/react';

/**
 * Developer type for card display
 */
interface DeveloperListItem {
  developerId: string;
  displayName: string;
  primaryEmail: string;
  avatarUrl: string | null;
  organizationId: string | null;
  organization?: {
    organizationId: string;
    name: string;
  } | null;
  activityCount?: number;
}

/**
 * Props for DeveloperCard component
 */
interface DeveloperCardProps {
  developer: DeveloperListItem;
}

/**
 * DeveloperCard Component
 *
 * Renders developer info as a card with hover effects.
 * Shows avatar (or initials fallback), name, email, organization, and activity count.
 */
export function DeveloperCard({ developer }: DeveloperCardProps) {
  // Generate initials from display name for avatar fallback
  const initials = developer.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link
      to={`/dashboard/developers/${developer.developerId}`}
      className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
               rounded-lg p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {developer.avatarUrl ? (
            <img
              src={developer.avatarUrl}
              alt={developer.displayName}
              className="w-16 h-16 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900
                         flex items-center justify-center text-blue-600 dark:text-blue-300
                         font-semibold text-lg"
            >
              {initials}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
            {developer.displayName}
          </h3>

          {/* Email */}
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">
            {developer.primaryEmail}
          </p>

          {/* Organization */}
          {developer.organization && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">
              <span className="font-medium">Organization:</span>{' '}
              {developer.organization.name}
            </p>
          )}

          {/* Activity count */}
          {developer.activityCount !== undefined && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                             bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                {developer.activityCount} activities
              </span>
            </div>
          )}
        </div>

        {/* Arrow icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
