/**
 * Shortlink Service
 *
 * CRUD operations for shortlinks (short URLs for click tracking).
 *
 * Features:
 * - Create shortlink with auto-generated or custom key
 * - Get shortlink by ID or key
 * - List shortlinks with pagination, filtering, and sorting
 * - Update shortlink properties
 * - Delete shortlink
 * - Click tracking via activities table
 *
 * Key generation:
 * - Uses nanoid with custom alphabet (URL-safe: a-zA-Z0-9_-)
 * - Default length: 8 characters
 * - Collision probability: ~1 in 168 billion
 *
 * Click tracking:
 * - Clicks are recorded in activities table with action="click", source="shortlink"
 * - Metadata includes shortlink_id, campaign_id, user_agent, referer, ip_address
 * - Click counts are aggregated in listShortlinks() using LEFT JOIN
 *
 * RLS:
 * - All operations enforce tenant isolation via withTenantContext()
 * - Shortlinks are scoped to tenant_id
 * - Activities are scoped to tenant_id
 */

export {
  createShortlink,
} from './shortlink-create.service.js';

export {
  getShortlink,
  getShortlinkByKey,
} from './shortlink-get.service.js';

export {
  listShortlinks,
} from './shortlink-list.service.js';

export {
  updateShortlink,
} from './shortlink-update.service.js';

export {
  deleteShortlink,
} from './shortlink-delete.service.js';

export type {
  CreateShortlink,
  Shortlink,
  ListShortlinks,
  ShortlinkWithClickCount,
  ListShortlinksResult,
  UpdateShortlink,
} from './shortlink.schemas.js';
