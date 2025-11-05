/**
 * Plugin Events Types
 *
 * Type definitions for plugin event data display UI.
 */

/**
 * Plugin event status
 */
export type PluginEventStatus = 'pending' | 'processed' | 'failed';

/**
 * Plugin event from plugin_events_raw table
 */
export interface PluginEvent {
  eventId: string;
  pluginId: string;
  eventType: string;
  status: PluginEventStatus;
  rawData: Record<string, unknown>;
  processedData: Record<string, unknown> | null;
  errorMessage: string | null;
  ingestedAt: string;
  processedAt: string | null;
}

/**
 * Events statistics
 */
export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  processingRate: number;
  errorRate: number;
}

/**
 * Events filter parameters
 */
export interface EventsFilter {
  status?: PluginEventStatus[];
  eventType?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * List events API response
 */
export interface ListEventsResponse {
  items: PluginEvent[];
  pagination: PaginationInfo;
}

/**
 * Events stats API response
 */
export interface EventsStatsResponse {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null;
  oldestIngestedAt: string | null;
}
