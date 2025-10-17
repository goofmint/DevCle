/**
 * Developer List Component
 *
 * Main container component for developer list page.
 * Integrates filters, table/card view, and pagination.
 * Manages filter state and syncs with URL parameters.
 */

import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { DeveloperFilters } from './DeveloperFilters';
import { DeveloperTable } from './DeveloperTable';
import { DeveloperCard } from './DeveloperCard';
import { Pagination } from './Pagination';

/**
 * Developer type for list display
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
  createdAt: Date;
}

/**
 * Organization type for filters
 */
interface Organization {
  organizationId: string;
  name: string;
}

/**
 * Pagination info
 */
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Filter values
 */
interface FilterValues {
  query: string;
  organizationId: string | null;
  consentAnalytics: boolean | null;
  sortBy: 'name' | 'email' | 'createdAt' | 'activityCount';
  sortOrder: 'asc' | 'desc';
}

/**
 * Props for DeveloperList component
 */
interface DeveloperListProps {
  /** List of developers to display */
  developers: DeveloperListItem[];
  /** List of organizations for filter dropdown */
  organizations: Organization[];
  /** Pagination info */
  pagination: Pagination;
  /** Initial filter values from URL params */
  initialFilters: FilterValues;
  /** View mode (table or card), defaults to responsive (table on desktop, card on mobile) */
  viewMode?: 'table' | 'card' | 'responsive';
}

/**
 * DeveloperList Component
 *
 * Renders developer list with filters, sorting, and pagination.
 * Automatically switches between table and card view based on screen size (if viewMode='responsive').
 */
export function DeveloperList({
  developers,
  organizations,
  pagination,
  initialFilters,
  viewMode = 'responsive',
}: DeveloperListProps) {
  const navigate = useNavigate();

  // Filter state
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  // Update URL with new filter values
  const updateUrl = (newFilters: Partial<FilterValues>) => {
    const updatedFilters = { ...filters, ...newFilters };
    const params = new URLSearchParams();

    if (updatedFilters.query) {
      params.set('query', updatedFilters.query);
    }
    if (updatedFilters.organizationId) {
      params.set('organizationId', updatedFilters.organizationId);
    }
    if (updatedFilters.consentAnalytics !== null) {
      params.set('consentAnalytics', String(updatedFilters.consentAnalytics));
    }
    params.set('sortBy', updatedFilters.sortBy);
    params.set('sortOrder', updatedFilters.sortOrder);
    params.set('page', '1'); // Reset to first page on filter change

    navigate(`?${params.toString()}`, { replace: true });
  };

  // Handle filter changes
  const handleQueryChange = (query: string) => {
    setFilters({ ...filters, query });
    updateUrl({ query });
  };

  const handleOrganizationChange = (organizationId: string | null) => {
    setFilters({ ...filters, organizationId });
    updateUrl({ organizationId });
  };

  const handleConsentAnalyticsChange = (consentAnalytics: boolean | null) => {
    setFilters({ ...filters, consentAnalytics });
    updateUrl({ consentAnalytics });
  };

  const handleReset = () => {
    const resetFilters: FilterValues = {
      query: '',
      organizationId: null,
      consentAnalytics: null,
      sortBy: 'name',
      sortOrder: 'asc',
    };
    setFilters(resetFilters);
    updateUrl(resetFilters);
  };

  // Handle sort column click
  const handleSort = (column: 'name' | 'email' | 'createdAt' | 'activityCount') => {
    const newSortOrder =
      filters.sortBy === column && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    setFilters({ ...filters, sortBy: column, sortOrder: newSortOrder });
    updateUrl({ sortBy: column, sortOrder: newSortOrder });
  };

  return (
    <div>
      {/* Filters */}
      <DeveloperFilters
        query={filters.query}
        organizationId={filters.organizationId}
        consentAnalytics={filters.consentAnalytics}
        organizations={organizations}
        onQueryChange={handleQueryChange}
        onOrganizationChange={handleOrganizationChange}
        onConsentAnalyticsChange={handleConsentAnalyticsChange}
        onReset={handleReset}
      />

      {/* Table view (desktop) or responsive */}
      {(viewMode === 'table' || viewMode === 'responsive') && (
        <div className={viewMode === 'responsive' ? 'hidden md:block' : ''}>
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <DeveloperTable
              developers={developers}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={handleSort}
            />
          </div>
        </div>
      )}

      {/* Card view (mobile/tablet) or responsive */}
      {(viewMode === 'card' || viewMode === 'responsive') && (
        <div className={viewMode === 'responsive' ? 'md:hidden' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {developers.map((developer) => (
              <DeveloperCard key={developer.developerId} developer={developer} />
            ))}
          </div>

          {/* Empty state for card view */}
          {developers.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No developers found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
        />
      </div>
    </div>
  );
}
