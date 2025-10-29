/**
 * Plugin Events Schemas
 *
 * Zod schemas for plugin events operations validation.
 */

import { z } from 'zod';

/**
 * Schema for listing plugin events
 */
export const ListEventsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processed', 'failed']).optional(),
  eventType: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type ListEventsInput = z.infer<typeof ListEventsSchema>;

/**
 * Type for plugin event list item (without raw data for performance)
 */
export interface PluginEventListItem {
  eventId: string;
  eventType: string;
  status: 'pending' | 'processed' | 'failed';
  ingestedAt: Date;
  processedAt: Date | null;
  errorMessage: string | null;
}

/**
 * Type for plugin event detail (includes raw data)
 */
export interface PluginEventDetail extends PluginEventListItem {
  rawData: unknown;
  activityId?: string;
}

/**
 * Type for plugin events statistics
 */
export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: Date | null;
  oldestIngestedAt: Date | null;
}

/**
 * Type for list events response with pagination
 */
export interface ListEventsResponse {
  items: PluginEventListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
