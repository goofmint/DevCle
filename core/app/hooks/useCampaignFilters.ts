/**
 * useCampaignFilters Hook
 *
 * Manages campaign filter state and synchronizes with URL parameters.
 *
 * Features:
 * - Filter state management (query, channel, ROI status, sort settings)
 * - Bi-directional sync with URL parameters
 * - Filter reset functionality
 */

import { useState, useCallback } from 'react';

interface UseCampaignFiltersOptions {
  /** Initial search query */
  initialQuery?: string;
  /** Initial channel filter */
  initialChannel?: string | null;
  /** Initial ROI status filter */
  initialRoiStatus?: 'positive' | 'negative' | 'neutral' | null;
  /** Initial sort column */
  initialSortBy?: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  /** Initial sort order */
  initialSortOrder?: 'asc' | 'desc';
}

interface UseCampaignFiltersReturn {
  /** Search query */
  query: string;
  /** Channel filter */
  channel: string | null;
  /** ROI status filter */
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  /** Sort column */
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  /** Sort order */
  sortOrder: 'asc' | 'desc';
  /** Update search query */
  setQuery: (query: string) => void;
  /** Update channel filter */
  setChannel: (channel: string | null) => void;
  /** Update ROI status filter */
  setRoiStatus: (roiStatus: 'positive' | 'negative' | 'neutral' | null) => void;
  /** Update sort column */
  setSortBy: (sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
  /** Update sort order */
  setSortOrder: (order: 'asc' | 'desc') => void;
  /** Toggle sort order for a column (if already sorting by this column, toggle order) */
  toggleSort: (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
  /** Reset all filters to initial state */
  resetFilters: () => void;
  /** Generate URLSearchParams from current filter state */
  toSearchParams: () => URLSearchParams;
}

export function useCampaignFilters(options?: UseCampaignFiltersOptions): UseCampaignFiltersReturn {
  const [query, setQuery] = useState(options?.initialQuery ?? '');
  const [channel, setChannel] = useState<string | null>(options?.initialChannel ?? null);
  const [roiStatus, setRoiStatus] = useState<'positive' | 'negative' | 'neutral' | null>(
    options?.initialRoiStatus ?? null
  );
  const [sortBy, setSortBy] = useState<'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt'>(
    options?.initialSortBy ?? 'name'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(options?.initialSortOrder ?? 'asc');

  /**
   * Toggle sort order for a column
   * If already sorting by this column, toggle order. Otherwise, sort by this column in ascending order.
   */
  const toggleSort = useCallback(
    (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => {
      if (sortBy === column) {
        // Toggle order if already sorting by this column
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        // Sort by new column in ascending order
        setSortBy(column);
        setSortOrder('asc');
      }
    },
    [sortBy]
  );

  /**
   * Reset all filters to initial state
   */
  const resetFilters = useCallback(() => {
    setQuery('');
    setChannel(null);
    setRoiStatus(null);
    setSortBy('name');
    setSortOrder('asc');
  }, []);

  /**
   * Generate URLSearchParams from current filter state
   */
  const toSearchParams = useCallback(() => {
    const params = new URLSearchParams();

    if (query) {
      params.set('query', query);
    }
    if (channel) {
      params.set('channel', channel);
    }
    if (roiStatus) {
      params.set('roiStatus', roiStatus);
    }
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    return params;
  }, [query, channel, roiStatus, sortBy, sortOrder]);

  return {
    query,
    channel,
    roiStatus,
    sortBy,
    sortOrder,
    setQuery,
    setChannel,
    setRoiStatus,
    setSortBy,
    setSortOrder,
    toggleSort,
    resetFilters,
    toSearchParams,
  };
}
