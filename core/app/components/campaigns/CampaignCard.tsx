/**
 * CampaignCard Component
 *
 * Displays campaign information in card format.
 * Optimized for mobile and tablet responsive displays.
 */

import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { ROIBadge } from './ROIBadge';
import type { CampaignListItem } from './types';

interface CampaignCardProps {
  campaign: CampaignListItem;
}

/**
 * Get channel icon name for Iconify
 */
function getChannelIcon(channel: string | null): string {
  switch (channel) {
    case 'event':
      return 'heroicons:calendar-days';
    case 'ad':
      return 'heroicons:megaphone';
    case 'content':
      return 'heroicons:document-text';
    case 'community':
      return 'heroicons:user-group';
    case 'partnership':
      return 'heroicons:hand-raised';
    case 'other':
      return 'heroicons:ellipsis-horizontal-circle';
    default:
      return 'heroicons:question-mark-circle';
  }
}

/**
 * Format date range for display
 * Examples:
 * - "2025-03-01 ~ 2025-03-03"
 * - "No dates"
 */
function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) {
    return 'No dates';
  }
  if (startDate && endDate) {
    return `${startDate} ~ ${endDate}`;
  }
  if (startDate) {
    return `From ${startDate}`;
  }
  return `Until ${endDate}`;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const dateRange = formatDateRange(campaign.startDate, campaign.endDate);
  const channelIcon = getChannelIcon(campaign.channel);

  return (
    <Link
      to={`/dashboard/campaigns/${campaign.campaignId}`}
      className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all"
      data-testid="campaign-card"
    >
      {/* Header with channel icon and name */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon
            icon={channelIcon}
            className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5"
          />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words">
            {campaign.name}
          </h3>
        </div>
        <ROIBadge roi={campaign.roi ?? null} size="sm" />
      </div>

      {/* Channel badge */}
      {campaign.channel && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {campaign.channel}
          </span>
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
        <Icon icon="heroicons:calendar" className="w-4 h-4" />
        <span>{dateRange}</span>
      </div>

      {/* Activity and developer counts */}
      {(campaign.activityCount !== undefined || campaign.developerCount !== undefined) && (
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
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
      )}
    </Link>
  );
}
