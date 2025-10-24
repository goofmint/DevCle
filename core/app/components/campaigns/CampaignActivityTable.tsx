/**
 * Campaign Activity Table Component (Common Component)
 *
 * Displays paginated timeline of activities attributed to a campaign.
 * Fetches data from /api/campaigns/:id/activities
 *
 * Features:
 * - Timeline view (vertical list with icons)
 * - Action filter dropdown
 * - Pagination (limit: 20 per page)
 * - URL params sync (no page reload on filter changes)
 *
 * Design Pattern:
 * - Similar to DeveloperTable, BudgetTable, ResourceTable
 * - Uses useSearchParams for URL state management
 * - useEffect re-fetches data when params change
 *
 * Props:
 * - campaignId: Campaign ID to fetch activities for
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Activity entry type
 */
interface Activity {
  activityId: string;
  developerId: string | null;
  accountId: string | null;
  action: string;
  occurredAt: string;
  source: string;
  category: string;
  value: string | null;
  metadata: Record<string, unknown> | null;
  // Additional fields from join (if developer exists)
  developer?: {
    developerId: string;
    displayName: string;
    primaryEmail: string;
  } | null;
}

/**
 * Props for CampaignActivityTable component
 */
interface CampaignActivityTableProps {
  campaignId: string;
}

/**
 * Action icon mapping
 * Returns appropriate icon based on activity action
 */
const getActionIcon = (action: string): string => {
  const iconMap: Record<string, string> = {
    click: 'heroicons:cursor-arrow-rays',
    view: 'heroicons:eye',
    signup: 'heroicons:user-plus',
    login: 'heroicons:arrow-right-on-rectangle',
    download: 'heroicons:arrow-down-tray',
    share: 'heroicons:share',
    comment: 'heroicons:chat-bubble-left',
    like: 'heroicons:heart',
    star: 'heroicons:star',
    fork: 'heroicons:code-bracket',
    commit: 'heroicons:document-plus',
    issue: 'heroicons:exclamation-circle',
    pr: 'heroicons:arrow-path',
    deploy: 'heroicons:rocket-launch',
  };
  return iconMap[action.toLowerCase()] || 'heroicons:arrow-right-circle';
};

/**
 * CampaignActivityTable Component
 *
 * Renders activity data in timeline format with filtering and pagination.
 * All filter/pagination changes update URL params and trigger re-fetch (no page reload).
 */
export function CampaignActivityTable({ campaignId }: CampaignActivityTableProps) {
  // URL params management (no reload pattern)
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const action = searchParams.get('action') || '';
  const limit = 20;

  // State management
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data fetching (re-fetch when URL params change)
  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        setError(null);

        const offset = (page - 1) * limit;
        const url = new URL(`/api/campaigns/${campaignId}/activities`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
        if (action) {
          url.searchParams.set('action', action);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch activities');
        }

        const data = await response.json();
        setActivities(data.activities || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch activities:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [campaignId, page, action, limit]);

  // Filter handler (updates URL params, triggers useEffect re-fetch)
  const handleActionChange = (newAction: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'activities'); // Maintain current tab
    newSearchParams.set('page', '1'); // Reset to page 1 when filtering
    if (newAction) {
      newSearchParams.set('action', newAction);
    } else {
      newSearchParams.delete('action');
    }
    setSearchParams(newSearchParams);
  };

  // Pagination handler (updates URL params, triggers useEffect re-fetch)
  const handlePageChange = (newPage: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'activities'); // Maintain current tab
    newSearchParams.set('page', String(newPage));
    if (action) {
      newSearchParams.set('action', action);
    }
    setSearchParams(newSearchParams);
  };

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  // Format date to human-readable string with time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Loading state (skeleton loader)
  if (loading) {
    return (
      <div className="space-y-4" data-testid="activity-list-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="activity-list">
      {/* Filter Controls */}
      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="action-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Action:
        </label>
        <select
          id="action-filter"
          data-testid="action-filter"
          value={action}
          onChange={(e) => handleActionChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Actions</option>
          <option value="click">Click</option>
          <option value="view">View</option>
          <option value="signup">Sign Up</option>
          <option value="login">Login</option>
          <option value="download">Download</option>
          <option value="share">Share</option>
          <option value="comment">Comment</option>
          <option value="like">Like</option>
          <option value="star">Star</option>
          <option value="fork">Fork</option>
          <option value="commit">Commit</option>
        </select>
      </div>

      {/* Activity Timeline */}
      {activities.length > 0 ? (
        <>
          <div className="space-y-6">
            {activities.map((activity, index) => (
              <div key={activity.activityId} className="relative" data-testid="activity-item">
                {/* Timeline connector (vertical line) */}
                {index !== activities.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                )}

                {/* Activity card */}
                <div className="flex items-start gap-4">
                  {/* Action icon */}
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Icon
                      icon={getActionIcon(activity.action)}
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    />
                  </div>

                  {/* Activity details */}
                  <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      {/* Action and developer */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {activity.action}
                        </h4>
                        {activity.developer ? (
                          <Link
                            to={`/dashboard/developers/${activity.developerId}`}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {activity.developer.displayName || activity.developer.primaryEmail}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {activity.developerId ? `Developer ${activity.developerId}` : 'Anonymous'}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(activity.occurredAt)}
                      </time>
                    </div>

                    {/* Additional metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Source badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <Icon icon="heroicons:server" className="w-3 h-3 mr-1" />
                        {activity.source}
                      </span>

                      {/* Category badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                        <Icon icon="heroicons:tag" className="w-3 h-3 mr-1" />
                        {activity.category}
                      </span>

                      {/* Value (if exists) */}
                      {activity.value && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                          <Icon icon="heroicons:currency-dollar" className="w-3 h-3 mr-1" />
                          {activity.value}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} activities
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium
                             text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                             hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                  data-testid="pagination-prev"
                >
                  <Icon icon="heroicons:chevron-left" className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium
                             text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                             hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                  data-testid="pagination-next"
                >
                  <Icon icon="heroicons:chevron-right" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="activities-empty-state">
          <Icon
            icon="heroicons:clipboard-document-list"
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No activities found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {action ? 'Try adjusting your filter criteria.' : 'This campaign has no activities yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
