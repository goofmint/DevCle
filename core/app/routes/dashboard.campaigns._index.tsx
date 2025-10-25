/**
 * Dashboard Campaigns Page
 *
 * Route: /dashboard/campaigns
 *
 * Displays paginated list of campaigns with search and filter functionality.
 * Supports table view with filters.
 *
 * Note: Uses SPA pattern - fetches data client-side via API calls.
 */

import { useSearchParams, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { CampaignList } from '~/components/campaigns/CampaignList';
import type { CampaignListItem } from '~/components/campaigns/types';

/**
 * Pagination info
 */
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Campaigns Page Component
 *
 * Fetches campaigns via API calls.
 * Manages loading and error states.
 */
export default function CampaignsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Extract filter values from URL params
  const query = searchParams.get('query') || '';
  const channel = searchParams.get('channel') || null;
  const roiStatus = searchParams.get('roiStatus') as 'positive' | 'negative' | 'neutral' | null;
  const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
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
          search: query,
          orderBy: sortBy,
          orderDirection: sortOrder,
          limit: String(limit),
          offset: String((page - 1) * limit),
        });

        if (channel) {
          apiParams.set('channel', channel);
        }

        // Fetch campaigns
        const campaignsRes = await fetch(`/api/campaigns?${apiParams.toString()}`);
        if (!campaignsRes.ok) {
          throw new Error(`Failed to fetch campaigns: ${campaignsRes.status}`);
        }
        const { campaigns: fetchedCampaigns, total } = await campaignsRes.json();

        // Fetch ROI data for each campaign
        const campaignsWithROI = await Promise.all(
          fetchedCampaigns.map(async (campaign: CampaignListItem) => {
            try {
              const roiRes = await fetch(`/api/campaigns/${campaign.campaignId}/roi`);
              if (roiRes.ok) {
                const roiData = await roiRes.json();
                return {
                  ...campaign,
                  roi: roiData.roi,
                  activityCount: roiData.activityCount,
                  developerCount: roiData.developerCount,
                };
              }
            } catch (error) {
              console.error(`Failed to fetch ROI for campaign ${campaign.campaignId}:`, error);
            }
            return campaign;
          })
        );

        // Filter by ROI status (client-side)
        let filteredCampaigns = campaignsWithROI;
        if (roiStatus) {
          filteredCampaigns = campaignsWithROI.filter((campaign) => {
            if (roiStatus === 'positive') {
              return campaign.roi !== null && campaign.roi !== undefined && campaign.roi > 0;
            }
            if (roiStatus === 'negative') {
              return campaign.roi !== null && campaign.roi !== undefined && campaign.roi < 0;
            }
            if (roiStatus === 'neutral') {
              return campaign.roi === null || campaign.roi === undefined || campaign.roi === 0;
            }
            return true;
          });
        }

        setCampaigns(filteredCampaigns);
        setPagination({
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        });
      } catch (err) {
        console.error('Failed to fetch campaigns:', err);
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [query, channel, roiStatus, sortBy, sortOrder, page, limit]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Campaigns
          </h1>
          <button
            onClick={() => navigate('/dashboard/campaigns/new')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Icon icon="mdi:plus" className="w-5 h-5 mr-2" />
            新規作成
          </button>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Campaigns
          </h1>
          <button
            onClick={() => navigate('/dashboard/campaigns/new')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Icon icon="mdi:plus" className="w-5 h-5 mr-2" />
            新規作成
          </button>
        </div>
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Campaigns
        </h1>
        <button
          onClick={() => navigate('/dashboard/campaigns/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Icon icon="mdi:plus" className="w-5 h-5 mr-2" />
          New Campaign
        </button>
      </div>

      <CampaignList
        initialCampaigns={campaigns}
        initialPagination={pagination}
        initialFilters={{
          query,
          channel,
          roiStatus,
          sortBy,
          sortOrder,
        }}
        viewMode="table"
      />
    </div>
  );
}
