/**
 * Shortlink Service - Zod Schemas
 *
 * Type definitions and validation schemas for shortlink CRUD operations.
 */

import { z } from 'zod';

/**
 * Create Shortlink Schema
 *
 * Input validation for createShortlink() function.
 *
 * Fields:
 * - targetUrl: Destination URL (required, must be valid URL)
 * - key: Custom key for shortlink (optional, default: auto-generated with nanoid)
 *   - Must be 4-20 characters
 *   - Must match pattern: [a-zA-Z0-9_-]+
 * - campaignId: UUID of the campaign (optional)
 * - resourceId: UUID of the resource (optional)
 * - attributes: UTM parameters and other metadata (optional)
 *
 * Example:
 * ```typescript
 * {
 *   targetUrl: 'https://example.com/blog/post-123',
 *   key: 'myblog',
 *   campaignId: 'campaign-uuid',
 *   resourceId: 'resource-uuid',
 *   attributes: {
 *     utm_source: 'twitter',
 *     utm_medium: 'social',
 *     utm_campaign: 'spring-2025'
 *   }
 * }
 * ```
 */
export const CreateShortlinkSchema = z.object({
  targetUrl: z.string().url(),
  key: z
    .string()
    .min(4)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type CreateShortlink = z.infer<typeof CreateShortlinkSchema>;

/**
 * Shortlink Result
 *
 * Return type for shortlink CRUD operations.
 *
 * Fields:
 * - shortlinkId: UUID of the shortlink
 * - key: Shortlink key (e.g., "abcd1234")
 * - targetUrl: Destination URL
 * - shortUrl: Full short URL (e.g., "https://devcle.com/c/abcd1234")
 * - campaignId: UUID of the campaign (null if not set)
 * - resourceId: UUID of the resource (null if not set)
 * - attributes: UTM parameters and other metadata (null if not set)
 * - createdAt: Creation timestamp
 * - updatedAt: Last updated timestamp
 */
export interface Shortlink {
  shortlinkId: string;
  key: string;
  targetUrl: string;
  shortUrl: string;
  campaignId: string | null;
  resourceId: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List Shortlinks Schema
 *
 * Input validation for listShortlinks() function.
 *
 * Fields:
 * - campaignId: Filter by campaign (optional)
 * - resourceId: Filter by resource (optional)
 * - search: Partial match in key or targetUrl (optional, case-insensitive)
 * - limit: Max number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - orderBy: Sort field (key, targetUrl, createdAt, updatedAt, clickCount)
 * - orderDirection: Sort direction (asc, desc)
 *
 * Example:
 * ```typescript
 * {
 *   campaignId: 'campaign-uuid',
 *   search: 'blog',
 *   limit: 20,
 *   offset: 0,
 *   orderBy: 'clickCount',
 *   orderDirection: 'desc'
 * }
 * ```
 */
export const ListShortlinksSchema = z.object({
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  orderBy: z
    .enum(['key', 'targetUrl', 'createdAt', 'updatedAt', 'clickCount'])
    .optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type ListShortlinks = z.infer<typeof ListShortlinksSchema>;

/**
 * Shortlink with Click Count
 *
 * Extended shortlink type that includes click count from activities table.
 */
export interface ShortlinkWithClickCount extends Shortlink {
  clickCount: number;
}

/**
 * List Shortlinks Result
 *
 * Return type for listShortlinks() function.
 *
 * Fields:
 * - shortlinks: Array of shortlinks with click counts
 * - total: Total count (not affected by limit/offset)
 */
export interface ListShortlinksResult {
  shortlinks: ShortlinkWithClickCount[];
  total: number;
}

/**
 * Update Shortlink Schema
 *
 * Input validation for updateShortlink() function.
 *
 * Fields:
 * - targetUrl: New destination URL (optional)
 * - key: New shortlink key (optional, must be unique within tenant)
 * - campaignId: New campaign ID (optional, null to unset)
 * - resourceId: New resource ID (optional, null to unset)
 * - attributes: New attributes (optional, null to unset)
 *
 * Note: At least one field must be provided.
 *
 * Example:
 * ```typescript
 * {
 *   targetUrl: 'https://example.com/new-blog-post',
 *   key: 'newkey123'
 * }
 * ```
 */
export const UpdateShortlinkSchema = z.object({
  targetUrl: z.string().url().optional(),
  key: z
    .string()
    .min(4)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  campaignId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpdateShortlink = z.infer<typeof UpdateShortlinkSchema>;
