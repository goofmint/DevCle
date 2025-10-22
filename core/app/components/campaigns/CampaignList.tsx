/**
 * Campaign List Component
 *
 * Main container component for campaign list page.
 * Integrates filters, table view, and pagination.
 * Fetches data client-side via API on filter changes (no page reload).
 */

import { useState } from 'react';
import { CampaignFilters } from './CampaignFilters';
import { CampaignTable } from './CampaignTable';
import { Pagination } from './Pagination';
import type { CampaignListItem } from './types';

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
 * Filter values
 */
interface FilterValues {
  query: string;
  channel: string | null;
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

/**
 * Props for CampaignList component
 */
interface CampaignListProps {
  /** Initial list of campaigns to display */
  initialCampaigns: CampaignListItem[];
  /** Initial pagination info */
  initialPagination: PaginationInfo;
  /** Initial filter values from URL params */
  initialFilters: FilterValues;
  /** View mode (table or card), defaults to table */
  viewMode?: 'table' | 'card';
}

/**
 * CampaignList Component
 *
 * Renders campaign list with filters, sorting, and pagination.
 * Fetches data via API on filter changes (no page reload).
 */
export function CampaignList({
  initialCampaigns,
  initialPagination,
  initialFilters,
  viewMode = 'table',
}: CampaignListProps) {
  // Component state
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>(initialCampaigns);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  // Fetch campaigns from API
  const fetchCampaigns = async (newFilters: FilterValues, page: number = 1, updateHistory: boolean = true) => {
    try {
      const params = new URLSearchParams({
        search: newFilters.query,
        orderBy: newFilters.sortBy,
        orderDirection: newFilters.sortOrder,
        limit: String(pagination.limit),
        offset: String((page - 1) * pagination.limit),
      });

      if (newFilters.channel) {
        params.set('channel', newFilters.channel);
      }

      // Update browser history (for back/forward navigation)
      if (updateHistory) {
        const urlParams = new URLSearchParams();
        if (newFilters.query) urlParams.set('query', newFilters.query);
        if (newFilters.channel) urlParams.set('channel', newFilters.channel);
        if (newFilters.roiStatus) urlParams.set('roiStatus', newFilters.roiStatus);
        if (newFilters.sortBy !== 'name') urlParams.set('sortBy', newFilters.sortBy);
        if (newFilters.sortOrder !== 'asc') urlParams.set('sortOrder', newFilters.sortOrder);
        if (page > 1) urlParams.set('page', String(page));

        const newUrl = urlParams.toString() ? `?${urlParams.toString()}` : window.location.pathname;
        window.history.pushState({}, '', newUrl);
      }

      // Fetch campaigns
      const campaignsRes = await fetch(`/api/campaigns?${params.toString()}`);
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
      if (newFilters.roiStatus) {
        filteredCampaigns = campaignsWithROI.filter((campaign) => {
          if (newFilters.roiStatus === 'positive') {
            return campaign.roi !== null && campaign.roi !== undefined && campaign.roi > 0;
          }
          if (newFilters.roiStatus === 'negative') {
            return campaign.roi !== null && campaign.roi !== undefined && campaign.roi < 0;
          }
          if (newFilters.roiStatus === 'neutral') {
            return campaign.roi === null || campaign.roi === undefined || campaign.roi === 0;
          }
          return true;
        });
      }

      setCampaigns(filteredCampaigns);
      setPagination({
        page,
        limit: pagination.limit,
        total: filteredCampaigns.length > 0 ? total : 0,
        totalPages: Math.ceil(total / pagination.limit),
      });
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  };

  // Handle query change after debounce (called after user stops typing)
  const handleQueryChange = (query: string) => {
    const newFilters = { ...filters, query };
    setFilters(newFilters);
    // Update history after debounce (not during typing)
    fetchCampaigns(newFilters, 1, true);
  };

  const handleChannelChange = (channel: string | null) => {
    const newFilters = { ...filters, channel };
    setFilters(newFilters);
    fetchCampaigns(newFilters);
  };

  const handleRoiStatusChange = (roiStatus: 'positive' | 'negative' | 'neutral' | null) => {
    const newFilters = { ...filters, roiStatus };
    setFilters(newFilters);
    fetchCampaigns(newFilters);
  };

  const handleReset = () => {
    const resetFilters: FilterValues = {
      query: '',
      channel: null,
      roiStatus: null,
      sortBy: 'name',
      sortOrder: 'asc',
    };
    setFilters(resetFilters);
    fetchCampaigns(resetFilters);
  };

  // Handle sort column click
  const handleSort = (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => {
    const newSortOrder: 'asc' | 'desc' =
      filters.sortBy === column && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    const newFilters: FilterValues = { ...filters, sortBy: column, sortOrder: newSortOrder };
    setFilters(newFilters);
    fetchCampaigns(newFilters);
  };

  return (
    <div data-testid="campaign-list">
      {/* Filters */}
      <CampaignFilters
        query={filters.query}
        channel={filters.channel}
        roiStatus={filters.roiStatus}
        onQueryChange={handleQueryChange}
        onChannelChange={handleChannelChange}
        onRoiStatusChange={handleRoiStatusChange}
        onReset={handleReset}
      />

      {/* Table view */}
      <div className="mt-6">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <CampaignTable
            campaigns={campaigns}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={handleSort}
          />
        </div>
      </div>

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
