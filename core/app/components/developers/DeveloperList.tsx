/**
 * Developer List Component
 *
 * Main container component for developer list page.
 * Integrates filters, table/card view, and pagination.
 * Fetches data client-side via API on filter changes (no page reload).
 */

import { useState } from 'react';
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
  /** Initial list of developers to display */
  initialDevelopers: DeveloperListItem[];
  /** List of organizations for filter dropdown */
  organizations: Organization[];
  /** Initial pagination info */
  initialPagination: Pagination;
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
 * Fetches data via API on filter changes (no page reload).
 */
export function DeveloperList({
  initialDevelopers,
  organizations,
  initialPagination,
  initialFilters,
  viewMode = 'responsive',
}: DeveloperListProps) {
  // Component state
  const [developers, setDevelopers] = useState<DeveloperListItem[]>(initialDevelopers);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  // Fetch developers from API
  const fetchDevelopers = async (newFilters: FilterValues, page: number = 1, updateHistory: boolean = true) => {
    try {
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String((page - 1) * pagination.limit),
        orderBy: newFilters.sortBy === 'name' ? 'displayName' : newFilters.sortBy === 'email' ? 'primaryEmail' : newFilters.sortBy,
        orderDirection: newFilters.sortOrder,
      });

      if (newFilters.query) {
        params.set('search', newFilters.query);
      }
      if (newFilters.organizationId) {
        params.set('orgId', newFilters.organizationId);
      }
      if (newFilters.consentAnalytics !== null) {
        params.set('consentAnalytics', String(newFilters.consentAnalytics));
      }

      // Update browser history (for back/forward navigation)
      if (updateHistory) {
        const urlParams = new URLSearchParams();
        if (newFilters.query) urlParams.set('query', newFilters.query);
        if (newFilters.organizationId) urlParams.set('organizationId', newFilters.organizationId);
        if (newFilters.consentAnalytics !== null) urlParams.set('consentAnalytics', String(newFilters.consentAnalytics));
        if (newFilters.sortBy !== 'name') urlParams.set('sortBy', newFilters.sortBy);
        if (newFilters.sortOrder !== 'asc') urlParams.set('sortOrder', newFilters.sortOrder);
        if (page > 1) urlParams.set('page', String(page));

        const newUrl = urlParams.toString() ? `?${urlParams.toString()}` : window.location.pathname;
        window.history.pushState({}, '', newUrl);
      }

      const response = await fetch(`/api/developers?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch developers: ${response.status}`);
      }

      const data = await response.json();
      setDevelopers(data.developers || []);
      setPagination({
        page,
        limit: pagination.limit,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / pagination.limit),
      });
    } catch (err) {
      console.error('Failed to fetch developers:', err);
    }
  };

  // Handle query change after debounce (called after user stops typing)
  const handleQueryChange = (query: string) => {
    const newFilters = { ...filters, query };
    setFilters(newFilters);
    // Update history after debounce (not during typing)
    fetchDevelopers(newFilters, 1, true);
  };

  const handleOrganizationChange = (organizationId: string | null) => {
    const newFilters = { ...filters, organizationId };
    setFilters(newFilters);
    fetchDevelopers(newFilters);
  };

  const handleConsentAnalyticsChange = (consentAnalytics: boolean | null) => {
    const newFilters = { ...filters, consentAnalytics };
    setFilters(newFilters);
    fetchDevelopers(newFilters);
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
    fetchDevelopers(resetFilters);
  };

  // Handle sort column click
  const handleSort = (column: 'name' | 'email' | 'createdAt' | 'activityCount') => {
    const newSortOrder: 'asc' | 'desc' =
      filters.sortBy === column && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    const newFilters: FilterValues = { ...filters, sortBy: column, sortOrder: newSortOrder };
    setFilters(newFilters);
    fetchDevelopers(newFilters);
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
