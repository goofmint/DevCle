/**
 * Campaign Edit Page
 *
 * Route: /dashboard/campaigns/:id/edit
 *
 * Provides a form to edit an existing campaign.
 * Uses CampaignForm component for form UI and validation.
 *
 * Features:
 * - Load existing campaign data from API
 * - Form validation with Zod
 * - API error handling (404, 401, 500)
 * - Success navigation to campaign detail page
 * - Cancel navigation back to campaign detail page
 * - Loading state display
 *
 * Authentication: Required (handled by dashboard layout)
 * Method: Client-side rendering (SPA)
 */

import { useState, useEffect } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useNavigate, useParams } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { requireAuth } from '~/auth.middleware';
import { CampaignForm } from '~/components/campaigns/CampaignForm';
import { toApiPayload, type CampaignFormData } from '~/schemas/campaign.schema';

/**
 * Campaign API response type
 */
interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Loader function for authentication check
 *
 * Ensures user is authenticated before allowing access to this page.
 * Actual campaign data is loaded client-side via useEffect.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure user is authenticated before allowing access to this page
  await requireAuth(request);
  return json(null);
}

/**
 * Campaign Edit Page Component
 *
 * Displays form for editing an existing campaign.
 * Handles data loading, form submission, and API errors.
 */
export default function CampaignEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Component state
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load existing campaign data on component mount
   *
   * Steps:
   * 1. Call GET /api/campaigns/:id
   * 2. Set campaign state with response data
   * 3. Handle errors (404, 401, network errors)
   * 4. Set loading state to false
   */
  useEffect(() => {
    const loadCampaign = async () => {
      if (!id) {
        setError('Campaign ID is missing');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Call GET /api/campaigns/:id
        const response = await fetch(`/api/campaigns/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Handle API errors
        if (!response.ok) {
          if (response.status === 404) {
            setError('Campaign not found');
            setCampaign(null);
            setIsLoading(false);
            return;
          }

          if (response.status === 401) {
            // Redirect to login (this should be handled by auth middleware)
            navigate('/login');
            return;
          }

          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error ||
            `Failed to load campaign (status: ${response.status})`;
          throw new Error(errorMessage);
        }

        // Parse success response
        const data = await response.json();
        setCampaign(data);
      } catch (err) {
        // Handle network errors and API errors
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'A network error occurred. Please try again.';
        setError(errorMessage);

        // Log error for debugging
        console.error('Failed to load campaign:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCampaign();
  }, [id, navigate]);

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Validate form data (handled by CampaignForm component)
   * 2. Convert form data to API payload
   * 3. Call PUT /api/campaigns/:id
   * 4. Navigate to campaign detail page on success
   * 5. Display error message on failure
   *
   * @param data - Validated form data from CampaignForm
   */
  const handleSubmit = async (data: CampaignFormData) => {
    if (!id) {
      setError('Campaign ID is missing');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Convert form data to API request payload
      const payload = toApiPayload(data);

      // Call PUT /api/campaigns/:id
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
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
          `Failed to update campaign (status: ${response.status})`;
        throw new Error(errorMessage);
      }

      // Parse success response
      const updatedCampaign = await response.json();

      // Navigate to campaign detail page
      navigate(`/dashboard/campaigns/${updatedCampaign.campaignId}`);
    } catch (err) {
      // Handle network errors and API errors
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'A network error occurred. Please try again.';
      setError(errorMessage);

      // Log error for debugging
      console.error('Failed to update campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel button click
   *
   * Navigate back to campaign detail page.
   */
  const handleCancel = () => {
    if (id) {
      navigate(`/dashboard/campaigns/${id}`);
    } else {
      navigate('/dashboard/campaigns');
    }
  };

  // Loading state: Display spinner while fetching campaign data
  if (isLoading) {
    return (
      <div className="campaign-edit-page">
        <div className="loading-spinner flex items-center justify-center py-12">
          <Icon
            icon="mdi:loading"
            className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin"
          />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading campaign...
          </span>
        </div>
      </div>
    );
  }

  // Error state: Display error message if campaign not found or load failed
  if (!campaign) {
    return (
      <div className="campaign-edit-page">
        <div
          className="error-message p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <div className="flex items-center">
            <Icon
              icon="mdi:alert-circle"
              className="w-6 h-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0"
            />
            <div>
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
                {error || 'Campaign not found'}
              </h2>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                The campaign you are looking for does not exist or you do not
                have permission to edit it.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/campaigns')}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Go to Campaigns List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-edit-page">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Icon icon="mdi:pencil" className="w-8 h-8 mr-2" />
          Edit Campaign
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update campaign information for <strong>{campaign.name}</strong>.
        </p>
      </div>

      {/* Error banner (display if API error occurs during submission) */}
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

      {/* Campaign form (pre-filled with existing data) */}
      <CampaignForm
        initialData={{
          name: campaign.name,
          channel: campaign.channel ?? '',
          startDate: campaign.startDate ?? '',
          endDate: campaign.endDate ?? '',
          budgetTotal: campaign.budgetTotal ?? '',
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
