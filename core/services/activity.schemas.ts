/**
 * Activity Service - Zod Schemas
 *
 * Validation schemas for Activity Service CRUD operations.
 */

import { z } from 'zod';

/**
 * Zod schema for creating activity
 *
 * Validates input data for createActivity().
 */
export const CreateActivitySchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  anonId: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  occurredAt: z.coerce.date(),
  source: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  value: z.number().nullable().optional(),
  dedupKey: z.string().nullable().optional(),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

/**
 * Zod schema for listing activities
 *
 * Validates query parameters for listActivities().
 */
export const ListActivitiesSchema = z
  .object({
    developerId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
    resourceId: z.string().uuid().optional(),
    action: z.string().optional(),
    source: z.string().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
    orderBy: z.enum(['occurred_at', 'recorded_at', 'ingested_at']).optional(),
    orderDirection: z.enum(['asc', 'desc']).optional(),
  })
  .refine(
    (data) => {
      // Only validate if both dates are present
      if (data.fromDate && data.toDate) {
        return data.fromDate.getTime() <= data.toDate.getTime();
      }
      return true;
    },
    {
      message: 'fromDate must be on or before toDate',
      path: ['fromDate'],
    }
  );

export type ListActivitiesInput = z.infer<typeof ListActivitiesSchema>;

/**
 * Zod schema for updating activity
 *
 * Validates input data for updateActivity().
 * Only specified fields will be updated (partial update).
 */
export const UpdateActivitySchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  anonId: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  action: z.string().min(1).optional(),
  occurredAt: z.coerce.date().optional(),
  source: z.string().min(1).optional(),
  sourceRef: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  value: z.number().nullable().optional(),
});

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;
