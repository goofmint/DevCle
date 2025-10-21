/**
 * Campaign Types
 *
 * Type definitions for campaign-related components.
 */

/**
 * Campaign base type
 */
export interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string | null;
  startDate: string | null; // YYYY-MM-DD format
  endDate: string | null; // YYYY-MM-DD format
  budgetTotal: string | null; // decimal string
  attributes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Campaign list item with ROI information
 */
export interface CampaignListItem extends Campaign {
  /** ROI percentage (e.g., 50.5 means 50.5% return) or null if calculation not possible */
  roi?: number | null;
  /** Number of activities associated with this campaign */
  activityCount?: number;
  /** Number of developers associated with this campaign */
  developerCount?: number;
}

/**
 * Pagination information
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
