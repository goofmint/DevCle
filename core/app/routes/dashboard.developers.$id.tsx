/**
 * Developer Detail Page
 *
 * Route: /dashboard/developers/:id
 *
 * Displays detailed information about a single developer including:
 * - Basic information (name, email, organization)
 * - Identifiers (GitHub, Twitter, Slack, etc.)
 * - Activity statistics (funnel stages)
 * - Recent activities timeline
 *
 * Note: This page uses SPA-based data fetching (useEffect) instead of loader
 * because it's an authenticated page and we want to fetch data client-side.
 */

import { useParams, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { DeveloperDetail } from '~/components/developers/DeveloperDetail';
import { ActivityTimeline } from '~/components/developers/ActivityTimeline';

/**
 * Type definitions for developer detail data
 */
interface Developer {
  developerId: string;
  displayName: string;
  primaryEmail: string;
  bio: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  consentAnalytics: boolean;
  createdAt: Date;
}

interface Organization {
  organizationId: string;
  name: string;
  domainPrimary: string | null;
}

interface DeveloperIdentifier {
  identifierId: string;
  kind: string;
  valueNormalized: string;
  confidence: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
}

interface Activity {
  activityId: string;
  action: string;
  source: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  value: string | null;
}

interface ActivityStats {
  totalActivities: number;
  awarenessCount: number;
  engagementCount: number;
  adoptionCount: number;
  advocacyCount: number;
}

interface DeveloperDetailData {
  developer: Developer;
  organization: Organization | null;
  identifiers: DeveloperIdentifier[];
  recentActivities: Activity[];
  stats: ActivityStats;
}

/**
 * Developer Detail Page Component
 *
 * Fetches developer details, identifiers, activities, and stats via API calls.
 * Shows loading state while fetching, error state on failure.
 */
export default function DeveloperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeveloperDetailData | null>(null);

  useEffect(() => {
    // Validate developer ID
    if (!id) {
      setError('Developer ID is required');
      setLoading(false);
      return;
    }

    // Fetch developer detail data
    async function fetchDeveloperDetail() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [detailResponse, identifiersResponse, activitiesResponse, statsResponse] = await Promise.all([
          fetch(`/api/developers/${id}`),
          fetch(`/api/developers/${id}/identifiers`),
          fetch(`/api/developers/${id}/activities?limit=10&sortOrder=desc`),
          fetch(`/api/developers/${id}/stats`),
        ]);

        // Check response status
        if (!detailResponse.ok) {
          if (detailResponse.status === 404) {
            throw new Error('Developer not found');
          }
          throw new Error(`Failed to fetch developer: ${detailResponse.status}`);
        }
        if (!identifiersResponse.ok) {
          throw new Error(`Failed to fetch identifiers: ${identifiersResponse.status}`);
        }
        if (!activitiesResponse.ok) {
          throw new Error(`Failed to fetch activities: ${activitiesResponse.status}`);
        }
        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
        }

        // Parse JSON responses
        const detail = await detailResponse.json();
        const identifiers = await identifiersResponse.json();
        const activities = await activitiesResponse.json();
        const stats = await statsResponse.json();

        // Set data
        setData({
          developer: detail,
          organization: detail.organization || null,
          identifiers: identifiers.identifiers || [],
          recentActivities: activities.activities || [],
          stats: stats.stats || {
            totalActivities: 0,
            awarenessCount: 0,
            engagementCount: 0,
            adoptionCount: 0,
            advocacyCount: 0,
          },
        });
      } catch (err) {
        console.error('Failed to fetch developer details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load developer details');
      } finally {
        setLoading(false);
      }
    }

    fetchDeveloperDetail();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading developer details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <Link
            to="/dashboard/developers"
            className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Back to Developers List
          </Link>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-400">No data available</p>
          <Link
            to="/dashboard/developers"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Developers List
          </Link>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/dashboard/developers"
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Developers
        </Link>
      </div>

      {/* Developer detail */}
      <DeveloperDetail
        developer={data.developer}
        organization={data.organization}
        identifiers={data.identifiers}
        stats={data.stats}
      />

      {/* Activity timeline */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Recent Activities
        </h2>
        <ActivityTimeline activities={data.recentActivities} />
      </div>
    </div>
  );
}
