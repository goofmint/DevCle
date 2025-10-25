/**
 * Campaign Add Page
 *
 * Route: /dashboard/campaigns/new
 *
 * Provides a form to create a new campaign.
 * Uses CampaignForm component for form UI and validation.
 *
 * Features:
 * - Form validation with Zod
 * - API error handling
 * - Success navigation to campaign detail page
 * - Cancel navigation back to campaigns list
 *
 * Authentication: Required (handled by dashboard layout)
 * Method: Client-side rendering (SPA)
 */

import { useState } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { requireAuth } from '~/auth.middleware';
import { CampaignForm } from '~/components/campaigns/CampaignForm';
import { toApiPayload, type CampaignFormData } from '~/schemas/campaign.schema';

/**
 * Loader function for authentication check
 *
 * This ensures that the route is properly recognized by Remix and
 * takes precedence over the dynamic :id route.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure user is authenticated before allowing access to this page
  await requireAuth(request);
  return json(null);
}

/**
 * Campaign Add Page Component
 *
 * Displays form for creating a new campaign.
 * Handles form submission and API errors.
 */
export default function CampaignAddPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Validate form data (handled by CampaignForm component)
   * 2. Convert form data to API payload
   * 3. Call POST /api/campaigns
   * 4. Navigate to campaign detail page on success
   * 5. Display error message on failure
   *
   * @param data - Validated form data from CampaignForm
   */
  const handleSubmit = async (data: CampaignFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Convert form data to API request payload
      const payload = toApiPayload(data);

      // Call POST /api/campaigns
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Handle API errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error ||
          `Failed to create campaign (status: ${response.status})`;
        throw new Error(errorMessage);
      }

      // Parse success response
      const campaign = await response.json();

      // Navigate to campaign detail page
      navigate(`/dashboard/campaigns/${campaign.campaignId}`);
    } catch (err) {
      // Handle network errors and API errors
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'A network error occurred. Please try again.';
      setError(errorMessage);

      // Log error for debugging
      console.error('Failed to create campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel button click
   *
   * Navigate back to campaigns list page.
   */
  const handleCancel = () => {
    navigate('/dashboard/campaigns');
  };

  return (
    <div className="campaign-add-page">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Icon icon="mdi:plus-circle" className="w-8 h-8 mr-2" />
          Create New Campaign
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter campaign information to create a new campaign.
        </p>
      </div>

      {/* Error banner (display if API error occurs) */}
      {error && (
        <div
          className="error-banner mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <div className="flex items-center">
            <Icon
              icon="mdi:alert-circle"
              className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0"
            />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Campaign form */}
      <CampaignForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
