# Task 5.3: 短縮URL機能実装

**担当者**: Claude Code
**推定時間**: 5時間（スコープ拡大）
**依存タスク**: Task 5.1（Campaign Service）
**完了条件**: 短縮URLが機能し、クリック数がclicksテーブルに記録される

---

## 概要

短縮URL（Shortlink）機能を実装し、キャンペーンのクリック追跡を可能にする。

### 主要機能

1. **短縮URL管理（CRUD）**
   - Campaign/Resourceに紐づく短縮URLを生成・管理
   - nanoidで短くURL-safeなキーを生成（例: `abcd1234`）
   - url/keyはアップデート可能（ドメインを通じてユニーク）
   - UTMパラメータを属性として保存

2. **クリック追跡（CRUD）**
   - 短縮URLがクリックされた際にclicksテーブルに記録
   - どのキャンペーン・リソース（ブログ記事等）のクリックか記録
   - developer_id, account_id, anon_id で識別
   - クリックデータの閲覧・集計機能

3. **リダイレクト処理**
   - `/c/{key}` でアクセスされた際にターゲットURLへリダイレクト
   - リダイレクト前にclicksテーブルに記録

---

## データベーススキーマ

### 1. shortlinks テーブル（既存、更新あり）

Task 3.2で既に実装済みだが、`updated_at`カラムを追加する必要がある（url/key更新時のトラッキング用）。

```typescript
// core/db/schema/plugins.ts (既存スキーマ + updated_at追加)
export const shortlinks = pgTable('shortlinks', {
  shortlinkId: uuid('shortlink_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),                    // 短縮キー (例: "abcd1234") - UPDATE可能
  targetUrl: text('target_url').notNull(),        // リダイレクト先URL - UPDATE可能
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),                // UTMパラメータ等 - UPDATE可能
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(), // 追加
}, (t) => ({
  keyUnique: unique('shortlinks_tenant_key_unique').on(t.tenantId, t.key),
}));
```

**マイグレーション**: `updated_at` カラム追加が必要。

---

### 2. clicks テーブル（新規作成）

クリックイベントを記録するテーブル。どのキャンペーン・リソースのクリックかを記録。

```typescript
// core/db/schema/plugins.ts (新規追加)

/**
 * Clicks Table
 *
 * Click tracking for shortlinks with campaign/resource attribution.
 *
 * Fields:
 * - click_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - shortlink_id: Foreign key to shortlinks (cascade delete)
 * - campaign_id: Foreign key to campaigns (optional, set null on campaign delete)
 * - resource_id: Foreign key to resources (optional, set null on resource delete)
 * - developer_id: Foreign key to developers (optional, set null on developer delete)
 * - account_id: Foreign key to accounts (optional, set null on account delete)
 * - anon_id: Anonymous ID from cookie/fingerprint (optional)
 * - user_agent: User agent string (optional)
 * - referer: Referer URL (optional)
 * - ip_address: IP address (inet type, optional)
 * - metadata: JSONB for additional click context (browser info, etc.)
 * - clicked_at: Click timestamp (defaults to now)
 *
 * Indexes:
 * - (tenant_id, shortlink_id, clicked_at DESC) for shortlink click history
 * - (tenant_id, campaign_id, clicked_at DESC) for campaign click analytics
 * - (tenant_id, resource_id, clicked_at DESC) for resource click analytics
 * - (tenant_id, developer_id, clicked_at DESC) for developer click analytics
 *
 * Usage:
 * - Record clicks for shortlinks
 * - Analyze which blog post (resource) got the most clicks
 * - Track campaign effectiveness
 * - Identify developers who clicked on specific content
 */
export const clicks = pgTable('clicks', {
  clickId: uuid('click_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  shortlinkId: uuid('shortlink_id').notNull().references(() => shortlinks.shortlinkId, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.accountId, { onDelete: 'set null' }),
  anonId: text('anon_id'),
  userAgent: text('user_agent'),
  referer: text('referer'),
  ipAddress: text('ip_address'), // Store as text (inet type requires custom mapping)
  metadata: jsonb('metadata'),
  clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  shortlinkClicksIdx: index('idx_clicks_shortlink_time').on(t.tenantId, t.shortlinkId, t.clickedAt),
  campaignClicksIdx: index('idx_clicks_campaign_time').on(t.tenantId, t.campaignId, t.clickedAt),
  resourceClicksIdx: index('idx_clicks_resource_time').on(t.tenantId, t.resourceId, t.clickedAt),
  developerClicksIdx: index('idx_clicks_developer_time').on(t.tenantId, t.developerId, t.clickedAt),
}));
```

