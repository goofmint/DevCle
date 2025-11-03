/**
 * Plugin Events Service
 *
 * Service layer for managing plugin event data collection and retrieval.
 * Handles filtering, pagination, sorting, and sensitive data masking.
 *
 * Key responsibilities:
 * - List plugin events with filtering and pagination
 * - Retrieve individual event details with sensitive data masking
 * - Get event statistics (counts, timestamps)
 * - Queue event reprocessing
 *
 * Security features:
 * - Automatic sensitive data masking (tokens, keys, passwords)
 * - Tenant isolation via withTenantContext
 * - Input validation via Zod schemas
 */

import { z } from 'zod';
import { and, eq, gte, lte, count, asc, desc, max, min, sql } from 'drizzle-orm';
import * as schema from '../db/schema/index.js';
import { withTenantContext } from '../db/connection.js';

// ===========================
// Schema Definitions
// ===========================

/**
 * Schema for list events query parameters
 * Validates pagination, filtering, and sorting options
 */
export const ListEventsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processed', 'failed']).optional(),
  eventType: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type ListEventsInput = z.infer<typeof ListEventsSchema>;

/**
 * Event list item (without raw data)
 * Used in list responses to avoid exposing sensitive data
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
 * Event detail (with masked raw data)
 * Includes full event information with sensitive data masked
 */
export interface PluginEventDetail extends PluginEventListItem {
  rawData: unknown;
  activityId?: string;
}

/**
 * Event statistics
 * Aggregated counts and timestamps
 */
export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: Date | null;
  oldestIngestedAt: Date | null;
}

// ===========================
// Sensitive Data Masking
// ===========================

/**
 * Sensitive field names to mask
 * Configurable list of field names containing sensitive data
 */
const SENSITIVE_FIELD_NAMES = [
  'token',
  'api_key',
  'apikey',
  'secret',
  'password',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'authorization',
  'auth',
  'credentials',
  'private_key',
  'privatekey',
  'client_secret',
  'clientsecret',
  'bearer',
];

/**
 * Credential patterns (regex)
 * Patterns matching common credential formats
 */
const CREDENTIAL_PATTERNS = [
  /^[A-Za-z0-9\-_]{20,}$/, // Long random strings
  /^sk_[a-z]+_[A-Za-z0-9]{20,}$/, // Stripe format
  /^ghp_[A-Za-z0-9]{36}$/, // GitHub Personal Access Token
  /^gho_[A-Za-z0-9]{36}$/, // GitHub OAuth Token
  /^glpat-[A-Za-z0-9\-_]{20}$/, // GitLab Personal Access Token
];

/**
 * Check if a value looks like a credential
 *
 * @param value - String value to check
 * @returns true if value matches credential patterns
 */
function looksLikeCredential(value: string): boolean {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Mask a value (partial masking)
 *
 * Strategy:
 * - <8 chars: full redaction
 * - >=8 chars: show first 4 and last 4 characters
 *
 * @param value - Value to mask
 * @returns Masked string
 */
function maskValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '***REDACTED***';
  }

  // Full masking for short values
  if (value.length < 8) {
    return '***REDACTED***';
  }

  // Partial masking for longer values
  const start = value.slice(0, 4);
  const end = value.slice(-4);
  return `${start}***${end}`;
}

/**
 * Recursively sanitize raw data
 *
 * Masks sensitive fields and credential-like strings in:
 * - Objects (recursively)
 * - Arrays (each element)
 * - Primitives (if they match patterns)
 *
 * @param data - Data to sanitize
 * @returns Sanitized data with masked sensitive values
 */
function sanitizeRawData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRawData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if field name indicates sensitive data
      const keyLower = key.toLowerCase();
      if (SENSITIVE_FIELD_NAMES.some((sensitive) => keyLower.includes(sensitive))) {
        sanitized[key] = maskValue(value);
      }
      // Check if string value matches credential pattern
      else if (typeof value === 'string' && looksLikeCredential(value)) {
        sanitized[key] = maskValue(value);
      }
      // Recursively process other values
      else {
        sanitized[key] = sanitizeRawData(value);
      }
    }
    return sanitized;
  }

  // Return primitives as-is
  return data;
}

// ===========================
// List Events
// ===========================

/**
 * List plugin events with filtering, sorting, and pagination
 *
 * Features:
 * - Filter by status, event type, date range
 * - Sort by ingested_at (asc/desc)
 * - Pagination support
 * - Excludes raw data for performance
 *
 * @param tenantId - Tenant identifier
 * @param pluginId - Plugin identifier
 * @param input - Query parameters (validated)
 * @returns Paginated list of events
 */
