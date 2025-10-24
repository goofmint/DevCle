/**
 * Resource Table Component (Common Component)
 *
 * Displays list of resources (event, blog, video, etc.) for a campaign.
 * Fetches data from /api/campaigns/:id/resources
 *
 * Features:
 * - Card grid view (responsive: 1-3 columns)
 * - Category filter (event, blog, video, ad, repo, link, form, webinar)
 * - Pagination (limit: 12 per page)
 * - URL params sync (no page reload on filter changes)
 *
 * Design Pattern:
 * - Similar to DeveloperTable and BudgetTable
 * - Uses useSearchParams for URL state management
 * - useEffect re-fetches data when params change
 *
 * Props:
 * - campaignId: Campaign ID to fetch resources for
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Resource entry type
 */
interface Resource {
  resourceId: string;
  category: string;
  groupKey: string | null;
  title: string;
  url: string;
  externalId: string | null;
  campaignId: string;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Props for ResourceTable component
 */
interface ResourceTableProps {
  campaignId: string;
}

/**
 * Category icon mapping
 * Returns appropriate icon based on resource category
 */
const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    event: 'heroicons:calendar',
    blog: 'heroicons:document-text',
    video: 'heroicons:video-camera',
    ad: 'heroicons:megaphone',
    repo: 'heroicons:code-bracket',
    link: 'heroicons:link',
    form: 'heroicons:clipboard-document-list',
    webinar: 'heroicons:presentation-chart-line',
  };
  return iconMap[category] || 'heroicons:document';
};

/**
 * ResourceTable Component
 *
 * Renders resource data in responsive card grid with filtering and pagination.
 * All filter/pagination changes update URL params and trigger re-fetch (no page reload).
 */
export function ResourceTable({ campaignId }: ResourceTableProps) {
  // URL params management (no reload pattern)
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const limit = 12;

  // State management
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data fetching (re-fetch when URL params change)
  useEffect(() => {
    async function fetchResources() {
      try {
        setLoading(true);
        setError(null);

        const offset = (page - 1) * limit;
        const url = new URL(`/api/campaigns/${campaignId}/resources`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
        if (category) {
          url.searchParams.set('category', category);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch resources');
        }

        const data = await response.json();
        setResources(data.resources || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch resources:', err);
        setError(err instanceof Error ? err.message : 'Failed to load resources');
      } finally {
        setLoading(false);
      }
    }

    fetchResources();
  }, [campaignId, page, category, limit]);

  // Filter handler (updates URL params, triggers useEffect re-fetch)
  const handleCategoryChange = (newCategory: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'resources'); // Maintain current tab
    newSearchParams.set('page', '1'); // Reset to page 1 when filtering
    if (newCategory) {
      newSearchParams.set('category', newCategory);
    } else {
      newSearchParams.delete('category');
    }
    setSearchParams(newSearchParams);
  };

  // Pagination handler (updates URL params, triggers useEffect re-fetch)
  const handlePageChange = (newPage: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'resources'); // Maintain current tab
    newSearchParams.set('page', String(newPage));
    if (category) {
      newSearchParams.set('category', category);
    }
    setSearchParams(newSearchParams);
  };

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  // Loading state (skeleton loader)
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="resource-list-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
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
    <div data-testid="resource-list">
      {/* Filter Controls */}
      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Category:
        </label>
        <select
          id="category-filter"
          data-testid="category-filter"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="event">Event</option>
          <option value="blog">Blog</option>
          <option value="video">Video</option>
          <option value="ad">Advertisement</option>
          <option value="repo">Repository</option>
          <option value="link">Link</option>
          <option value="form">Form</option>
          <option value="webinar">Webinar</option>
        </select>
      </div>

      {/* Resource Grid */}
      {resources.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource) => (
              <div
                key={resource.resourceId}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4
                           bg-white dark:bg-gray-800 hover:shadow-md dark:hover:shadow-lg
                           transition-shadow"
                data-testid="resource-card"
              >
                {/* Category badge with icon */}
                <div className="flex items-center gap-2 mb-3">
                  <Icon
                    icon={getCategoryIcon(resource.category)}
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  />
                  <span
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                    data-testid="resource-category"
                  >
                    {resource.category}
                  </span>
                </div>

                {/* Resource title */}
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {resource.title}
                </h3>

                {/* Resource URL */}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1 break-all"
                >
                  <Icon icon="heroicons:arrow-top-right-on-square" className="w-4 h-4 flex-shrink-0" />
                  <span className="line-clamp-1">{resource.url}</span>
                </a>

                {/* Group key (if exists) */}
                {resource.groupKey && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Group:</span> {resource.groupKey}
                  </div>
                )}

                {/* External ID (if exists) */}
                {resource.externalId && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">ID:</span> {resource.externalId}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} resources
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
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="resources-empty-state">
          <Icon
            icon="heroicons:folder-open"
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No resources found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {category ? 'Try adjusting your filter criteria.' : 'This campaign has no resources yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
