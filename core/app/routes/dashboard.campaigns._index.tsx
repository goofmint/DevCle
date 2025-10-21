/**
 * Dashboard Campaigns Page
 *
 * Displays campaign list with search, filters, sorting, and pagination.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { requireAuth } from '~/services/auth.service';
import { CampaignList } from '~/components/campaigns/CampaignList';
import { useCampaignFilters } from '~/hooks/useCampaignFilters';
import type { CampaignListItem, Pagination } from '~/components/campaigns/types';

interface LoaderData {
  campaigns: CampaignListItem[];
  pagination: Pagination;
}

/**
 * Fetch campaign list with ROI data
 */
async function fetchCampaignsWithROI(
  request: Request,
  params: URLSearchParams
): Promise<{ campaigns: CampaignListItem[]; total: number }> {
  // Fetch campaigns from API
  const campaignsResponse = await fetch(
    `${new URL(request.url).origin}/api/campaigns?${params.toString()}`,
    {
      headers: { Cookie: request.headers.get('Cookie') || '' },
    }
  );

  if (!campaignsResponse.ok) {
    throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
  }

  const { campaigns, total } = await campaignsResponse.json();

  // Fetch ROI data for each campaign in parallel
  const campaignsWithROI = await Promise.all(
    campaigns.map(async (campaign: CampaignListItem) => {
      try {
        const roiResponse = await fetch(
          `${new URL(request.url).origin}/api/campaigns/${campaign.campaignId}/roi`,
          {
            headers: { Cookie: request.headers.get('Cookie') || '' },
          }
        );

        if (roiResponse.ok) {
          const roiData = await roiResponse.json();
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

  return { campaigns: campaignsWithROI, total };
}

/**
 * Filter campaigns by ROI status (client-side)
 */
function filterByROIStatus(
  campaigns: CampaignListItem[],
  roiStatus: 'positive' | 'negative' | 'neutral' | null
): CampaignListItem[] {
  if (!roiStatus) {
    return campaigns;
  }

  return campaigns.filter((campaign) => {
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

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authentication
  await requireAuth(request);

  // Parse URL parameters
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const channel = url.searchParams.get('channel') || null;
  const roiStatus = url.searchParams.get('roiStatus') as 'positive' | 'negative' | 'neutral' | null;
  const sortBy = (url.searchParams.get('sortBy') || 'name') as
    | 'name'
    | 'startDate'
    | 'endDate'
    | 'roi'
    | 'createdAt';
  const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  // Build API query parameters
  const params = new URLSearchParams({
    search: query,
    orderBy: sortBy,
    orderDirection: sortOrder,
    limit: String(limit),
    offset: String(offset),
  });

  if (channel) {
    params.set('channel', channel);
  }

  try {
    // Fetch campaigns with ROI data
    const { campaigns, total } = await fetchCampaignsWithROI(request, params);

    // Filter by ROI status (client-side filter)
    const filteredCampaigns = filterByROIStatus(campaigns, roiStatus);

    return json<LoaderData>({
      campaigns: filteredCampaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Campaigns loader error:', error);
    throw new Response('Failed to load campaigns', { status: 500 });
  }
}

export default function CampaignsPage() {
  const { campaigns, pagination } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize filters from URL params
  const filters = useCampaignFilters({
    initialQuery: searchParams.get('query') || '',
    initialChannel: searchParams.get('channel') || null,
    initialRoiStatus: searchParams.get('roiStatus') as 'positive' | 'negative' | 'neutral' | null,
    initialSortBy: (searchParams.get('sortBy') ||
      'name') as 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt',
    initialSortOrder: (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc',
  });

  /**
   * Update URL when filters change
   */
  const updateURL = (newParams?: URLSearchParams) => {
    const params = newParams || filters.toSearchParams();
    navigate(`?${params.toString()}`, { replace: true });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage and track your DevRel campaigns
        </p>
      </div>

      <CampaignList
        campaigns={campaigns}
        pagination={pagination}
        viewMode="table"
        query={filters.query}
        channel={filters.channel}
        roiStatus={filters.roiStatus}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onQueryChange={(q) => {
          filters.setQuery(q);
          const params = filters.toSearchParams();
          params.set('query', q);
          updateURL(params);
        }}
        onChannelChange={(c) => {
          filters.setChannel(c);
          const params = filters.toSearchParams();
          if (c) {
            params.set('channel', c);
          } else {
            params.delete('channel');
          }
          updateURL(params);
        }}
        onRoiStatusChange={(r) => {
          filters.setRoiStatus(r);
          const params = filters.toSearchParams();
          if (r) {
            params.set('roiStatus', r);
          } else {
            params.delete('roiStatus');
          }
          updateURL(params);
        }}
        onSortChange={(column) => {
          // Calculate new sort values
          const newSortBy = column;
          const newSortOrder = filters.sortBy === column && filters.sortOrder === 'asc' ? 'desc' : 'asc';

          // Update state
          filters.setSortBy(newSortBy);
          filters.setSortOrder(newSortOrder);

          // Update URL with new values
          const params = filters.toSearchParams();
          params.set('sortBy', newSortBy);
          params.set('sortOrder', newSortOrder);
          updateURL(params);
        }}
        onPageChange={(p) => {
          const params = filters.toSearchParams();
          params.set('page', String(p));
          updateURL(params);
        }}
        onResetFilters={() => {
          filters.resetFilters();
          navigate('/dashboard/campaigns', { replace: true });
        }}
      />
    </div>
  );
}
