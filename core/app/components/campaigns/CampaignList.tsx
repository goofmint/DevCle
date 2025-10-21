/**
 * CampaignList Component
 *
 * Container component that displays campaign list with filters and pagination.
 * Switches between table and card view based on viewMode prop.
 */

import { useState } from 'react';
import { CampaignTable } from './CampaignTable';
import { CampaignCard } from './CampaignCard';
import { CampaignFilters } from './CampaignFilters';
import { Pagination } from './Pagination';
import type { CampaignListItem, Pagination as PaginationType } from './types';

interface CampaignListProps {
  campaigns: CampaignListItem[];
  pagination: PaginationType;
  viewMode?: 'table' | 'card';
  query: string;
  channel: string | null;
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  onQueryChange: (query: string) => void;
  onChannelChange: (channel: string | null) => void;
  onRoiStatusChange: (roiStatus: 'positive' | 'negative' | 'neutral' | null) => void;
  onSortChange: (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
  onPageChange: (page: number) => void;
  onResetFilters: () => void;
}

export function CampaignList({
  campaigns,
  pagination,
  viewMode = 'table',
  query,
  channel,
  roiStatus,
  sortBy,
  sortOrder,
  onQueryChange,
  onChannelChange,
  onRoiStatusChange,
  onSortChange,
  onPageChange,
  onResetFilters,
}: CampaignListProps) {
  // Responsive view mode (use card view on small screens)
  const [isSmallScreen] = useState(false); // TODO: Add responsive detection if needed

  const effectiveViewMode = isSmallScreen ? 'card' : viewMode;

  return (
    <div className="space-y-6" data-testid="campaign-list">
      {/* Filters */}
      <CampaignFilters
        query={query}
        channel={channel}
        roiStatus={roiStatus}
        onQueryChange={onQueryChange}
        onChannelChange={onChannelChange}
        onRoiStatusChange={onRoiStatusChange}
        onReset={onResetFilters}
      />

      {/* Campaign list */}
      {effectiveViewMode === 'table' ? (
        <CampaignTable
          campaigns={campaigns}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSortChange}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No campaigns found
            </div>
          ) : (
            campaigns.map((campaign) => (
              <CampaignCard key={campaign.campaignId} campaign={campaign} />
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
