/**
 * Developer Filters Component
 *
 * Provides search and filter UI for developer list.
 * Includes:
 * - Search input (debounced)
 * - Organization filter dropdown
 * - Analytics consent filter (3-state: null=all, true=consented, false=not consented)
 * - Reset button
 *
 * All inputs are controlled and synced with URL parameters via Form submission.
 */

import { useState, useEffect } from 'react';

/**
 * Organization type for dropdown
 */
interface Organization {
  organizationId: string;
  name: string;
}

/**
 * Props for DeveloperFilters component
 */
interface DeveloperFiltersProps {
  /** Current search query */
  query: string;
  /** Current organization filter (null = all organizations) */
  organizationId: string | null;
  /** Current analytics consent filter (null = all, true = consented, false = not consented) */
  consentAnalytics: boolean | null;
  /** List of organizations for dropdown */
  organizations: Organization[];
  /** Callback when query changes */
  onQueryChange: (query: string) => void;
  /** Callback when organization filter changes */
  onOrganizationChange: (organizationId: string | null) => void;
  /** Callback when consent filter changes */
  onConsentAnalyticsChange: (consentAnalytics: boolean | null) => void;
  /** Callback when reset button is clicked */
  onReset: () => void;
}

/**
 * DeveloperFilters Component
 *
 * Renders search box, organization dropdown, analytics consent filter, and reset button.
 * Search input is debounced to reduce API calls.
 */
export function DeveloperFilters({
  query,
  organizationId,
  consentAnalytics,
  organizations,
  onQueryChange,
  onOrganizationChange,
  onConsentAnalyticsChange,
  onReset,
}: DeveloperFiltersProps) {
  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(query);

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== query) {
        onQueryChange(searchInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, query, onQueryChange]);

  // Sync search input with prop when it changes externally (e.g., reset)
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="space-y-4">
        {/* Search input */}
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Search Developers
          </label>
          <input
            type="text"
            id="search"
            name="query"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Organization filter */}
          <div>
            <label
              htmlFor="organization"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Organization
            </label>
            <select
              id="organization"
              name="organizationId"
              value={organizationId || ''}
              onChange={(e) =>
                onOrganizationChange(e.target.value || null)
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.organizationId} value={org.organizationId}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Analytics consent filter */}
          <div>
            <label
              htmlFor="consent"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Analytics Consent
            </label>
            <select
              id="consent"
              name="consentAnalytics"
              value={
                consentAnalytics === null
                  ? ''
                  : consentAnalytics
                  ? 'true'
                  : 'false'
              }
              onChange={(e) =>
                onConsentAnalyticsChange(
                  e.target.value === ''
                    ? null
                    : e.target.value === 'true'
                )
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="true">Consented</option>
              <option value="false">Not Consented</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                       hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors
                       font-medium"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