**マイグレーション**: `clicks` テーブル新規作成が必要。

---

## サービス関数定義

### Shortlink Service（CRUD操作）

#### 1. createShortlink()

短縮URLを生成し、shortlinksテーブルに登録する。

```typescript
// core/services/shortlink.service.ts

import { z } from 'zod';

/**
 * Create Shortlink Schema
 *
 * Input validation for createShortlink() function.
 *
 * Fields:
 * - targetUrl: Destination URL (required)
 * - key: Custom key for shortlink (optional, default: auto-generated with nanoid)
 * - campaignId: UUID of the campaign (optional)
 * - resourceId: UUID of the resource (optional)
 * - attributes: UTM parameters and other metadata (optional)
 */
export const CreateShortlinkSchema = z.object({
  targetUrl: z.string().url(),
  key: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export type CreateShortlink = z.infer<typeof CreateShortlinkSchema>;

/**
 * Shortlink Result
 *
 * Return type for shortlink CRUD operations.
 */
export interface Shortlink {
  shortlinkId: string;
  key: string;
  targetUrl: string;
  shortUrl: string;         // Full short URL (e.g., "https://devcle.com/c/abcd1234")
  campaignId: string | null;
  resourceId: string | null;
  attributes: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Shortlink
 *
 * Creates a new shortlink and returns the shortlink details.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Shortlink creation parameters
 * @returns Shortlink containing shortlink details
 * @throws {Error} If key already exists (unique constraint violation)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateShortlinkSchema
 * 2. Generate key using nanoid (if key not provided)
 * 3. Insert into shortlinks table with RLS context
 * 4. Return Shortlink with full short URL
 *
 * Key generation:
 * - Use nanoid with custom alphabet (URL-safe: a-zA-Z0-9_-)
 * - Default length: 8 characters
 * - Example: "abcd1234", "XyZ_9876"
 *
 * Unique constraint handling:
 * - If key already exists, retry with new key (max 3 retries)
 * - If custom key provided and exists, throw error immediately (409 Conflict)
 *
 * Example:
 * ```typescript
 * const shortlink = await createShortlink('default', {
 *   targetUrl: 'https://example.com/blog/post-123',
 *   campaignId: 'campaign-uuid',
 *   resourceId: 'resource-uuid',
 *   attributes: {
 *     utm_source: 'twitter',
 *     utm_medium: 'social',
 *     utm_campaign: 'spring-2025',
 *   },
 * });
 *
 * console.log(shortlink.shortUrl); // "https://devcle.com/c/abcd1234"
 * ```
 */
export async function createShortlink(
  tenantId: string,
  input: CreateShortlink
): Promise<Shortlink> {
  // Implementation: Validate input, generate key with nanoid, insert into DB
  // ...
}
```

---

#### 2. getShortlink()

shortlink_id または key で短縮URLを取得する。

```typescript
/**
 * Get Shortlink by ID
 *
 * Retrieves a shortlink by its UUID.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and shortlink_id
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlink('default', 'shortlink-uuid');
 * if (!shortlink) {
 *   throw new Error('Shortlink not found');
 * }
 * ```
 */
export async function getShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<Shortlink | null> {
  // Implementation: Query by shortlink_id with RLS
  // ...
}

/**
 * Get Shortlink by Key
 *
 * Retrieves a shortlink by its key.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param key - Shortlink key (e.g., "abcd1234")
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and key
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlinkByKey('default', 'abcd1234');
 * if (!shortlink) {
 *   return Response.json({ error: 'Not found' }, { status: 404 });
 * }
 * ```
 */
export async function getShortlinkByKey(
  tenantId: string,
  key: string
): Promise<Shortlink | null> {
  // Implementation: Query by key with RLS
  // ...
}
```

---

#### 3. listShortlinks()

短縮URL一覧を取得する（ページネーション、フィルタ、ソート対応）。

```typescript
/**
 * List Shortlinks Schema
 *
 * Input validation for listShortlinks() function.
 *
 * Fields:
 * - campaignId: Filter by campaign (optional)
 * - resourceId: Filter by resource (optional)
 * - search: Partial match in key or targetUrl (optional)
 * - limit: Max number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - orderBy: Sort field (key, targetUrl, createdAt, updatedAt, clickCount)
 * - orderDirection: Sort direction (asc, desc)
 */
