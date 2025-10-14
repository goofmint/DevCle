/**
 * Campaign Service - Zod Schemas
 *
 * Validation schemas for campaign operations.
 * All schemas validate input data before database operations.
 */

import { z } from 'zod';

/**
 * Zod schema for creating a new campaign
 *
 * Validates input data before database insertion.
 * All fields must match the database schema constraints.
 *
 * Date range validation: startDate <= endDate
 */
export const CreateCampaignSchema = z
  .object({
    name: z.string().min(1).max(255),
    channel: z.string().min(1).max(100).nullable(),
    startDate: z.coerce.date().nullable(),
    endDate: z.coerce.date().nullable(),
    budgetTotal: z.string().nullable(), // numeric type is handled as string for precision
    attributes: z.record(z.string(), z.any()).default({}),
  })
  .refine(
    (data) => {
      // Date range validation: startDate <= endDate
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'startDate must be on or before endDate' }
  );

/**
 * Input type for createCampaign (raw/unvalidated data)
 *
 * This type represents data BEFORE validation.
 * Callers pass raw input, and the service validates it.
 */
export type CreateCampaignInput = z.input<typeof CreateCampaignSchema>;

/**
 * Output type after validation (defaults applied)
 *
 * This type represents data AFTER validation.
 * Used internally after calling schema.parse().
 */
export type CreateCampaignData = z.infer<typeof CreateCampaignSchema>;

/**
 * Zod schema for listing campaigns with pagination and sorting
 */
export const ListCampaignsSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  channel: z.string().optional(), // Filter by channel (exact match)
  search: z.string().optional(), // Search in name (partial match, case-insensitive)
  orderBy: z
    .enum(['name', 'startDate', 'endDate', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Input type for listCampaigns (raw/unvalidated data)
 *
 * This type represents data BEFORE validation.
 * Callers pass raw input, and the service validates it.
 */
export type ListCampaignsInput = z.input<typeof ListCampaignsSchema>;

/**
 * Output type after validation (defaults applied)
 *
 * This type represents data AFTER validation.
 * Used internally after calling schema.parse().
 */
export type ListCampaignsParams = z.infer<typeof ListCampaignsSchema>;

/**
 * Zod schema for updating a campaign
 *
 * All fields are optional (partial update support)
 * Date range validation: startDate <= endDate (if both provided)
 */
export const UpdateCampaignSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    channel: z.string().min(1).max(100).nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    budgetTotal: z.string().nullable().optional(),
    attributes: z.record(z.string(), z.any()).optional(),
  })
  .refine(
    (data) => {
      // Date range validation: startDate <= endDate (if both provided)
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'startDate must be on or before endDate' }
  );

/**
 * Type inferred from UpdateCampaignSchema
 */
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