export async function listPluginEvents(
  tenantId: string,
  pluginId: string,
  input: ListEventsInput
): Promise<{ items: PluginEventListItem[]; total: number }> {
  return await withTenantContext(tenantId, async (tx) => {
    // Base conditions (tenant + plugin)
    const baseConditions = and(
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId)
    );

    // Build filter conditions
    const conditions = [baseConditions];

    if (input.status) {
      conditions.push(eq(schema.pluginEventsRaw.status, input.status));
    }

    if (input.eventType) {
      conditions.push(eq(schema.pluginEventsRaw.eventType, input.eventType));
    }

    if (input.startDate) {
      conditions.push(gte(schema.pluginEventsRaw.ingestedAt, input.startDate));
    }

    if (input.endDate) {
      conditions.push(lte(schema.pluginEventsRaw.ingestedAt, input.endDate));
    }

    const whereClause = and(...conditions);

    // Query events (exclude raw_data for performance)
    const items = await tx
      .select({
        eventId: schema.pluginEventsRaw.eventId,
        eventType: schema.pluginEventsRaw.eventType,
        status: schema.pluginEventsRaw.status,
        ingestedAt: schema.pluginEventsRaw.ingestedAt,
        processedAt: schema.pluginEventsRaw.processedAt,
        errorMessage: schema.pluginEventsRaw.errorMessage,
      })
      .from(schema.pluginEventsRaw)
      .where(whereClause)
      .orderBy(
        input.sort === 'asc'
          ? asc(schema.pluginEventsRaw.ingestedAt)
          : desc(schema.pluginEventsRaw.ingestedAt)
      )
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage);

    // Get total count
    const [{ total }] = await tx
      .select({ total: count() })
      .from(schema.pluginEventsRaw)
      .where(whereClause);

    return {
      items: items as PluginEventListItem[],
      total: Number(total),
    };
  });
}

// ===========================
// Get Event Detail
// ===========================

/**
 * Get plugin event detail with masked sensitive data
 *
 * Features:
 * - Retrieves full event including raw data
 * - Automatically masks sensitive fields
 * - Tenant isolation enforced
 *
 * @param tenantId - Tenant identifier
 * @param pluginId - Plugin identifier
 * @param eventId - Event identifier
 * @returns Event detail or null if not found
 */
export async function getPluginEventDetail(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<PluginEventDetail | null> {
  return await withTenantContext(tenantId, async (tx) => {
    // Query event with raw data
    const [event] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!event) {
      return null;
    }

    // TODO: Find related Activity
    // This would require:
    // 1. Adding a sourceEventId column to activities table, OR
    // 2. Storing eventId in activity metadata
    const activityId: string | undefined = undefined;

    // Return event with masked raw data
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status as 'pending' | 'processed' | 'failed',
      ingestedAt: event.ingestedAt,
      processedAt: event.processedAt,
      errorMessage: event.errorMessage,
      rawData: sanitizeRawData(event.rawData),
      activityId,
    };
  });
}

// ===========================
// Get Events Statistics
// ===========================

/**
 * Get plugin events statistics
 *
 * Returns:
 * - Total count
 * - Count by status (processed, failed, pending)
 * - Latest and oldest ingestion timestamps
 *
 * @param tenantId - Tenant identifier
 * @param pluginId - Plugin identifier
 * @returns Event statistics
 */
export async function getPluginEventsStats(
  tenantId: string,
  pluginId: string
): Promise<EventsStats> {
  return await withTenantContext(tenantId, async (tx) => {
    const baseConditions = and(
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId)
    );

    // Count by status
    const [counts] = await tx
      .select({
        total: count(),
        processed: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'processed' THEN 1 END`
        ),
        failed: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'failed' THEN 1 END`
        ),
        pending: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'pending' THEN 1 END`
        ),
      })
      .from(schema.pluginEventsRaw)
      .where(baseConditions);

    // Get latest/oldest timestamps
    const [dates] = await tx
      .select({
        latest: max(schema.pluginEventsRaw.ingestedAt),
        oldest: min(schema.pluginEventsRaw.ingestedAt),
      })
      .from(schema.pluginEventsRaw)
      .where(baseConditions);

    return {
      total: Number(counts.total),
      processed: Number(counts.processed),
      failed: Number(counts.failed),
      pending: Number(counts.pending),
      latestIngestedAt: dates.latest,
      oldestIngestedAt: dates.oldest,
    };
  });
}

// ===========================
// Reprocess Event
// ===========================

/**
 * Queue event for reprocessing
 *
 * Resets status to 'pending' and clears error state.
 * The event will be picked up by the background job processor.
 *
 * @param tenantId - Tenant identifier
 * @param pluginId - Plugin identifier
 * @param eventId - Event identifier
 * @throws Error if event not found
 */
export async function reprocessEvent(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<void> {
  await withTenantContext(tenantId, async (tx) => {
    // Verify event exists
    const [event] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!event) {
      throw new Error('Event not found');
    }

    // Reset status to pending
    await tx
      .update(schema.pluginEventsRaw)
      .set({
        status: 'pending',
        processedAt: null,
        errorMessage: null,
      })
      .where(eq(schema.pluginEventsRaw.eventId, eventId));

    // TODO: Queue reprocessing job
    // This requires:
    // 1. Job queue implementation (BullMQ or similar)
    // 2. Background worker to process pending events
    // Example:
    // await addJob('plugin:normalize', { eventId, pluginId, tenantId });
  });
}
