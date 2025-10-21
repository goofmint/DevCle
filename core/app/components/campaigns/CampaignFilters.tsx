/**
 * CampaignFilters Component
 *
 * Provides search and filter UI for campaign list.
 * Features:
 * - Search box (with debounce)
 * - Channel filter dropdown
 * - ROI status filter dropdown
 * - Reset button
 */

import { Icon } from '@iconify/react';

interface CampaignFiltersProps {
  query: string;
  channel: string | null;
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  onQueryChange: (query: string) => void;
  onChannelChange: (channel: string | null) => void;
  onRoiStatusChange: (roiStatus: 'positive' | 'negative' | 'neutral' | null) => void;
  onReset: () => void;
}

export function CampaignFilters({
  query,
  channel,
  roiStatus,
  onQueryChange,
  onChannelChange,
  onRoiStatusChange,
  onReset,
}: CampaignFiltersProps) {
  return (
    <div
      className="flex flex-col sm:flex-row gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      data-testid="campaign-filters"
    >
      {/* Search input */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon
              icon="heroicons:magnifying-glass"
              className="w-5 h-5 text-gray-400 dark:text-gray-500"
            />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search campaigns..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            data-testid="search-input"
          />
        </div>
      </div>

      {/* Channel filter */}
      <div className="sm:w-48">
        <select
          value={channel ?? ''}
          onChange={(e) => onChannelChange(e.target.value || null)}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          data-testid="channel-filter"
        >
          <option value="">All Channels</option>
          <option value="event">Event</option>
          <option value="ad">Ad</option>
          <option value="content">Content</option>
          <option value="community">Community</option>
          <option value="partnership">Partnership</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* ROI status filter */}
      <div className="sm:w-48">
        <select
          value={roiStatus ?? ''}
          onChange={(e) => {
            const value = e.target.value as 'positive' | 'negative' | 'neutral' | '';
            onRoiStatusChange(value === '' ? null : value);
          }}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          data-testid="roi-filter"
        >
          <option value="">All ROI Status</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
        data-testid="reset-button"
      >
        <Icon icon="heroicons:arrow-path" className="w-5 h-5" />
      </button>
    </div>
  );
}
