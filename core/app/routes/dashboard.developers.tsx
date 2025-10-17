/**
 * Developers List Page
 *
 * Route: /dashboard/developers
 *
 * Displays paginated list of developers with search and filter functionality.
 * Supports table view (desktop) and card view (mobile/tablet).
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware.js';
import { DeveloperList } from '~/components/developers/DeveloperList';

/**
 * Type definitions for loader data
 *
 * Note: We don't use explicit type annotation on loader return
 * to avoid Remix's Jsonify type complications. The types are
 * inferred correctly by useLoaderData.
 */

/**
 * Loader function
 *
 * Fetches developers list and organizations for filters.
 * Supports query parameters for filtering, sorting, and pagination.
 *
 * Query Parameters:
 * - query: Search query (name or email)
 * - organizationId: Filter by organization
 * - consentAnalytics: Filter by analytics consent (true/false)
 * - sortBy: Sort field (name, email, createdAt, activityCount)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    await requireAuth(request);

    // 2. Parse query parameters
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const consentAnalyticsParam = url.searchParams.get('consentAnalytics');
    const consentAnalytics =
      consentAnalyticsParam === 'true'
        ? true
        : consentAnalyticsParam === 'false'
        ? false
        : undefined;
    const sortBy = url.searchParams.get('sortBy') || 'displayName';
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // 3. Build API request parameters
    const apiParams = new URLSearchParams({
      limit: String(limit),
      offset: String((page - 1) * limit),
      orderBy: sortBy,
      orderDirection: sortOrder,
    });

    if (query) {
      apiParams.set('search', query);
    }
    if (organizationId) {
      apiParams.set('orgId', organizationId);
    }
    if (consentAnalytics !== undefined) {
      apiParams.set('consentAnalytics', String(consentAnalytics));
    }

    // 4. Fetch developers and organizations in parallel
    const [developersResponse, organizationsResponse] = await Promise.all([
      fetch(`http://localhost:3000/api/developers?${apiParams.toString()}`, {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }),
      fetch('http://localhost:3000/api/organizations', {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }),
    ]);

    // 5. Check response status
    if (!developersResponse.ok) {
      throw new Error(
        `Failed to fetch developers: ${developersResponse.status}`
      );
    }
    if (!organizationsResponse.ok) {
      throw new Error(
        `Failed to fetch organizations: ${organizationsResponse.status}`
      );
    }

    // 6. Parse JSON responses
    const developersData = await developersResponse.json();
    const organizationsData = await organizationsResponse.json();

    // 7. Calculate pagination
    const total = developersData.total || 0;
    const totalPages = Math.ceil(total / limit);

    // 8. Return loader data
    return json({
      developers: developersData.developers || [],
      organizations: organizationsData.organizations || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      throw error; // Re-throw redirect response
    }

    // Handle other errors
    console.error('Developers loader error:', error);
    throw new Response('Failed to load developers', { status: 500 });
  }
}

/**
 * Developers Page Component
 *
 * Renders developer list with filters, sorting, and pagination.
 */
export default function DevelopersPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Developers
      </h1>

      <DeveloperList
        developers={data.developers}
        organizations={data.organizations}
        pagination={{
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }}
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
