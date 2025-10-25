/**
 * Campaign Form Validation Schema (Frontend)
 *
 * Provides client-side validation for campaign forms.
 * Matches the backend CreateCampaignSchema but uses string dates for form inputs.
 *
 * Features:
 * - Type-safe form data with Zod
 * - English error messages
 * - Date range validation (endDate >= startDate)
 * - Reusable for both add and edit forms
 */

import { z } from 'zod';

/**
 * Campaign form data schema
 *
 * Validation rules:
 * - name: required, 1-255 characters
 * - channel: optional, 1-100 characters, null if empty
 * - startDate: optional, YYYY-MM-DD format
 * - endDate: optional, YYYY-MM-DD format, must be >= startDate if both provided
 * - budgetTotal: optional, numeric string (e.g., "100000.50")
 *
 * Note: attributes field is not exposed in the form UI,
 * but can be set programmatically if needed.
 */
export const campaignFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Campaign name is required')
      .max(255, 'Campaign name must be 255 characters or less'),

    channel: z
      .string()
      .max(100, 'Channel must be 100 characters or less')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),

    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),

    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),

    budgetTotal: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Please enter a valid amount (e.g., 100000 or 100000.50)')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
  })
  .refine(
    (data) => {
      // Date range validation: endDate >= startDate (if both provided)
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be on or after the start date',
      path: ['endDate'],
    }
  );

/**
 * TypeScript type inferred from schema
 *
 * Use this type for form state and submission handlers.
 */
export type CampaignFormData = z.infer<typeof campaignFormSchema>;

/**
 * Helper function to convert form data to API request payload
 *
 * Transforms frontend form data to match backend CreateCampaignInput.
 * Adds default values for optional fields.
 *
 * @param formData - Form data from campaignFormSchema
 * @returns API request payload ready for POST /api/campaigns
 */
export function toApiPayload(formData: CampaignFormData): {
  name: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: string | null;
  attributes: Record<string, unknown>;
} {
  return {
    name: formData.name,
    channel: formData.channel ?? null,
    startDate: formData.startDate ?? null,
    endDate: formData.endDate ?? null,
    budgetTotal: formData.budgetTotal ?? null,
    attributes: {},
  };
}
