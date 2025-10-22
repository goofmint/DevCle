/**
 * CampaignTable Component
 *
 * Displays campaign list in table format with sortable columns.
 * Optimized for desktop displays.
 */

import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { ROIBadge } from './ROIBadge';
import type { CampaignListItem } from './types';

interface CampaignTableProps {
  campaigns: CampaignListItem[];
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
}

/**
 * Format date range for table display
 */
function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '—';
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `From ${startDate}`;
  return `Until ${endDate}`;
}

/**
 * SortableHeader component for column headers
 */
interface SortableHeaderProps {
  column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  label: string;
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
}

function SortableHeader({ column, label, sortBy, sortOrder, onSort }: SortableHeaderProps) {
  const isSorted = sortBy === column;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      data-testid={`sort-${column}`}
    >
      {label}
      {isSorted && (
        <Icon
          icon={sortOrder === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'}
          className="w-4 h-4"
        />
      )}
    </button>
  );
}

export function CampaignTable({ campaigns, sortBy, sortOrder, onSort }: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div
        className="text-center py-12 text-gray-500 dark:text-gray-400"
        data-testid="empty-campaigns"
      >
        <Icon icon="heroicons:inbox" className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No campaigns found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="campaign-table">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs">
              <SortableHeader
                column="name"
                label="Name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Channel</span>
            </th>
            <th className="px-6 py-3 text-left text-xs">
              <SortableHeader
                column="startDate"
                label="Period"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs">
              <SortableHeader
                column="roi"
                label="ROI"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Stats</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {campaigns.map((campaign) => (
            <tr
              key={campaign.campaignId}
              className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              data-testid="campaign-row"
            >
              <td className="px-6 py-4">
                <Link
                  to={`/dashboard/campaigns/${campaign.campaignId}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {campaign.name}
                </Link>
              </td>
              <td className="px-6 py-4">
                {campaign.channel ? (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {campaign.channel}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {formatDateRange(campaign.startDate, campaign.endDate)}
              </td>
              <td className="px-6 py-4">
                <ROIBadge roi={campaign.roi ?? null} size="sm" />
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex flex-col gap-1">
                  {campaign.activityCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <Icon icon="heroicons:bolt" className="w-4 h-4" />
                      <span>{campaign.activityCount} activities</span>
                    </div>
                  )}
                  {campaign.developerCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <Icon icon="heroicons:user-group" className="w-4 h-4" />
                      <span>{campaign.developerCount} developers</span>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
