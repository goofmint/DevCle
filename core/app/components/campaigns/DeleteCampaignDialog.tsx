/**
 * Delete Campaign Confirmation Dialog
 *
 * Displays a confirmation dialog before deleting a campaign.
 * Features:
 * - Display campaign name and deletion warning
 * - Call DELETE API on confirmation
 * - Navigate to campaigns list on success
 * - Display error messages if deletion fails
 * - Show loading state during deletion
 *
 * CASCADE deletion behavior (server-side):
 * - budgets table: All records with matching campaignId are deleted
 * - resources table: campaignId column is set to NULL (orphaned)
 */

import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { Dialog } from '~/components/ui/Dialog';
import { Icon } from '@iconify/react';

/**
 * Props for DeleteCampaignDialog component
 */
export interface DeleteCampaignDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  /**
   * Callback fired when the dialog should be closed
   */
  onClose: () => void;
  /**
   * Campaign to delete
   */
  campaign: {
    /**
     * Campaign ID (UUID)
     */
    campaignId: string;
    /**
     * Campaign name (for display in confirmation message)
     */
    name: string;
  };
  /**
   * Optional success callback (called before navigation)
   */
  onSuccess?: () => void;
}

/**
 * Delete Campaign Confirmation Dialog
 *
 * Displays a warning message and requires user confirmation before deleting a campaign.
 * On successful deletion, navigates to the campaigns list page.
 */
export function DeleteCampaignDialog({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}: DeleteCampaignDialogProps): JSX.Element {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle campaign deletion
   *
   * Calls DELETE /api/campaigns/:id and navigates to campaigns list on success.
   * Displays error message if deletion fails.
   */
  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaign.campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 404) {
          setError('Campaign not found');
        } else if (response.status === 401) {
          setError('You are not authorized to perform this action');
        } else if (response.status === 403) {
          setError('You do not have permission to delete this campaign');
        } else {
          // Try to parse error message from response
          try {
            const errorData = await response.json();
            setError(
              errorData.message || 'Failed to delete campaign. Please try again.'
            );
          } catch {
            setError('Failed to delete campaign. Please try again.');
          }
        }
        setIsDeleting(false);
        return;
      }

      // Success: call onSuccess callback (if provided) and navigate to campaigns list
      if (onSuccess) {
        onSuccess();
      }
      navigate('/dashboard/campaigns');
    } catch (err) {
      // Handle network errors
      setError(
        'Network error. Please check your internet connection and try again.'
      );
      setIsDeleting(false);
    }
  };

  /**
   * Handle dialog close
   *
   * Resets error state when dialog closes.
   */
  const handleClose = (): void => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Campaign"
      actions={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 border border-transparent rounded-md hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Icon
                  icon="mdi:loading"
                  className="animate-spin"
                  width={16}
                  height={16}
                />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Warning message */}
        <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <Icon
            icon="mdi:alert"
            className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5"
            width={20}
            height={20}
          />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            You are about to delete the following campaign. This action cannot be
            undone.
          </p>
        </div>

        {/* Campaign name */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {campaign.name}
          </p>
        </div>

        {/* CASCADE deletion warning */}
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <Icon
            icon="mdi:information"
            className="text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5"
            width={20}
            height={20}
          />
          <p className="text-sm text-red-800 dark:text-red-300">
            Related budgets and resources will also be deleted.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <Icon
              icon="mdi:alert-circle"
              className="text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5"
              width={20}
              height={20}
            />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
