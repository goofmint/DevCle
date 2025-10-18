/**
 * Developers List Page
 *
 * Route: /dashboard/developers
 *
 * Displays paginated list of developers with search and filter functionality.
 * Supports table view (desktop) and card view (mobile/tablet).
 *
 * Note: Uses SPA pattern - fetches data client-side via API calls.
 */

import { useSearchParams } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { DeveloperList } from '~/components/developers/DeveloperList';

/**
 * Type definitions for API responses
 */
interface Developer {
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

interface Organization {
  organizationId: string;
  name: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Developers Page Component
 *
 * Fetches developers and organizations via API calls.
 * Manages loading and error states.
 */
export default function DevelopersPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Extract filter values from URL params
  const query = searchParams.get('query') || '';
  const organizationId = searchParams.get('organizationId') || null;
  const consentAnalyticsParam = searchParams.get('consentAnalytics');
  const consentAnalytics =
    consentAnalyticsParam === 'true'
      ? true
      : consentAnalyticsParam === 'false'
      ? false
      : null;
  const sortBy = (searchParams.get('sortBy') as 'name' | 'email' | 'createdAt' | 'activityCount') || 'name';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Fetch data when URL params change
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Build API request parameters
        const apiParams = new URLSearchParams({
          limit: String(limit),
          offset: String((page - 1) * limit),
          orderBy: sortBy === 'name' ? 'displayName' : sortBy === 'email' ? 'primaryEmail' : sortBy,
          orderDirection: sortOrder,
        });

        if (query) {
          apiParams.set('search', query);
        }
        if (organizationId) {
          apiParams.set('orgId', organizationId);
        }
        if (consentAnalytics !== null) {
          apiParams.set('consentAnalytics', String(consentAnalytics));
        }

        // Fetch developers and organizations in parallel
        const [developersResponse, organizationsResponse] = await Promise.all([
          fetch(`/api/developers?${apiParams.toString()}`),
          fetch('/api/organizations'),
        ]);

        if (!developersResponse.ok) {
          throw new Error(`Failed to fetch developers: ${developersResponse.status}`);
        }
        if (!organizationsResponse.ok) {
          throw new Error(`Failed to fetch organizations: ${organizationsResponse.status}`);
        }

        const developersData = await developersResponse.json();
        const organizationsData = await organizationsResponse.json();

        setDevelopers(developersData.developers || []);
        setOrganizations(organizationsData.organizations || []);
        setPagination({
          page,
          limit,
          total: developersData.total || 0,
          totalPages: Math.ceil((developersData.total || 0) / limit),
        });
      } catch (err) {
        console.error('Failed to fetch developers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load developers');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [query, organizationId, consentAnalytics, sortBy, sortOrder, page, limit]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Developers
        </h1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading developers...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Developers
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Developers
      </h1>

      <DeveloperList
        initialDevelopers={developers}
        organizations={organizations}
        initialPagination={pagination}
        initialFilters={{
          query,
          organizationId,
          consentAnalytics,
          sortBy,
          sortOrder,
        }}
      />
    </div>
  );
}
