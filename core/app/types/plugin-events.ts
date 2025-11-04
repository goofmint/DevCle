/**
 * Shared Type Definitions for Plugin Events
 *
 * This file serves as the single source of truth for all plugin event
 * related types used across components.
 */

/**
 * Plugin Event
 *
 * Represents a single event collected by a plugin from an external source.
 * Stored in plugin_events_raw table.
 */
export interface PluginEvent {
  pluginEventId: string;
  eventType: string;
  status: 'processed' | 'failed' | 'pending';
  rawData: Record<string, unknown>;
  errorMessage: string | null;
  ingestedAt: string; // ISO timestamp
  processedAt: string | null; // ISO timestamp
}

/**
 * Events Filter
 *
 * Filter criteria for event list queries.
 */
export interface EventsFilter {
  status?: string[]; // ["processed", "failed", "pending"]
  eventType?: string; // Free text search (partial match)
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}

/**
 * Events Statistics
 *
 * Aggregated statistics for plugin events.
 */
export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null; // ISO timestamp
  oldestIngestedAt: string | null; // ISO timestamp
}

/**
 * Pagination Info
 *
 * Pagination metadata for event list.
 */
export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * API Response Types
 */

export interface ListEventsResponse {
  events: PluginEvent[];
  pagination: PaginationInfo;
}

export interface EventsStatsResponse extends EventsStats {}

export interface EventDetailResponse {
  event: PluginEvent;
}

export interface ReprocessResponse {
  success: boolean;
  message: string;
}

/**
 * API Error Response
 *
 * Standard error response format from API.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
