/**
 * Campaign Form Component (Reusable for Add/Edit)
 *
 * Features:
 * - Input fields for campaign data (name, channel, dates, budget)
 * - Client-side validation with Zod
 * - Field-level error message display
 * - Submit/Cancel buttons with loading state
 * - Dark mode support
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <CampaignForm
 *   initialData={{ name: 'Existing Campaign', ... }}  // For edit mode
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 */

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Icon } from '@iconify/react';
import {
  campaignFormSchema,
  type CampaignFormData,
} from '~/schemas/campaign.schema';

/**
 * Component props
 */
interface CampaignFormProps {
  /** Initial form values (undefined for add mode, populated for edit mode) */
  initialData?: Partial<CampaignFormData>;
  /** Form submission handler (receives validated data) */
  onSubmit: (data: CampaignFormData) => Promise<void>;
  /** Cancel button click handler */
  onCancel: () => void;
  /** Submission state (disables form when true) */
  isSubmitting: boolean;
}

/**
 * Campaign Form Component
 *
 * Handles form state, validation, and user interactions.
 * Provides accessible and user-friendly input experience.
 */
export function CampaignForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: CampaignFormProps) {
  // Form field state
  const [formData, setFormData] = useState<Partial<CampaignFormData>>({
    name: initialData?.name ?? '',
    channel: initialData?.channel ?? '',
    startDate: initialData?.startDate ?? '',
    endDate: initialData?.endDate ?? '',
    budgetTotal: initialData?.budgetTotal ?? '',
  });

  // Field-level error messages (key: field name, value: error message)
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Handle form field changes
   *
   * Updates form state and clears error for the changed field.
   *
   * @param field - Field name
   * @param value - New field value
   */
  const handleChange = (field: keyof CampaignFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field when user starts typing
    if (errors && field in errors) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Prevent default form submission
   * 2. Validate form data with Zod schema
   * 3. Call onSubmit handler with validated data
   * 4. Display field-level errors if validation fails
   *
   * @param e - Form submit event
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    try {
      // Validate form data with Zod schema
      const validatedData = campaignFormSchema.parse(formData);

      // Call parent's submit handler
      await onSubmit(validatedData);
    } catch (error) {
      // Handle validation errors (Zod throws ZodError on validation failure)
      const fieldErrors: Record<string, string> = {};

      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as { issues: Array<{ path: Array<string | number>; message: string }> };

        zodError.issues.forEach((issue: { path: Array<string | number>; message: string }) => {
          if (issue.path.length > 0) {
            const field = String(issue.path[0]);
            fieldErrors[field] = issue.message;
          }
        });
      }

      setErrors(fieldErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="campaign-form max-w-2xl">
      {/* Name field (required) */}
      <div className="form-field mb-6">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleChange('name', e.target.value)
          }
          disabled={isSubmitting}
          aria-invalid={!!errors['name']}
          aria-describedby={errors['name'] ? 'name-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-white ${
            errors['name']
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="e.g., DevRel Summit 2024"
        />
        {errors['name'] && (
          <p
            id="name-error"
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
          >
            <Icon icon="mdi:alert-circle" className="w-4 h-4 mr-1" />
            {errors['name']}
          </p>
        )}
      </div>

      {/* Channel field (optional) */}
      <div className="form-field mb-6">
        <label
          htmlFor="channel"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Channel
        </label>
        <input
          type="text"
          id="channel"
          value={formData.channel || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleChange('channel', e.target.value)
          }
          disabled={isSubmitting}
          aria-invalid={!!errors['channel']}
          aria-describedby={errors['channel'] ? 'channel-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-white ${
            errors['channel']
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="e.g., event, ad, content, community"
        />
        {errors['channel'] && (
          <p
            id="channel-error"
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
          >
            <Icon icon="mdi:alert-circle" className="w-4 h-4 mr-1" />
            {errors['channel']}
          </p>
        )}
      </div>

      {/* Date fields (startDate, endDate) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Start date field */}
        <div className="form-field">
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={formData.startDate || ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('startDate', e.target.value)
            }
            disabled={isSubmitting}
            aria-invalid={!!errors['startDate']}
            aria-describedby={errors['startDate'] ? 'startDate-error' : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-white ${
              errors['startDate']
                ? 'border-red-500 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors['startDate'] && (
            <p
              id="startDate-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
            >
              <Icon icon="mdi:alert-circle" className="w-4 h-4 mr-1" />
              {errors['startDate']}
            </p>
          )}
        </div>

        {/* End date field */}
        <div className="form-field">
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={formData.endDate || ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('endDate', e.target.value)
            }
            disabled={isSubmitting}
            aria-invalid={!!errors['endDate']}
            aria-describedby={errors['endDate'] ? 'endDate-error' : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-white ${
              errors['endDate']
                ? 'border-red-500 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors['endDate'] && (
            <p
              id="endDate-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
            >
              <Icon icon="mdi:alert-circle" className="w-4 h-4 mr-1" />
              {errors['endDate']}
            </p>
          )}
        </div>
      </div>

      {/* Budget total field (optional) */}
      <div className="form-field mb-6">
        <label
          htmlFor="budgetTotal"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Total Budget (JPY)
        </label>
        <input
          type="text"
          id="budgetTotal"
          value={formData.budgetTotal || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleChange('budgetTotal', e.target.value)
          }
          disabled={isSubmitting}
          aria-invalid={!!errors['budgetTotal']}
          aria-describedby={errors['budgetTotal'] ? 'budgetTotal-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-white ${
            errors['budgetTotal']
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="e.g., 100000 or 100000.50"
        />
        {errors['budgetTotal'] && (
          <p
            id="budgetTotal-error"
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
          >
            <Icon icon="mdi:alert-circle" className="w-4 h-4 mr-1" />
            {errors['budgetTotal']}
          </p>
        )}
      </div>

      {/* Form actions (Cancel, Submit) */}
      <div className="form-actions flex gap-4 mt-8">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSubmitting ? (
            <>
              <Icon
                icon="mdi:loading"
                className="w-5 h-5 mr-2 animate-spin"
              />
              Creating...
            </>
          ) : (
            <>
              <Icon icon="mdi:check" className="w-5 h-5 mr-2" />
              Create
            </>
          )}
        </button>
      </div>
    </form>
  );
}
