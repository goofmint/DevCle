/**
 * Campaign Header Component
 *
 * Displays campaign summary information:
 * - Campaign name (h1)
 * - Status badge (active/completed/archived)
 * - Date range
 * - ROI indicator (color-coded: green for positive, red for negative)
 * - Action buttons (Edit, Delete, Archive) - placeholder for future implementation
 *
 * Props:
 * - campaign: Campaign object (fetched from /api/campaigns/:id)
 * - roi: ROI data (fetched from /api/campaigns/:id/roi)
 */

import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Campaign type for header display
 */
interface Campaign {
  campaignId: string;
  name: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: string | null;
  attributes: Record<string, unknown> | null;
}

/**
 * ROI data type
 */
interface ROIData {
  totalCost: string;
  totalValue: string;
  roiPercentage: string | null;
  activityCount: number;
  developerCount: number;
}

/**
 * Props for CampaignHeader component
 */
interface CampaignHeaderProps {
  campaign: Campaign;
  roi?: ROIData | null;
}

/**
 * CampaignHeader Component
 *
 * Renders campaign header with name, metadata, and action buttons.
 * Displays ROI with color indicator (green: positive, red: negative, gray: null).
 */
export function CampaignHeader({ campaign, roi }: CampaignHeaderProps) {
  // Format date to human-readable string (YYYY-MM-DD -> MMM DD, YYYY)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const locale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Determine status from dates (simple logic for now)
  // In future, this could come from campaign.status field if added
  const getStatus = () => {
    const now = new Date();
    const start = campaign.startDate ? new Date(campaign.startDate) : null;
    const end = campaign.endDate ? new Date(campaign.endDate) : null;

    if (!start) return 'draft';
    if (end && end < now) return 'completed';
    if (start > now) return 'scheduled';
    return 'active';
  };

  const status = getStatus();

  // Status badge color mapping
  const statusColors = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    scheduled: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    completed: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <ol className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <li>
            <Link
              to="/dashboard/campaigns"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Campaigns
            </Link>
          </li>
          <li>
            <Icon icon="heroicons:chevron-right" className="w-4 h-4" />
          </li>
          <li className="text-gray-900 dark:text-white font-medium">
            {campaign.name}
          </li>
        </ol>
      </nav>

      {/* Header content */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Campaign Name */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {campaign.name}
          </h1>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Badge */}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[status as keyof typeof statusColors]
              }`}
              data-testid="campaign-status"
            >
              <Icon
                icon={
                  status === 'active'
                    ? 'heroicons:check-circle'
                    : status === 'completed'
                    ? 'heroicons:archive-box'
                    : status === 'scheduled'
                    ? 'heroicons:clock'
                    : 'heroicons:document-text'
                }
                className="w-4 h-4 mr-1"
              />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

            {/* Channel Badge */}
            {campaign.channel && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                <Icon icon="heroicons:megaphone" className="w-4 h-4 mr-1" />
                {campaign.channel}
              </span>
            )}

            {/* Date Range */}
            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <Icon icon="heroicons:calendar" className="w-4 h-4 mr-1" />
              {formatDate(campaign.startDate) || 'Not started'}
              {' ~ '}
              {formatDate(campaign.endDate) || 'Ongoing'}
            </span>

            {/* ROI Indicator */}
            {roi && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  roi.roiPercentage && parseFloat(roi.roiPercentage) > 0
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : roi.roiPercentage && parseFloat(roi.roiPercentage) < 0
                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
                data-testid="campaign-roi"
              >
                <Icon
                  icon={
                    roi.roiPercentage && parseFloat(roi.roiPercentage) > 0
                      ? 'heroicons:arrow-trending-up'
                      : roi.roiPercentage && parseFloat(roi.roiPercentage) < 0
                      ? 'heroicons:arrow-trending-down'
                      : 'heroicons:minus'
                  }
                  className="w-4 h-4 mr-1"
                />
                ROI: {roi.roiPercentage ? `${parseFloat(roi.roiPercentage).toFixed(1)}%` : 'N/A'}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          {/* Edit Button - placeholder for future implementation */}
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            data-testid="campaign-edit-button"
            disabled
            title="Edit functionality coming soon"
          >
            <Icon icon="heroicons:pencil" className="w-4 h-4 mr-2" />
            Edit
          </button>

          {/* Delete Button - placeholder for future implementation */}
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-lg text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            data-testid="campaign-delete-button"
            disabled
            title="Delete functionality coming soon"
          >
            <Icon icon="heroicons:trash" className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