export const ListShortlinksSchema = z.object({
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  orderBy: z.enum(['key', 'targetUrl', 'createdAt', 'updatedAt', 'clickCount']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type ListShortlinks = z.infer<typeof ListShortlinksSchema>;

/**
 * List Shortlinks Result
 *
 * Return type for listShortlinks() function.
 */
export interface ListShortlinksResult {
  shortlinks: Array<Shortlink & { clickCount: number }>;
  total: number;
}

/**
 * List Shortlinks
 *
 * Retrieves a list of shortlinks with pagination, filtering, and sorting.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - List parameters
 * @returns List of shortlinks with click counts and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListShortlinksSchema
 * 2. Apply default values: limit=50, offset=0, orderBy=createdAt, orderDirection=desc
 * 3. Query shortlinks with filters
 * 4. LEFT JOIN clicks to get click count for each shortlink
 * 5. Apply sorting and pagination
 * 6. Get total count with COUNT aggregate query
 * 7. Return shortlinks and total
 *
 * Filters:
 * - campaignId: Exact match
 * - resourceId: Exact match
 * - search: ILIKE search in key or targetUrl (case-insensitive)
 *
 * Sorting:
 * - clickCount: Use COUNT(clicks.click_id) for sorting
 *
 * Example:
 * ```typescript
 * const result = await listShortlinks('default', {
 *   campaignId: 'campaign-uuid',
 *   search: 'blog',
 *   limit: 20,
 *   offset: 0,
 *   orderBy: 'clickCount',
 *   orderDirection: 'desc',
 * });
 *
 * console.log(result.shortlinks); // Array of shortlinks with clickCount
 * console.log(result.total); // Total count (not affected by limit/offset)
 * ```
 */
export async function listShortlinks(
  tenantId: string,
  input: ListShortlinks
): Promise<ListShortlinksResult> {
  // Implementation: Query with filters, LEFT JOIN clicks, sorting, pagination
  // ...
}
```

---

#### 4. updateShortlink()

短縮URLを更新する（url, key, campaign_id, resource_id, attributes）。

```typescript
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
 */
export const UpdateShortlinkSchema = z.object({
  targetUrl: z.string().url().optional(),
  key: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.string(), z.any()).nullable().optional(),
});

export type UpdateShortlink = z.infer<typeof UpdateShortlinkSchema>;

/**
 * Update Shortlink
 *
 * Updates a shortlink's properties.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @param input - Fields to update
 * @returns Updated Shortlink
 * @throws {Error} If shortlink not found (404)
 * @throws {Error} If new key already exists (409 Conflict)
 * @throws {Error} If no fields provided for update (400 Bad Request)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateShortlinkSchema
 * 2. Check if shortlink exists
 * 3. Check if at least one field is provided (throw error if empty update)
 * 4. If key is being updated, check unique constraint (tenant_id, key)
 * 5. Update shortlinks table with new values and updated_at = NOW()
 * 6. Return updated Shortlink
 *
 * Edge cases:
 * - Empty update (no fields provided): Throw 400 error
 * - Key collision: Throw 409 error with clear message
 * - Shortlink not found: Throw 404 error
 *
 * Example:
 * ```typescript
 * const updated = await updateShortlink('default', 'shortlink-uuid', {
 *   targetUrl: 'https://example.com/new-blog-post',
 *   key: 'newkey123',
 * });
 *
 * console.log(updated.key); // "newkey123"
 * console.log(updated.updatedAt); // New timestamp
 * ```
 */
export async function updateShortlink(
  tenantId: string,
  shortlinkId: string,
  input: UpdateShortlink
): Promise<Shortlink> {
  // Implementation: Validate, check existence, update with RLS
  // ...
}
```

---

#### 5. deleteShortlink()

短縮URLを削除する（CASCADE: clicks も削除される）。

```typescript
/**
 * Delete Shortlink
 *
 * Deletes a shortlink and all associated clicks (CASCADE).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns true if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Execute DELETE with tenant_id and shortlink_id filtering
 * 2. Use RETURNING clause to detect successful deletion
 * 3. Return true if deleted, false if not found
 * 4. CASCADE delete: clicks table rows are automatically deleted (FK constraint)
 *
 * Example:
 * ```typescript
 * const deleted = await deleteShortlink('default', 'shortlink-uuid');
 * if (deleted) {
 *   console.log('Shortlink deleted');
 * } else {
 *   console.log('Shortlink not found');
 * }
 * ```
 */
export async function deleteShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<boolean> {
  // Implementation: DELETE with RETURNING, CASCADE to clicks
  // ...
}
```

---

### Click Service（CRUD操作）

#### 1. createClick()

クリックイベントを記録する。

```typescript
// core/services/click.service.ts

/**
 * Create Click Schema
 *
 * Input validation for createClick() function.
 *
 * Fields:
 * - shortlinkId: UUID of the shortlink (required)
 * - campaignId: UUID of the campaign (optional, copied from shortlink if not provided)
 * - resourceId: UUID of the resource (optional, copied from shortlink if not provided)
 * - developerId: UUID of the developer (optional, if authenticated)
 * - accountId: UUID of the account (optional, if resolved)
 * - anonId: Anonymous ID from cookie/fingerprint (optional)
 * - userAgent: User agent string (optional)
 * - referer: Referer URL (optional)
 * - ipAddress: IP address (optional)
 * - metadata: Additional click context (optional)
 */
export const CreateClickSchema = z.object({
  shortlinkId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  developerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  anonId: z.string().optional(),
  userAgent: z.string().optional(),
  referer: z.string().url().optional(),
  ipAddress: z.string().ip().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateClick = z.infer<typeof CreateClickSchema>;

/**
 * Click Result
 *
 * Return type for click CRUD operations.
 */
export interface Click {
  clickId: string;
  shortlinkId: string;
  campaignId: string | null;
  resourceId: string | null;
  developerId: string | null;
  accountId: string | null;
  anonId: string | null;
  userAgent: string | null;
  referer: string | null;
  ipAddress: string | null;
  metadata: Record<string, any> | null;
  clickedAt: Date;
}

/**
 * Create Click
 *
 * Records a click event in the clicks table.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Click creation parameters
 * @returns Click containing click details
 * @throws {Error} If shortlink not found (404)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateClickSchema
 * 2. Lookup shortlink to get campaign_id and resource_id (if not provided)
 * 3. Insert into clicks table with RLS context
 * 4. Return Click details
 *
 * Campaign/Resource ID fallback:
 * - If campaignId not provided in input, use shortlink.campaign_id
 * - If resourceId not provided in input, use shortlink.resource_id
 * - This ensures clicks are properly attributed even if not explicitly provided
 *
 * Example:
 * ```typescript
 * const click = await createClick('default', {
 *   shortlinkId: 'shortlink-uuid',
 *   anonId: 'anon-123456',
 *   userAgent: 'Mozilla/5.0...',
 *   referer: 'https://twitter.com/...',
 *   ipAddress: '192.168.1.1',
 * });
 *
 * console.log(click.clickId); // UUID
 * console.log(click.campaignId); // Copied from shortlink
 * ```
 */
export async function createClick(
  tenantId: string,
  input: CreateClick
): Promise<Click> {
  // Implementation: Validate, lookup shortlink, insert into clicks
  // ...
}
```

---

#### 2. getClick()

click_id でクリックイベントを取得する。

```typescript
/**
 * Get Click by ID
 *
 * Retrieves a click event by its UUID.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param clickId - Click UUID
 * @returns Click if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query clicks table filtered by tenant_id and click_id
 * 2. Return null if not found (not an error)
 * 3. Return Click if found
 *
 * Example:
 * ```typescript
 * const click = await getClick('default', 'click-uuid');
 * if (!click) {
 *   throw new Error('Click not found');
 * }
 * ```
 */
export async function getClick(
  tenantId: string,
  clickId: string
): Promise<Click | null> {
  // Implementation: Query by click_id with RLS
  // ...
}
```

---

#### 3. listClicks()

クリック一覧を取得する（ページネーション、フィルタ、ソート対応）。

```typescript
/**
 * List Clicks Schema
 *
 * Input validation for listClicks() function.
 *
 * Fields:
 * - shortlinkId: Filter by shortlink (optional)
 * - campaignId: Filter by campaign (optional)
 * - resourceId: Filter by resource (optional)
 * - developerId: Filter by developer (optional)
 * - fromDate: Filter by date range start (optional)
 * - toDate: Filter by date range end (optional)
 * - limit: Max number of results (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 * - orderBy: Sort field (clickedAt)
 * - orderDirection: Sort direction (asc, desc)
 */
export const ListClicksSchema = z.object({
  shortlinkId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  developerId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  orderBy: z.enum(['clickedAt']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
}).refine(
  (data) => {
    if (data.fromDate && data.toDate) {
      return data.fromDate <= data.toDate;
    }
    return true;
  },
  { message: 'fromDate must be on or before toDate' }
);

export type ListClicks = z.infer<typeof ListClicksSchema>;

/**
 * List Clicks Result
 *
 * Return type for listClicks() function.
 */
export interface ListClicksResult {
  clicks: Array<Click>;
  total: number;
}

/**
 * List Clicks
 *
 * Retrieves a list of clicks with pagination, filtering, and sorting.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - List parameters
 * @returns List of clicks and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListClicksSchema
 * 2. Apply default values: limit=100, offset=0, orderBy=clickedAt, orderDirection=desc
 * 3. Query clicks with filters
 * 4. Apply date range filter if fromDate/toDate provided
 * 5. Apply sorting and pagination
 * 6. Get total count with COUNT aggregate query
 * 7. Return clicks and total
 *
 * Filters:
 * - shortlinkId: Exact match
 * - campaignId: Exact match (useful for "which blog post got most clicks in this campaign")
 * - resourceId: Exact match (useful for "how many clicks did this specific blog post get")
 * - developerId: Exact match (useful for "which developers clicked on our content")
 * - fromDate/toDate: Date range filter on clicked_at
 *
 * Example:
 * ```typescript
 * // Get clicks for a specific blog post (resource)
 * const result = await listClicks('default', {
 *   resourceId: 'resource-uuid-blog-post-123',
 *   fromDate: new Date('2025-01-01'),
 *   toDate: new Date('2025-01-31'),
 *   limit: 50,
 *   orderBy: 'clickedAt',
 *   orderDirection: 'desc',
 * });
 *
 * console.log(result.clicks); // Array of clicks for this blog post
 * console.log(result.total); // Total count for this blog post in Jan 2025
 * ```
 */
export async function listClicks(
  tenantId: string,
  input: ListClicks
): Promise<ListClicksResult> {
  // Implementation: Query with filters, date range, sorting, pagination
  // ...
}
```

---

#### 4. updateClick()

クリックイベントを更新する（メタデータ等）。

```typescript
/**
 * Update Click Schema
 *
 * Input validation for updateClick() function.
 *
 * Fields:
 * - developerId: Update developer ID (optional, useful for resolving anonymous → identified)
 * - accountId: Update account ID (optional)
 * - metadata: Update metadata (optional)
 *
 * Note: At least one field must be provided.
 */
export const UpdateClickSchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export type UpdateClick = z.infer<typeof UpdateClickSchema>;

/**
 * Update Click
 *
 * Updates a click event's properties (typically for identity resolution).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param clickId - Click UUID
 * @param input - Fields to update
 * @returns Updated Click
 * @throws {Error} If click not found (404)
 * @throws {Error} If no fields provided for update (400 Bad Request)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateClickSchema
 * 2. Check if click exists
 * 3. Check if at least one field is provided (throw error if empty update)
 * 4. Update clicks table with new values
 * 5. Return updated Click
 *
 * Use case:
 * - Identity resolution: Anonymous click (anon_id only) → Identified click (developer_id assigned)
 * - Metadata enrichment: Add browser info, geolocation, etc.
 *
 * Example:
 * ```typescript
 * // Resolve anonymous click to developer
 * const updated = await updateClick('default', 'click-uuid', {
 *   developerId: 'developer-uuid',
 * });
 *
 * console.log(updated.developerId); // "developer-uuid" (was null before)
 * ```
 */
export async function updateClick(
  tenantId: string,
  clickId: string,
  input: UpdateClick
): Promise<Click> {
  // Implementation: Validate, check existence, update with RLS
  // ...
}
```

---

#### 5. deleteClick()

クリックイベントを削除する（GDPR対応等）。

```typescript
/**
 * Delete Click
 *
 * Deletes a click event (GDPR compliance, spam removal).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param clickId - Click UUID
 * @returns true if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Execute DELETE with tenant_id and click_id filtering
 * 2. Use RETURNING clause to detect successful deletion
 * 3. Return true if deleted, false if not found
 *
 * Example:
 * ```typescript
 * const deleted = await deleteClick('default', 'click-uuid');
 * if (deleted) {
 *   console.log('Click deleted');
 * } else {
 *   console.log('Click not found');
 * }
 * ```
 */
export async function deleteClick(
  tenantId: string,
  clickId: string
): Promise<boolean> {
  // Implementation: DELETE with RETURNING
  // ...
}
```

---

## Remix Resource Route実装

### リダイレクトルート: `/c/{key}`

```typescript
// core/app/routes/c.$key.ts

import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { getShortlinkByKey } from '~/services/shortlink.service';
import { createClick } from '~/services/click.service';

/**
 * Shortlink Redirect Route
 *
 * Handles shortlink redirects and click tracking.
 *
 * URL: /c/{key}
 * Method: GET
 *
 * Flow:
 * 1. Extract key from URL params
 * 2. Lookup shortlink by key
 * 3. If not found, return 404
 * 4. Create click record in clicks table
 * 5. Redirect to target URL
 *
 * Tenant resolution:
 * - Extract tenant from request hostname (e.g., "example.devcle.com" → "example")
 * - Default to "default" tenant for devcle.com
 *
 * Anonymous tracking:
 * - Read anon_id from cookie (if exists)
 * - Generate new anon_id if not exists (using nanoid)
 * - Set anon_id cookie with 1-year expiration
 *
 * Click attribution:
 * - campaign_id and resource_id are copied from shortlink
 * - developer_id is set if user is authenticated
 * - anon_id is used for anonymous tracking
 *
 * Error handling:
 * - 404: Shortlink not found
 * - 500: Database error (log error, show generic error page)
 * - Click tracking failure: Log error but continue with redirect (don't block user)
 *
 * Example:
 * ```
 * GET /c/abcd1234
 * → Lookup shortlink with key "abcd1234"
 * → Create click record in clicks table
 * → Redirect to target URL
 * ```
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Extract key from params
  // 2. Extract tenant from hostname
  // 3. Get shortlink by key
  // 4. Extract anon_id from cookie or generate new one
  // 5. Create click record (campaign_id/resource_id from shortlink)
  // 6. Redirect to target URL with Set-Cookie header
  // ...
}
```

---

## nanoid設定

### カスタムアルファベット

```typescript
// core/utils/nanoid.ts

import { customAlphabet } from 'nanoid';

/**
 * URL-safe Alphabet
 *
 * Custom alphabet for nanoid:
 * - Excludes similar-looking characters: 0/O, 1/l/I
 * - URL-safe: a-z, A-Z, 2-9, _, -
 *
 * Total characters: 60
 */
const SHORTLINK_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz_-';

/**
 * Default shortlink key length
 *
 * 8 characters with 60-character alphabet:
 * - Collision probability: ~1 in 168 billion (60^8)
 * - Sufficient for up to 100 million shortlinks
 */
const SHORTLINK_KEY_LENGTH = 8;

/**
 * Generate Shortlink Key
 *
 * Generates a random URL-safe key using nanoid.
 *
 * @returns Random key (e.g., "abcd1234", "XyZ_9876")
 *
 * Example:
 * ```typescript
 * const key = generateShortlinkKey(); // "abcd1234"
 * ```
 */
export const generateShortlinkKey = customAlphabet(
  SHORTLINK_ALPHABET,
  SHORTLINK_KEY_LENGTH
);
```

---

## テスト計画

### ユニットテスト（Vitest）

#### Shortlink Service

**ファイル**: `core/services/shortlink.service.test.ts`

```typescript
describe('shortlink.service.ts', () => {
  describe('createShortlink()', () => {
    it('should create shortlink with auto-generated key');
    it('should create shortlink with custom key');
    it('should create shortlink with campaign_id');
    it('should create shortlink with resource_id');
    it('should create shortlink with attributes (UTM params)');
    it('should throw error if custom key already exists');
    it('should validate target URL format');
    it('should validate campaign_id UUID format');
  });

  describe('getShortlink()', () => {
    it('should return shortlink if found by ID');
    it('should return null if not found by ID');
    it('should enforce RLS (tenant isolation)');
  });

  describe('getShortlinkByKey()', () => {
    it('should return shortlink if found by key');
    it('should return null if not found by key');
    it('should enforce RLS (tenant isolation)');
  });

  describe('listShortlinks()', () => {
    it('should list all shortlinks');
    it('should filter by campaign_id');
    it('should filter by resource_id');
    it('should search in key and targetUrl');
    it('should paginate with limit/offset');
    it('should sort by clickCount');
    it('should include clickCount in results');
    it('should enforce RLS (tenant isolation)');
  });

  describe('updateShortlink()', () => {
    it('should update targetUrl');
    it('should update key');
    it('should throw error if new key already exists');
    it('should throw error if empty update');
    it('should throw error if not found');
    it('should update updated_at timestamp');
  });

  describe('deleteShortlink()', () => {
    it('should delete shortlink');
    it('should return false if not found');
    it('should cascade delete clicks');
  });
});
```

**最小テスト数**: 26テスト

#### Click Service

**ファイル**: `core/services/click.service.test.ts`

```typescript
describe('click.service.ts', () => {
  describe('createClick()', () => {
    it('should create click with shortlink_id');
    it('should copy campaign_id from shortlink if not provided');
    it('should copy resource_id from shortlink if not provided');
    it('should handle anonymous clicks (anon_id only)');
    it('should handle authenticated clicks (developer_id)');
    it('should record user_agent, referer, ip_address');
  });

  describe('getClick()', () => {
    it('should return click if found');
    it('should return null if not found');
    it('should enforce RLS (tenant isolation)');
  });

  describe('listClicks()', () => {
    it('should list all clicks');
    it('should filter by shortlink_id');
    it('should filter by campaign_id');
    it('should filter by resource_id');
    it('should filter by developer_id');
    it('should filter by date range');
    it('should paginate with limit/offset');
    it('should sort by clicked_at');
    it('should enforce RLS (tenant isolation)');
  });

  describe('updateClick()', () => {
    it('should update developer_id (identity resolution)');
    it('should update metadata');
    it('should throw error if empty update');
    it('should throw error if not found');
  });

  describe('deleteClick()', () => {
    it('should delete click');
    it('should return false if not found');
  });
});
```

**最小テスト数**: 22テスト

### 統合テスト（Vitest）

**ファイル**: `core/app/routes/c.$key.test.ts`

```typescript
describe('/c/{key} redirect route', () => {
  it('should redirect to target URL for valid key');
  it('should return 404 for invalid key');
  it('should create click record on redirect');
  it('should copy campaign_id/resource_id from shortlink to click');
  it('should set anon_id cookie if not exists');
  it('should preserve existing anon_id cookie');
  it('should enforce tenant isolation');
});
```

**最小テスト数**: 7テスト

---

## ファイル構造

```
core/
├── db/
│   ├── schema/
│   │   └── plugins.ts                         # Add clicks table, update shortlinks
│   └── migrations/
│       └── 0003_xxx.sql                       # Migration for clicks + updated_at
├── services/
│   ├── shortlink.service.ts                   # Barrel file (exports)
│   ├── shortlink.schemas.ts                   # Zod schemas
│   ├── shortlink-create.service.ts            # createShortlink()
│   ├── shortlink-get.service.ts               # getShortlink(), getShortlinkByKey()
│   ├── shortlink-list.service.ts              # listShortlinks()
│   ├── shortlink-update.service.ts            # updateShortlink()
│   ├── shortlink-delete.service.ts            # deleteShortlink()
│   ├── shortlink.service.test.ts              # Unit tests (26+ tests)
│   ├── click.service.ts                       # Barrel file (exports)
│   ├── click.schemas.ts                       # Zod schemas
│   ├── click-create.service.ts                # createClick()
│   ├── click-get.service.ts                   # getClick()
│   ├── click-list.service.ts                  # listClicks()
│   ├── click-update.service.ts                # updateClick()
│   ├── click-delete.service.ts                # deleteClick()
│   └── click.service.test.ts                  # Unit tests (22+ tests)
├── app/
│   └── routes/
│       ├── c.$key.ts                          # Redirect route
│       └── c.$key.test.ts                     # Integration tests (7+ tests)
└── utils/
    └── nanoid.ts                              # Custom nanoid configuration
```

**ファイル行数制限**: 各ファイル150行以下

---

## エラーハンドリング

### エラーケース

1. **短縮URL作成エラー**
   - カスタムキーが既に存在: `409 Conflict`
   - 無効なURL形式: `400 Bad Request`
   - 無効なUUID形式（campaign_id/resource_id）: `400 Bad Request`

2. **短縮URL更新エラー**
   - 短縮URLが見つからない: `404 Not Found`
   - 新しいキーが既に存在: `409 Conflict`
   - 更新フィールドが空: `400 Bad Request`

3. **リダイレクトエラー**
   - 短縮URLが見つからない: `404 Not Found`
   - データベースエラー: `500 Internal Server Error`（エラーログ記録）

4. **クリック追跡エラー**
   - クリック追跡失敗時もリダイレクトは継続（クリックデータの損失を最小化）
   - エラーログに記録

---

## セキュリティ考慮事項

### 1. Open Redirect対策

- targetUrl のバリデーション:
  - 許可するスキーム: `https://`, `http://` のみ
  - `javascript:`, `data:`, `file:` 等は禁止
  - ホワイトリストによる検証（オプション）

### 2. Rate Limiting

- 同一IPからの短縮URL生成を制限（例: 10件/分）
- 同一IPからのリダイレクトを制限（例: 100件/分）

### 3. RLS（Row Level Security）

- テナント分離を徹底
- 他テナントの短縮URL・クリックデータにアクセス不可

---

## パフォーマンス最適化

### 1. キャッシュ戦略

- shortlinks テーブルのキャッシュ（Redis）
  - キー: `shortlink:{tenant_id}:{key}`
  - TTL: 1時間
  - リダイレクト前にキャッシュから取得

### 2. インデックス

- shortlinks:
  - `(tenant_id, key)` unique index（既に存在）
  - `(tenant_id, campaign_id)` index（Campaign別集計用）
- clicks:
  - `(tenant_id, shortlink_id, clicked_at DESC)` index
  - `(tenant_id, campaign_id, clicked_at DESC)` index
  - `(tenant_id, resource_id, clicked_at DESC)` index
  - `(tenant_id, developer_id, clicked_at DESC)` index

---

## 実装順序

### フェーズ1: スキーマとマイグレーション
1. **clicks テーブル追加**（core/db/schema/plugins.ts）
2. **shortlinks に updated_at 追加**（core/db/schema/plugins.ts）
3. **マイグレーション生成・適用**（pnpm db:migrate:generate, pnpm db:migrate）

### フェーズ2: Shortlink Service
4. **nanoid設定**（core/utils/nanoid.ts）
5. **Zodスキーマ定義**（core/services/shortlink.schemas.ts）
6. **createShortlink()実装**（core/services/shortlink-create.service.ts）
7. **getShortlink()実装**（core/services/shortlink-get.service.ts）
8. **listShortlinks()実装**（core/services/shortlink-list.service.ts）
9. **updateShortlink()実装**（core/services/shortlink-update.service.ts）
10. **deleteShortlink()実装**（core/services/shortlink-delete.service.ts）
11. **Barrel fileエクスポート**（core/services/shortlink.service.ts）
12. **ユニットテスト**（core/services/shortlink.service.test.ts - 26テスト）

### フェーズ3: Click Service
13. **Zodスキーマ定義**（core/services/click.schemas.ts）
14. **createClick()実装**（core/services/click-create.service.ts）
15. **getClick()実装**（core/services/click-get.service.ts）
16. **listClicks()実装**（core/services/click-list.service.ts）
17. **updateClick()実装**（core/services/click-update.service.ts）
18. **deleteClick()実装**（core/services/click-delete.service.ts）
19. **Barrel fileエクスポート**（core/services/click.service.ts）
20. **ユニットテスト**（core/services/click.service.test.ts - 22テスト）

### フェーズ4: Redirect Route
21. **リダイレクトルート実装**（core/app/routes/c.$key.ts）
22. **統合テスト**（core/app/routes/c.$key.test.ts - 7テスト）

### フェーズ5: 最終確認
23. **TypeScriptエラー解消・型チェック**
24. **全テスト実行・確認**（55テスト以上）

---

## 完了条件

- [x] ドキュメント作成完了
- [ ] clicks テーブル作成完了（マイグレーション）
- [ ] shortlinks.updated_at カラム追加完了（マイグレーション）
- [ ] nanoid設定完了
- [ ] Shortlink Service実装完了（CRUD 5関数）
- [ ] Shortlink Service テスト完了（26テスト以上、全てパス）
- [ ] Click Service実装完了（CRUD 5関数）
- [ ] Click Service テスト完了（22テスト以上、全てパス）
- [ ] リダイレクトルート実装完了
- [ ] リダイレクトルートテスト完了（7テスト以上、全てパス）
- [ ] TypeScriptエラーゼロ（`pnpm typecheck`パス）
- [ ] 短縮URLが機能し、クリック数がclicksテーブルに記録される

---

## 参考情報

### nanoid

- 公式ドキュメント: https://github.com/ai/nanoid
- URL-safe alphabet: https://github.com/ai/nanoid#custom-alphabet-or-size

### Remix Resource Routes

- 公式ドキュメント: https://remix.run/docs/en/main/guides/resource-routes

### Drizzle ORM

- LEFT JOIN for click counts: https://orm.drizzle.team/docs/joins
- Aggregate queries: https://orm.drizzle.team/docs/select#aggregations
