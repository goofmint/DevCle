/**
 * Campaign Detail Page
 *
 * Route: /dashboard/campaigns/:id
 *
 * Displays comprehensive information about a single campaign including:
 * - Campaign header (name, status, dates, ROI)
 * - Budgets section (cost entries with pagination)
 * - Resources section (trackable objects)
 * - Activities section (developer actions with pagination)
 *
 * Note: Uses SPA pattern - fetches data client-side via API calls (useEffect).
 * Authentication is handled by DashboardLayout, no loader needed for data fetching.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useParams, useSearchParams } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { requireAuth } from '~/auth.middleware';
import { CampaignHeader } from '~/components/campaigns/CampaignHeader';
import { BudgetTable } from '~/components/campaigns/BudgetTable';
import { ResourceTable } from '~/components/campaigns/ResourceTable';
import { CampaignActivityTable } from '~/components/campaigns/CampaignActivityTable';
import { DeleteCampaignDialog } from '~/components/campaigns/DeleteCampaignDialog';

/**
 * Loader function for authentication check
 * Returns null because actual data is fetched client-side via useEffect
 *
 * Note: Skips execution if the :id parameter is 'add' (static route)
 * This prevents /dashboard/campaigns/add from being treated as a detail page
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Skip loader execution if :id is 'new' (static route takes precedence)
  // This allows /dashboard/campaigns/new to be handled by dashboard.campaigns.new.tsx
  if (params['id'] === 'new') {
    // Let the static route handle this
    return json(null);
  }

  // Ensure user is authenticated before allowing access to this page
  await requireAuth(request);
  return json(null);
}

/**
 * Campaign type for detail page
 */
interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * ROI data type
 */
interface ROIData {
  totalCost: string;
  totalValue: string;
  roi: number | null;
  activityCount: number;
  developerCount: number;
}

/**
 * Campaign Detail Page Component
 *
 * Layout:
 * - Header: Campaign name, status, edit/delete buttons
 * - Stats Row: ROI, total budget, total activities
 * - Tabs: Overview | Budgets | Resources | Activities
 *
 * Implementation:
 * - Fetch campaign data from /api/campaigns/:id (useEffect)
 * - Fetch ROI from /api/campaigns/:id/roi (useEffect)
 * - Child components (BudgetTable, ResourceTable, CampaignActivityTable) fetch their own data
 * - Use TailwindCSS for styling
 *
 * State Management:
 * - campaign: Campaign | null
 * - roi: ROIData | null
 * - loading: boolean
 * - error: string | null
 */
export default function CampaignDetailPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  // Skip rendering if campaignId is 'new' (static route handled by dashboard.campaigns.new.tsx)
  // This prevents the dynamic route from interfering with the static route
  if (campaignId === 'new') {
    return null;
  }

  // State for campaign and ROI data
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for delete dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch campaign data when campaignId changes
  useEffect(() => {
    if (!campaignId) {
      setError('Campaign ID is required');
      setLoading(false);
      return;
    }

    async function fetchCampaign() {
      try {
        setLoading(true);
        setError(null);

        // Fetch campaign basic info and ROI in parallel
        const [campaignResponse, roiResponse] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch(`/api/campaigns/${campaignId}/roi`),
        ]);

        // Check campaign response
        if (!campaignResponse.ok) {
          if (campaignResponse.status === 404) {
            throw new Error('Campaign not found');
          }
          throw new Error(`Failed to fetch campaign: ${campaignResponse.status}`);
        }

        // Parse campaign data
        const campaignData = await campaignResponse.json();
        setCampaign(campaignData);

        // Parse ROI data (optional, may not exist for all campaigns)
        if (roiResponse.ok) {
          const roiData = await roiResponse.json();
          setRoi(roiData);
        }
      } catch (err) {
        console.error('Failed to fetch campaign:', err);
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    }

    fetchCampaign();
  }, [campaignId]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tab);
    // Remove pagination params when switching tabs
    newSearchParams.delete('page');
    newSearchParams.delete('category');
    newSearchParams.delete('action');
    setSearchParams(newSearchParams);
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Error Loading Campaign
          </h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Campaign not found (should not happen due to error handling above, but TypeScript guard)
  if (!campaign) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Campaign Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The campaign you're looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Campaign Header */}
      <CampaignHeader
        campaign={campaign}
        roi={roi}
        onDeleteClick={() => setIsDeleteDialogOpen(true)}
      />

      {/* Tab Navigation */}
      <div className="mt-8 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
            aria-current={activeTab === 'overview' ? 'page' : undefined}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('budgets')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'budgets'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
            aria-current={activeTab === 'budgets' ? 'page' : undefined}
          >
            Budgets
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('resources')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'resources'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
            aria-current={activeTab === 'resources' ? 'page' : undefined}
          >
            Resources
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('activities')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'activities'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
            aria-current={activeTab === 'activities' ? 'page' : undefined}
          >
            Activities
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Budget Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Budget
                </h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                  {campaign.budgetTotal ? `¥${parseFloat(campaign.budgetTotal).toLocaleString()}` : 'N/A'}
                </p>
              </div>

              {/* Total Activities Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Activities
                </h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                  {roi?.activityCount || 0}
                </p>
              </div>

              {/* ROI Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  ROI
                </h3>
                <p className={`mt-2 text-3xl font-semibold ${
                  roi && roi.roi !== null && roi.roi > 0
                    ? 'text-green-600 dark:text-green-400'
                    : roi && roi.roi !== null && roi.roi < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {roi && roi.roi !== null ? `${roi.roi.toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Campaign Description */}
            {campaign.attributes && typeof campaign.attributes['description'] === 'string' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {campaign.attributes['description'] as string}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'budgets' && campaignId && <BudgetTable campaignId={campaignId} />}

        {activeTab === 'resources' && campaignId && <ResourceTable campaignId={campaignId} />}

        {activeTab === 'activities' && campaignId && <CampaignActivityTable campaignId={campaignId} />}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteCampaignDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        campaign={{
          campaignId: campaign.campaignId,
          name: campaign.name,
        }}
      />
    </div>
  );
}
